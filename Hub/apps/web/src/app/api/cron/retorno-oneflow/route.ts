import { NextResponse } from 'next/server';
import { getDb } from '@hexxa/db';
import {
  importarDoOneflow,
  cotaDiariaEsgotada,
  appHashPorCnpj,
  assertLedgerBalances,
  empresasComAgenteLigado,
} from '@hexxa/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * MÃO DE VOLTA DO ONEFLOW — traz guia apurada e folha, e escritura.
 *
 * Roda mensalmente porque é esse o ritmo do fato: a apuração fiscal fecha
 * depois do mês, não durante. Rodar diariamente gastaria a cota diária da API
 * para reler trinta vezes o mesmo número.
 *
 * ── Qual competência ────────────────────────────────────────────────────
 *
 * O mês ANTERIOR ao de execução. Rodando dia 10 de março, busca fevereiro —
 * quando o fiscal já fechou lá e a guia já existe. Buscar o mês corrente só
 * devolveria apuração aberta, que a importação recusa de propósito: valor de
 * apuração aberta ainda muda, e escriturá-lo produziria um estorno por rodada.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    const url = new URL(request.url);
    const competencia = url.searchParams.get('competencia') ?? mesAnterior();

    const ligadas = await empresasComAgenteLigado(db, 'retornoOneflow');
    const relatorio: Record<string, unknown>[] = [];
    let interrompido: string | null = null;

    for (const empresa of ligadas) {
      const [dados] = (await db.execute(sql`
        SELECT cnpj FROM company WHERE id = ${empresa.id}
      `)) as unknown as { cnpj: string }[];
      if (!dados) continue;

      const appHash = await appHashPorCnpj(db, dados.cnpj, empresa.id);
      if (!appHash) {
        relatorio.push({ empresa: empresa.nome, erro: 'não cadastrada no OneFlow' });
        continue;
      }

      const r = await importarDoOneflow(db, empresa.id, appHash, competencia);

      // Conferir depois de escrever. Vale aqui ainda mais que na escrituração
      // comum: o valor veio de fora, e um razão que ninguém verifica é só uma
      // soma com mais tabelas.
      const equilibrio = await assertLedgerBalances(db, empresa.id, '2999-12-01');

      relatorio.push({
        empresa: empresa.nome,
        guias: r.guias.filter((g) => g.acao === 'criada' || g.acao === 'atualizada'),
        folha: r.folha,
        fatorR: r.fatorR,
        escrituradas: r.escrituradas,
        avisos: r.avisos,
        razaoFecha: equilibrio.ok,
        ...(equilibrio.ok ? {} : { diferenca: equilibrio.diff }),
      });

      if (!equilibrio.ok) {
        console.error(
          `[cron/retorno-oneflow] RAZÃO NÃO FECHA para ${empresa.nome}: diferença ${equilibrio.diff}.`,
        );
      }

      /**
       * Cota diária estourada para o lote inteiro.
       *
       * Seguir para a próxima empresa produziria uma lista de erros idênticos
       * e ainda consumiria a cota de amanhã, porque as tentativas continuam
       * contando. Parar preserva o que já foi importado e deixa o resto para
       * a próxima execução.
       */
      if (cotaDiariaEsgotada(r)) {
        interrompido = empresa.nome;
        break;
      }
    }

    return NextResponse.json({
      message: interrompido
        ? `Interrompido em "${interrompido}": cota diária da API do OneFlow esgotada. ` +
          'Ela reinicia à meia-noite; as empresas restantes entram na próxima execução.'
        : `Volta concluída para ${relatorio.length} empresa(s), competência ${competencia}.`,
      competencia,
      empresas: relatorio,
    });
  } catch (error) {
    console.error('[cron/retorno-oneflow] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/** Competência AAAAMM do mês anterior ao de hoje. */
function mesAnterior(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
