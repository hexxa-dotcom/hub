import { NextResponse } from 'next/server';
import { getDb } from '@hexxa/db';
import {
  escriturarPendentes,
  companiesComPendencia,
  assertLedgerBalances,
  empresasComAgenteLigado,
} from '@hexxa/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Varredura de escrituração — escritura todo documento que ainda não virou
 * partida no razão.
 *
 * Existe porque os ganchos em linha (`lib/server/ledger.ts`) são best-effort:
 * eles mantêm o razão vivo em tempo real, mas engolem a falha para não
 * derrubar a ação do usuário. Esta rota é o que impede que engolir a falha
 * vire perda de escrituração — e é também o que cobre os pontos de escrita que
 * ninguém enganchou, presentes e futuros.
 *
 * Idempotente: documento já escriturado não é reprocessado, porque a consulta
 * de pendências parte das partidas que existem, não de uma marca no documento.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    // Interseção: quem tem pendência E tem a escrituração ligada. Desligar a
    // escrituração de uma empresa é uma decisão forte — o razão dela para de
    // acompanhar os documentos — mas é do contador, não do cron.
    const comPendencia = await companiesComPendencia(db);
    const ligadas = new Set((await empresasComAgenteLigado(db, 'escrituracao')).map((e) => e.id));
    const empresas = comPendencia.filter((id) => ligadas.has(id));
    const relatorio: Record<string, unknown>[] = [];

    for (const companyId of empresas) {
      const r = await escriturarPendentes(db, companyId);

      // Conferir depois de escrever é o ponto do exercício: um razão que
      // ninguém verifica é só uma soma com mais tabelas.
      const equilibrio = await assertLedgerBalances(db, companyId, '2999-12-01');

      relatorio.push({
        companyId,
        pendencias: r.pendenciasEncontradas,
        gravadas: r.gravadas,
        jaExistiam: r.jaExistiam,
        ignorados: r.ignorados.length,
        erros: r.erros.length,
        razaoFecha: equilibrio.ok,
        ...(equilibrio.ok ? {} : { diferenca: equilibrio.diff }),
      });

      if (!equilibrio.ok) {
        console.error(
          `[cron/escrituracao] RAZÃO NÃO FECHA para ${companyId}: diferença ${equilibrio.diff}. ` +
            `Os triggers do banco deveriam tornar isto impossível — investigar.`,
        );
      }
      if (r.erros.length) {
        console.error(`[cron/escrituracao] ${companyId}: ${r.erros.length} erro(s)`, r.erros.slice(0, 10));
      }
    }

    return NextResponse.json({
      message: `Varredura concluída: ${empresas.length} empresa(s) com pendência.`,
      empresas: relatorio,
    });
  } catch (error) {
    console.error('[cron/escrituracao] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
