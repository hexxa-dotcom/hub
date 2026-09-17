import { NextResponse } from 'next/server';
import { getDb, empresasComAgenteLigado } from '@hexxa/db';
import { classificarPendentes } from '@/lib/server/agente-classificador';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Varredura de classificação — a IA categoriza os lançamentos que estão sem
 * categoria.
 *
 * Roda em lote limitado por execução, de propósito. Classificar 400
 * lançamentos de uma vez seria um único ponto de falha caro, e encheria a fila
 * de revisão com tanta coisa que ninguém revisaria nenhuma — o que anularia o
 * contrapeso da autonomia.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    // Só quem tem o classificador ligado. Sem isto, o interruptor da ficha do
    // cliente seria decorativo: o agente desligado continuaria rodando de
    // madrugada e gastando token da empresa que pediu para não usar.
    const empresas = await empresasComAgenteLigado(db, 'classificador');
    const relatorio = [];

    for (const emp of empresas) {
      const r = await classificarPendentes(emp.id, { limite: 40 });
      if (!r.disponivel) {
        return NextResponse.json({
          message: 'IA não configurada — ative em /contador/configuracoes/ia-insights.',
        });
      }
      if (r.analisados === 0) continue;

      relatorio.push({
        empresa: emp.nome,
        analisados: r.analisados,
        aplicados: r.aplicados,
        aguardandoAprovacao: r.aguardandoAprovacao,
        descartados: r.descartados.length,
        erros: r.erros.length,
      });
    }

    return NextResponse.json({ empresas: relatorio });
  } catch (error) {
    console.error('[cron/classificacao] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
