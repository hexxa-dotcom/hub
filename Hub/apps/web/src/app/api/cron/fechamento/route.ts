import { NextResponse } from 'next/server';
import { createRawClient } from '@/lib/supabase/server';
import { getDb } from '@hexxa/db';
import { monthlyClosure, financialEntry, company } from '@hexxa/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos, caso sejam muitos clientes

export async function GET(request: Request) {
  // Segurança básica para o Cron Job
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createRawClient();

    // 1. Determinar o mês anterior
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    const referenceMonthStr = lastMonth.toISOString().split('T')[0] as string;

    // 2. Buscar todas as empresas ativas
    const { data: companies, error: companiesError } = await supabase
      .from('company')
      .select('id, name');

    if (companiesError) throw new Error(companiesError.message);
    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: 'Nenhuma empresa encontrada para processamento.' });
    }

    let successCount = 0;
    const errors: string[] = [];

    // 3. Processar o fechamento de cada empresa
    for (const comp of companies) {
      try {
        // Verificar se já existe fechamento para este mês
        const { data: existing } = await supabase
          .from('monthly_closure')
          .select('id')
          .eq('company_id', comp.id)
          .eq('reference_month', referenceMonthStr)
          .single();

        if (existing) {
          continue; // Já foi fechado
        }

        // Agregar Receitas e Despesas do mês anterior
        const { data: entries, error: entriesError } = await supabase
          .from('financial_entry')
          .select('type, amount')
          .eq('company_id', comp.id)
          .eq('reference_month', referenceMonthStr);

        if (entriesError) throw new Error(entriesError.message);

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

        successCount++;
      } catch (err: any) {
        errors.push(`Erro ao processar empresa ${comp.name}: ${err.message}`);
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
