import { NextResponse } from 'next/server';
import { rodarAvisosDeVencimento } from '@/lib/server/avisos-de-vencimento';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Avisa no sino os documentos perto de vencer — ver `avisos-de-vencimento.ts`. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await rodarAvisosDeVencimento(new URL(request.url).searchParams.get('simular') === '1')) });
  } catch (err) {
    console.error('[cron/documentos-vencendo]', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
