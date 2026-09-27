import 'server-only';
import { getDb, sql } from '@hexxa/db';

/**
 * NOTAS EMITIDAS × RECEITA APURADA NO ONEFLOW.
 *
 * A nota fiscal é a única receita válida (imposto e livros); o OneFlow apura
 * o Simples com o que recebeu. Se os dois não batem, ou faltou nota no
 * OneFlow (imposto a menos) ou entrou nota que não devia (cancelada, em
 * dobro — imposto a mais). A conferência é por competência, só onde já há
 * apuração: é fato contra fato, sem estimativa.
 */

export interface ConferenciaDoMes {
  companyId: string;
  empresa: string;
  competencia: string; // AAAA-MM
  notas: number;
  qtdNotas: number;
  apurada: number;
  diferenca: number; // notas − apurada
}

/** As competências que não batem (diferença acima de 1 centavo), da mais recente. */
export async function divergenciasDoFaturamento(meses = 12): Promise<ConferenciaDoMes[]> {
  const linhas = (await getDb().execute(sql`
    WITH notas AS (
      SELECT company_id, to_char(data_emissao AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS competencia,
             sum(coalesce(valor_servico, valor_liquido, 0)) AS total, count(*)::int AS qtd
        FROM nfse_distribuicao_doc
       WHERE tipo_documento = 'NFSE' AND direction = 'EMITIDA' AND NOT cancelado
       GROUP BY 1, 2
    )
    SELECT r.company_id::text AS "companyId", coalesce(c.trade_name, c.legal_name) AS empresa, r.competencia,
           coalesce(n.total, 0)::float AS notas, coalesce(n.qtd, 0) AS "qtdNotas", r.receita::float AS apurada
      FROM receita_apurada r
      JOIN company c ON c.id = r.company_id
      LEFT JOIN notas n ON n.company_id = r.company_id AND n.competencia = r.competencia
     WHERE r.competencia >= to_char(current_date - make_interval(months => ${meses}), 'YYYY-MM')
       AND abs(coalesce(n.total, 0) - r.receita) > 0.01
     ORDER BY r.competencia DESC, empresa
  `)) as unknown as Omit<ConferenciaDoMes, 'diferenca'>[];
  return linhas.map((l) => ({ ...l, diferenca: Math.round((l.notas - l.apurada) * 100) / 100 }));
}

/** Quantas competências já foram conferidas (para dizer "tudo bate" com base). */
export async function competenciasConferidas(meses = 12): Promise<number> {
  const [r] = (await getDb().execute(sql`
    SELECT count(*)::int AS n FROM receita_apurada
     WHERE competencia >= to_char(current_date - make_interval(months => ${meses}), 'YYYY-MM')
  `)) as unknown as { n: number }[];
  return r?.n ?? 0;
}
