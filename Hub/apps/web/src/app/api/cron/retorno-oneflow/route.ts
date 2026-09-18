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
 * ── Por que DIÁRIO, e não num dia fixo ──────────────────────────────────
 *
 * A primeira versão rodava uma vez, no dia 10. Os dados desmentiram a
 * escolha. Datas reais de geração da guia do DAS, duas empresas, cinco
 * competências:
 *
 *   BM3       dias 1, 1, 3, 3, 1
 *   ESTÚDIO   dias 1, 1, 3, 12, 15
 *
 * Quem gera é o OneFlow, no ritmo dele. Um tiro único no dia 5 perderia duas
 * guias do Estúdio; no dia 10, perderia uma; e em qualquer dia fixo, a guia
 * que saiu antes fica esperando à toa.
 *
 * Rodando todo dia, cada guia chega ao cliente no dia seguinte ao de existir.
 * Para a maioria isso é dia 2 — melhor que qualquer data fixa — e para as
 * atrasadas é o mais cedo possível, porque antes disso não havia o que pegar.
 *
 * ── E por que isso é barato ─────────────────────────────────────────────
 *
 * Empresa cuja guia já chegou é pulada sem gastar chamada nenhuma: a
 * verificação é uma consulta ao banco. O custo diário é de duas chamadas por
 * empresa que ainda falta, e ele cai a zero conforme o mês se completa.
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

      /**
       * Já chegou tudo desta competência? Pula sem gastar chamada.
       *
       * "Tudo" é a guia COM o arquivo dentro: guia sem PDF é guia que o
       * cliente vê mas não consegue pagar, e é exatamente o estado que a
       * execução do dia seguinte precisa tentar resolver.
       */
      const [pronta] = (await db.execute(sql`
        SELECT 1 FROM tax_guide
         WHERE company_id = ${empresa.id}
           AND reference_month = ${`${competencia.slice(0, 4)}-${competencia.slice(4, 6)}-01`}
           AND file_url IS NOT NULL
         LIMIT 1
      `)) as unknown as { '?column?': number }[];
      if (pronta) continue;

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
