import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import {
  getDb,
  clienteOneflow,
  appHashPorCnpj,
  cotaRestante,
  mesesParaSincronizar,
  sincronizarResultado,
} from '@hexxa/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * ESPELHO DO RESULTADO OFICIAL.
 *
 * Lê do balancete do OneFlow o lucro acumulado no exercício, para cada mês
 * que acabou de ser ENVIADO. É dele — e só dele — que a distribuição de
 * lucros passa a partir.
 *
 * Custa uma chamada por mês novo enviado, e nada nos outros dias: um mês lido
 * depois do envio não muda lá sem que algo seja enviado de novo. Com 50
 * empresas fechando em dias diferentes, são poucas chamadas por dia.
 *
 * Roda depois do envio (04:00 e 05:30 UTC), que é quem leva os meses a
 * ENVIADO.
 */
const RESERVA_PARA_A_VOLTA = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const cliente = clienteOneflow(db);
  const prazo = Date.now() + 250_000;

  try {
    const empresas = (await db.execute(sql`
      SELECT DISTINCT c.id::text, c.legal_name, c.cnpj
        FROM company c
        JOIN monthly_closure mc ON mc.company_id = c.id AND mc.stage = 'ENVIADO'
    `)) as unknown as { id: string; legal_name: string; cnpj: string }[];

    const relatorio: Record<string, unknown>[] = [];
    for (const e of empresas) {
      if (Date.now() > prazo) break;
      // A volta das guias é a que o cliente sente; o espelho do resultado
      // espera o dia seguinte antes de disputar a cota com ela.
      if ((await cotaRestante(db, RESERVA_PARA_A_VOLTA)) <= 0) break;

      const meses = await mesesParaSincronizar(db, e.id);
      if (!meses.length) continue;

      const appHash = await appHashPorCnpj(db, e.cnpj, e.id);
      if (!appHash) continue;

      for (const comp of meses) {
        try {
          const r = await sincronizarResultado(db, e.id, appHash, comp, cliente);
          relatorio.push({ empresa: e.legal_name, competencia: comp, ...r });
        } catch (err) {
          relatorio.push({ empresa: e.legal_name, competencia: comp, erro: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    return NextResponse.json({ lidos: relatorio.length, empresas: relatorio });
  } catch (error) {
    console.error('[cron/resultado-oneflow] falhou:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
