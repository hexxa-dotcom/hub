import { NextResponse } from 'next/server';
import { conferirCobrancasAsaas } from '@/lib/server/cobrancas-asaas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Baixa as contas a receber cujo Pix/boleto Asaas já foi pago. Ver `conferirCobrancasAsaas`. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const r = await conferirCobrancasAsaas();
    return NextResponse.json({
      message: `Asaas: ${r.baixadas} recebida(s) de ${r.conferidas} cobrança(s) em aberto, em ${r.empresas} empresa(s).`,
      errors: r.erros.length ? r.erros : undefined,
    });
  } catch (error: any) {
    console.error('Erro no Cron de cobranças Asaas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
