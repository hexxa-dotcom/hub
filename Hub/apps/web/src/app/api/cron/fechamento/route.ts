import { NextResponse } from 'next/server';
import { getDb } from '@hexxa/db';
import { monthlyClosure, financialEntry, company, taxGuide, accountingInvoice, taxHistory, subscription, plan } from '@hexxa/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { TaxThermometerService } from '@hexxa/core';
import { getSimplesInputs } from '@/lib/server/fiscal';
import type { TenantContext } from '@hexxa/core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos, caso sejam muitos clientes

export async function GET(request: Request) {
  // Segurança básica para o Cron Job
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // 1. Determinar o mês anterior
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    const referenceMonthStr = lastMonth.toISOString().split('T')[0] as string;

    // 2. Buscar todas as empresas ativas
    const companies = await db
      .select({ id: company.id, legalName: company.legalName, type: company.type })
      .from(company);

    const thermometer = new TaxThermometerService();

    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: 'Nenhuma empresa encontrada para processamento.' });
    }

    let successCount = 0;
    const errors: string[] = [];

    // 3. Processar o fechamento de cada empresa
    for (const comp of companies) {
      try {
        // Verificar se já existe fechamento para este mês
        const [existing] = await db
          .select({ id: monthlyClosure.id })
          .from(monthlyClosure)
          .where(
            and(
              eq(monthlyClosure.companyId, comp.id),
              eq(monthlyClosure.referenceMonth, referenceMonthStr)
            )
          );

        if (existing) {
          continue; // Já foi fechado
        }

        // Agregar Receitas e Despesas do mês anterior
        const entries = await db
          .select({ type: financialEntry.type, amount: financialEntry.amount })
          .from(financialEntry)
          .where(
            and(
              eq(financialEntry.companyId, comp.id),
              eq(financialEntry.referenceMonth, referenceMonthStr)
            )
          );

        let totalRevenue = 0;
        let totalExpenses = 0;

        for (const entry of (entries || [])) {
          if (entry.type === 'RECEIVABLE') totalRevenue += Number(entry.amount);
          if (entry.type === 'PAYABLE') totalExpenses += Number(entry.amount);
        }

        // Para novos contratos e inadimplências, usaremos 0 por enquanto até 
        // integrarmos o módulo de contratos/faturas de forma mais granular
        const newContractsCount = 0;
        const defaultsCount = 0;

        // Inserir o fechamento
        await getDb().insert(monthlyClosure).values({
          companyId: comp.id,
          referenceMonth: referenceMonthStr,
          totalRevenue: String(totalRevenue),
          totalExpenses: String(totalExpenses),
          newContractsCount,
          defaultsCount,
          status: 'CLOSED',
        });

        const nextMonthStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]!;

        // RBT12/folha reais (janela de 12 meses) e posição no Simples — mesma
        // lógica usada na emissão de NFSe (ver emitNfseAction), não mais um
        // valor fabricado.
        const ctx: TenantContext = { companyId: comp.id, companyType: comp.type, userId: 'cron' };
        const { rbt12, folha12 } = await getSimplesInputs(ctx);
        const simples = thermometer.simplesPosition({ rbt12, payroll12: folha12 });

        // Gerar Guia de DAS (Simples Nacional) se houve faturamento, usando a
        // alíquota nominal real da faixa/anexo em que a empresa está.
        if (totalRevenue > 0) {
          const dasAmount = (totalRevenue * simples.nominalRate) / 100;
          await getDb().insert(taxGuide).values({
            companyId: comp.id,
            taxName: 'DAS - Simples Nacional',
            referenceMonth: nextMonthStr, // Guia cobrada no mês vigente (sobre o faturamento passado)
            amount: String(dasAmount),
            dueDate: new Date(today.getFullYear(), today.getMonth(), 20).toISOString().split('T')[0]!,
            status: 'OPEN',
            // TODO: pixCode ainda é um placeholder — gerar cobrança real exige
            // integração de pagamento própria da plataforma (não a do
            // Asaas do tenant, que é para cobrar OS CLIENTES da empresa).
            pixCode: null,
          });

          await getDb().insert(taxHistory).values({
            companyId: comp.id,
            referenceMonth: nextMonthStr.slice(0, 7), // Apenas YYYY-MM
            rba12: String(rbt12),
            effectiveRate: simples.nominalRate.toFixed(2),
            taxBracket: `Anexo ${simples.anexo} - Faixa ${simples.faixa}`,
          });
        }

        // Fatura de Honorários (Recorrente) — valor real do plano contratado
        // pela empresa na plataforma, não mais um valor fixo de exemplo.
        const [activeSub] = await getDb()
          .select({ monthlyValue: plan.monthlyValue })
          .from(subscription)
          .innerJoin(plan, eq(subscription.planId, plan.id))
          .where(and(eq(subscription.companyId, comp.id), eq(subscription.status, 'ACTIVE')));

        if (activeSub) {
          await getDb().insert(accountingInvoice).values({
            companyId: comp.id,
            description: 'Honorários Contábeis',
            value: activeSub.monthlyValue,
            referenceMonth: nextMonthStr,
            dueDate: new Date(today.getFullYear(), today.getMonth(), 10).toISOString().split('T')[0]!,
            status: 'OPEN',
            // TODO: mesmo placeholder de pixCode acima.
            pixCode: null,
          });
        }

        successCount++;
      } catch (err: any) {
        errors.push(`Erro ao processar empresa ${comp.legalName}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Fechamento concluído: ${successCount} empresas processadas para o mês ${referenceMonthStr}.`,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('Erro no Cron de Fechamento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
