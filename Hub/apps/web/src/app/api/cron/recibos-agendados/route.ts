import { NextResponse } from 'next/server';
import { rodarRecibosAgendados } from '@/lib/server/recibos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try { return NextResponse.json(await rodarRecibosAgendados()); }
  catch { return NextResponse.json({ error: 'Não foi possível processar os recibos agendados.' }, { status: 500 }); }
}
