import { NextResponse } from 'next/server';
import { rodarAgendadas } from '@/lib/server/emissao-agendada';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Emite as notas agendadas que vencem hoje e avisa as de amanhã.
 * Roda no turno da manhã do orquestrador — ver `emissao-agendada.ts`.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await rodarAgendadas()) });
  } catch (err) {
    console.error('[cron/emissoes-agendadas]', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
