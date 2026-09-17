import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { ensureChartOfAccounts, loadAccountMap, type PostOptions } from './repository';
import {
  escriturarLancamento,
  escriturarGuia,
  escriturarDistribuicao,
  type EscrituracaoResult,
} from './escrituracao';

/**
 * VARREDURA DE PENDÊNCIAS — a rede de segurança da escrituração.
 *
 * Onze pontos do sistema criam `financial_entry`, e a lista cresce. Enganchar
 * a escrituração em cada um deles funciona até alguém escrever o décimo
 * segundo e esquecer — e um razão que perde lançamentos em silêncio é pior que
 * não ter razão, porque passa a mentir com aparência de autoridade.
 *
 * Então a arquitetura inverte a responsabilidade: em vez de perguntar "quem
 * precisa lembrar de escriturar?", pergunta ao banco "qual documento ainda não
 * tem partida?". A resposta não depende de ninguém ter lembrado de nada.
 *
 * Os ganchos em linha continuam existindo — eles é que mantêm o razão vivo em
 * tempo real. Esta varredura é o que garante que ele fique correto.
 */

/** Documento sem a partida que deveria ter. */
export interface Pendencia {
  tipo: 'financial_entry' | 'tax_guide' | 'profit_distribution';
  id: string;
  descricao: string;
  /** Qual fato contábil está faltando. */
  faltando: 'ACCRUAL' | 'SETTLEMENT';
}

/**
 * Lista os documentos que deveriam ter partida e não têm.
 *
 * Um documento pago precisa de duas — reconhecimento e baixa — e é comum ter a
 * primeira e não a segunda: o lançamento foi escriturado quando criado e
 * depois marcado como pago por um caminho que não escriturou a baixa.
 */
export async function listarPendencias(
  tx: DbHandle,
  companyId: string,
  limite = 500,
): Promise<Pendencia[]> {
  const rows = await tx.execute(sql`
    WITH partidas AS (
      SELECT source::text AS source, source_id, event::text AS event
      FROM journal_entry
      WHERE company_id = ${companyId} AND reversed_by IS NULL AND source_id IS NOT NULL
    )
    -- Lançamentos financeiros: reconhecimento
    SELECT 'financial_entry' AS tipo, e.id::text AS id, e.description AS descricao, 'ACCRUAL' AS faltando
    FROM financial_entry e
    WHERE e.company_id = ${companyId}
      AND e.status <> 'CANCELED'
      AND e.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM partidas p
        WHERE p.source = 'FINANCIAL_ENTRY' AND p.source_id = e.id AND p.event = 'ACCRUAL')

    UNION ALL
    -- Lançamentos financeiros: baixa dos que já foram pagos
    SELECT 'financial_entry', e.id::text, e.description, 'SETTLEMENT'
    FROM financial_entry e
    WHERE e.company_id = ${companyId}
      AND e.status = 'PAID'
      AND e.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM partidas p
        WHERE p.source = 'FINANCIAL_ENTRY' AND p.source_id = e.id AND p.event = 'SETTLEMENT')

    UNION ALL
    SELECT 'tax_guide', g.id::text, g.tax_name, 'ACCRUAL'
    FROM tax_guide g
    WHERE g.company_id = ${companyId}
      AND NOT EXISTS (
        SELECT 1 FROM partidas p
        WHERE p.source = 'TAX_GUIDE' AND p.source_id = g.id AND p.event = 'ACCRUAL')

    UNION ALL
    SELECT 'tax_guide', g.id::text, g.tax_name, 'SETTLEMENT'
    FROM tax_guide g
    WHERE g.company_id = ${companyId}
      AND g.status = 'PAID'
      AND NOT EXISTS (
        SELECT 1 FROM partidas p
        WHERE p.source = 'TAX_GUIDE' AND p.source_id = g.id AND p.event = 'SETTLEMENT')


    UNION ALL
    SELECT 'profit_distribution', d.id::text, 'Distribuição ' || d.partner_name, 'ACCRUAL'
    FROM profit_distribution d
    WHERE d.company_id = ${companyId}
      AND NOT EXISTS (
        SELECT 1 FROM partidas p
        WHERE p.source = 'PROFIT_DISTRIBUTION' AND p.source_id = d.id AND p.event = 'ACCRUAL')

    LIMIT ${limite}
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    tipo: String(r.tipo) as Pendencia['tipo'],
    id: String(r.id),
    descricao: String(r.descricao ?? ''),
    faltando: String(r.faltando) as Pendencia['faltando'],
  }));
}

export interface VarreduraResult extends EscrituracaoResult {
  pendenciasEncontradas: number;
}

/**
 * Escritura tudo que está pendente numa empresa.
 *
 * Como cada função de escrituração é idempotente, não importa que a pendência
 * de SETTLEMENT traga de volta um documento cujo ACCRUAL já existe: a segunda
 * partida bate na chave única e é contada como "já existia".
 */
export async function escriturarPendentes(
  tx: DbHandle,
  companyId: string,
  opts: PostOptions = {},
): Promise<VarreduraResult> {
  const pendencias = await listarPendencias(tx, companyId);

  const total: VarreduraResult = {
    pendenciasEncontradas: pendencias.length,
    gravadas: 0,
    jaExistiam: 0,
    ignorados: [],
    erros: [],
  };
  if (!pendencias.length) return total;

  // O plano só é garantido quando há trabalho — evita uma escrita por
  // varredura em empresa que não tem nada pendente.
  await ensureChartOfAccounts(tx, companyId);
  const o: PostOptions = { ...opts, accountMap: await loadAccountMap(tx, companyId) };

  // Um documento pode aparecer duas vezes (falta ACCRUAL e SETTLEMENT); a
  // função de escrituração já trata os dois fatos de uma vez.
  const vistos = new Set<string>();

  for (const p of pendencias) {
    const chave = `${p.tipo}/${p.id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const r =
      p.tipo === 'financial_entry'
        ? await escriturarLancamento(tx, companyId, p.id, o)
        : p.tipo === 'tax_guide'
          ? await escriturarGuia(tx, companyId, p.id, o)
          : await escriturarDistribuicao(tx, companyId, p.id, o);

    total.gravadas += r.gravadas;
    total.jaExistiam += r.jaExistiam;
    total.ignorados.push(...r.ignorados);
    total.erros.push(...r.erros);
  }

  return total;
}

/** Empresas com pelo menos uma pendência — para a varredura em massa. */
export async function companiesComPendencia(tx: DbHandle): Promise<string[]> {
  const rows = await tx.execute(sql`
    SELECT DISTINCT e.company_id::text AS company_id
    FROM financial_entry e
    WHERE e.status <> 'CANCELED' AND e.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM journal_entry j
        WHERE j.company_id = e.company_id AND j.source = 'FINANCIAL_ENTRY'
          AND j.source_id = e.id AND j.event = 'ACCRUAL' AND j.reversed_by IS NULL)
    UNION
    SELECT DISTINCT g.company_id::text
    FROM tax_guide g
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_entry j
      WHERE j.company_id = g.company_id AND j.source = 'TAX_GUIDE'
        AND j.source_id = g.id AND j.event = 'ACCRUAL' AND j.reversed_by IS NULL)
    UNION
    SELECT DISTINCT d.company_id::text
    FROM profit_distribution d
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_entry j
      WHERE j.company_id = d.company_id AND j.source = 'PROFIT_DISTRIBUTION'
        AND j.source_id = d.id AND j.event = 'ACCRUAL' AND j.reversed_by IS NULL)
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => String(r.company_id));
}
