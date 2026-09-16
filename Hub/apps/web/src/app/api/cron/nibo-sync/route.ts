import { NextResponse } from 'next/server';
import { syncNiboForAllCompanies } from '@/lib/server/nibo-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Importa contas a pagar/receber do Nibo pra cada empresa com integração
 * ativa (`integration_credential.provider = 'nibo'`). Ponte temporária
 * enquanto a empresa migra o financeiro pro Hub — nunca escreve no Nibo.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await syncNiboForAllCompanies();
    const imported = results.reduce((sum, r) => sum + r.imported, 0);
    const updated = results.reduce((sum, r) => sum + r.updated, 0);
    const customersImported = results.reduce((sum, r) => sum + r.customersImported, 0);
    const customersUpdated = results.reduce((sum, r) => sum + r.customersUpdated, 0);
    const errors = results.flatMap((r) => r.errors);
    return NextResponse.json({
      message: `Nibo sync: ${imported} lançamento(s) novo(s), ${updated} atualizado(s); ${customersImported} cliente(s) novo(s), ${customersUpdated} atualizado(s); em ${results.length} empresa(s).`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro no Cron de sincronização Nibo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
