import { NextResponse } from 'next/server';
import { getDb, withDbTimeout } from '@hexxa/db';
import { contract, financialEntry, customer, company, serviceInvoice } from '@hexxa/db/schema';
import { eq, and, lte, lt, isNull } from 'drizzle-orm';
import { makeServiceInvoiceService } from '@/lib/server/container';
import type { TenantContext } from '@hexxa/core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Motor de cobrança recorrente — sem movimentar dinheiro real (nenhuma
 * cobrança via gateway de pagamento). Só faz o que já deveria acontecer
 * sozinho: gerar o contas a receber de cada contrato ativo quando chega a
 * data, e marcar como vencido quem passou do prazo sem pagamento. Antes
 * disso, `nextBillingDate` era gravado no contrato e nunca lido em lugar
 * nenhum — cobrança dependia 100% de alguém lançar manualmente no
 * Financeiro.
 *
 * Quando `contract.autoEmitNfse` está ligado, em vez de só lançar o
 * recebível (source='CONTRACT'), emite a NFSe de verdade pelo
 * ServiceInvoiceService — que já cria o próprio recebível (source='NFSE') e,
 * se houver imposto estimado, o PAYABLE de provisão. Cliente sem contrato
 * formal nenhum: só precisa do cadastro em Meu Negócio > Clientes com "Emitir
 * nota fiscal automaticamente" marcado.
 */

function addCycle(dateStr: string, cycle: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  switch (cycle) {
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'SEMIANNUAL': d.setMonth(d.getMonth() + 6); break;
    case 'ANNUAL': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1); break; // MONTHLY
  }
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    // 1) Marca como vencido quem passou do prazo e ainda está pendente.
    const overdue = await withDbTimeout(
      db
        .update(financialEntry)
        .set({ status: 'OVERDUE' })
        .where(and(eq(financialEntry.status, 'PENDING'), lt(financialEntry.dueDate, todayStr)))
        .returning({ id: financialEntry.id }),
      8000,
    );

    // 2) Gera a parcela de contratos ativos cuja próxima cobrança já chegou.
    const dueContracts = await withDbTimeout(
      db
        .select({
          contract,
          companyType: company.type,
          customerName: customer.name,
          customerDocument: customer.document,
          customerEmail: customer.email,
        })
        .from(contract)
        .innerJoin(company, eq(contract.companyId, company.id))
        .innerJoin(customer, eq(contract.customerId, customer.id))
        // Cliente encerrado não fatura os clientes dele por aqui — ver 0065.
        .where(and(eq(contract.status, 'ACTIVE'), lte(contract.nextBillingDate, todayStr), isNull(company.closedAt))),
      8000,
    );

    let generated = 0;
    let nfseEmitted = 0;
    let finished = 0;
    const errors: string[] = [];

    for (const row of dueContracts) {
      const c = row.contract;
      try {
        if (!c.nextBillingDate) continue;
        const referenceMonth = c.nextBillingDate.slice(0, 8) + '01';

        if (c.autoEmitNfse) {
          // Idempotência: não emite de novo se já existe nota desse contrato
          // pra este mês de referência (cron pode rodar mais de uma vez no
          // mesmo dia, antes de nextBillingDate avançar pro próximo ciclo).
          const [already] = await withDbTimeout(
            db
              .select({ id: serviceInvoice.id })
              .from(serviceInvoice)
              .where(and(eq(serviceInvoice.contractId, c.id), eq(serviceInvoice.referenceMonth, referenceMonth))),
            8000,
          );

          if (!already) {
            const ctx: TenantContext = {
              companyId: c.companyId,
              companyType: row.companyType as TenantContext['companyType'],
              userId: 'cron',
            };
            const service = await makeServiceInvoiceService(ctx);
            const result = await service.emit(ctx, {
              customer: {
                name: row.customerName,
                document: row.customerDocument ?? '',
                email: row.customerEmail ?? undefined,
              },
              contractId: c.id,
              amount: Number(c.value),
              serviceDescription: c.serviceDescription || c.title,
              referenceMonth: c.nextBillingDate.slice(0, 7),
              dueDate: c.nextBillingDate,
            });
            if (result.status !== 'ERROR') nfseEmitted++;
            else errors.push(`Contrato ${c.id} (NFSe automática): emissão retornou ERROR.`);
          }
        } else {
          // Idempotência: não gera de novo se já existe lançamento deste
          // contrato pra este vencimento (cron pode rodar mais de uma vez).
          const [already] = await withDbTimeout(
            db
              .select({ id: financialEntry.id })
              .from(financialEntry)
              .where(
                and(
                  eq(financialEntry.source, 'CONTRACT'),
                  eq(financialEntry.sourceId, c.id),
                  eq(financialEntry.dueDate, c.nextBillingDate),
                ),
              ),
            8000,
          );

          if (!already) {
            await withDbTimeout(
              db.insert(financialEntry).values({
                companyId: c.companyId,
                type: 'RECEIVABLE',
                status: 'PENDING',
                description: `Recebível — ${c.title}`,
                amount: c.value,
                dueDate: c.nextBillingDate,
                referenceMonth,
                source: 'CONTRACT',
                sourceId: c.id,
              }),
              8000,
            );
            generated++;
          }
        }

        const next = addCycle(c.nextBillingDate, c.billingCycle);

        if (c.endDate && next > c.endDate) {
          await withDbTimeout(db.update(contract).set({ status: 'FINISHED', nextBillingDate: null }).where(eq(contract.id, c.id)), 8000);
          finished++;
        } else {
          await withDbTimeout(db.update(contract).set({ nextBillingDate: next }).where(eq(contract.id, c.id)), 8000);
        }
      } catch (err: any) {
        errors.push(`Contrato ${c.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Cobrança processada: ${generated} recebível(is) gerado(s), ${nfseEmitted} nota(s) fiscal(is) emitida(s) automaticamente, ${overdue.length} marcado(s) como vencido(s), ${finished} contrato(s) encerrado(s).`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro no Cron de Cobrança:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
