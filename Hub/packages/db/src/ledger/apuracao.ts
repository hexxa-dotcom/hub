import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { journalEntry } from '../schema/ledger';
import { ACCOUNTS, assertBalanced, type DraftLine, type JournalDraft } from '@hexxa/core';
import { loadAccountMap, postJournal, reverseJournal, type PostOptions } from './repository';

/**
 * APURAÇÃO DO RESULTADO DO EXERCÍCIO.
 *
 * As contas de resultado — receita e despesa — acumulam durante o período e
 * então precisam ser zeradas contra o patrimônio líquido. Sem isso o balanço
 * não fecha como balanço: o ativo não bate com passivo mais PL, porque o lucro
 * ficou preso nas contas de resultado em vez de virar patrimônio.
 *
 * É o que estava faltando e aparecia como sintoma: `Lucros Acumulados` em
 * −R$ 42.000 na Zap Vida. As distribuições foram debitadas do PL e o lucro que
 * as sustentava nunca foi transferido para lá. O número não estava errado —
 * estava incompleto, que num balanço dá no mesmo.
 *
 * A partida tem três movimentos, nesta ordem:
 *
 *   1. Zera cada conta de RECEITA contra "Resultado do Exercício"
 *   2. Zera cada conta de DESPESA contra "Resultado do Exercício"
 *   3. Transfere o saldo de "Resultado do Exercício" para "Lucros Acumulados"
 *
 * Os três num único lançamento, porque são um fato contábil só: o exercício
 * apurado. Partir em três deixaria estados intermediários em que o balanço não
 * fecha, e alguém leria um deles.
 */

export interface ApuracaoResult {
  /** `null` quando não havia resultado a apurar. */
  journalEntryId: string | null;
  receitaTotal: number;
  despesaTotal: number;
  resultado: number;
  /** `true` quando já existia apuração para o período e nada foi feito. */
  jaApurado: boolean;
  contasZeradas: number;
}

/** Saldo de cada conta de resultado ainda não apurada, até o mês dado. */
async function saldosDeResultado(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
): Promise<{ code: string; tipo: 'RECEITA' | 'DESPESA'; saldo: number }[]> {
  const rows = await tx.execute(sql`
    SELECT
      a.code,
      a.type::text AS tipo,
      COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0) AS saldo_devedor
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    JOIN chart_of_account a ON a.id = l.account_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED'
      AND j.reference_month <= ${ateMes}::date
      AND a.type IN ('RECEITA', 'DESPESA')
    GROUP BY a.code, a.type
    HAVING COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0) <> 0
    ORDER BY a.code
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    code: String(r.code),
    tipo: String(r.tipo) as 'RECEITA' | 'DESPESA',
    // Saldo devedor: positivo = débito líquido. Despesa fica positiva,
    // receita fica negativa — e é esse sinal que diz de que lado zerar.
    saldo: Number(r.saldo_devedor ?? 0),
  }));
}

/** Apuração já lançada para este período? */
async function apuracaoExistente(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ id: journalEntry.id })
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.companyId, companyId),
        eq(journalEntry.source, 'CLOSING'),
        eq(journalEntry.referenceMonth, ateMes),
        eq(journalEntry.status, 'POSTED'),
        sql`${journalEntry.reversedBy} IS NULL`,
      ),
    );
  return row?.id ?? null;
}

/**
 * Apura o resultado acumulado até o mês dado.
 *
 * Idempotente por verificação explícita, e não pela chave única do índice: a
 * apuração não tem documento de origem (`sourceId` é nulo), então a chave de
 * idempotência — que exige `source_id IS NOT NULL` — não a alcança. Checar
 * antes é o jeito honesto; um UUID sintético para fingir um documento que não
 * existe seria pior.
 */
export async function apurarResultado(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
  opts: PostOptions = {},
): Promise<ApuracaoResult> {
  const existente = await apuracaoExistente(tx, companyId, ateMes);
  if (existente) {
    return {
      journalEntryId: existente,
      receitaTotal: 0,
      despesaTotal: 0,
      resultado: 0,
      jaApurado: true,
      contasZeradas: 0,
    };
  }

  const saldos = await saldosDeResultado(tx, companyId, ateMes);
  if (!saldos.length) {
    return {
      journalEntryId: null,
      receitaTotal: 0,
      despesaTotal: 0,
      resultado: 0,
      jaApurado: false,
      contasZeradas: 0,
    };
  }

  const lines: DraftLine[] = [];
  let receitaTotal = 0;
  let despesaTotal = 0;

  for (const s of saldos) {
    // Zerar é lançar o contrário do saldo. Receita tem saldo credor (devedor
    // negativo): zera com débito. Despesa é o inverso.
    const valor = Math.abs(s.saldo);
    if (valor < 0.005) continue;

    if (s.saldo < 0) {
      lines.push({
        accountCode: s.code,
        direction: 'DEBIT',
        amount: valor,
        lineMemo: 'Encerramento da conta de resultado',
      });
      receitaTotal += valor;
    } else {
      lines.push({
        accountCode: s.code,
        direction: 'CREDIT',
        amount: valor,
        lineMemo: 'Encerramento da conta de resultado',
      });
      despesaTotal += valor;
    }
  }

  const resultado = Math.round((receitaTotal - despesaTotal) * 100) / 100;

  // A contrapartida de tudo vai direto a Lucros Acumulados. "Resultado do
  // Exercício" existe no plano como conta de passagem, mas usá-la aqui criaria
  // uma linha que nasce e morre na mesma partida — informação nenhuma, e mais
  // uma conta com movimento para quem lê o balancete decifrar.
  if (Math.abs(resultado) >= 0.005) {
    lines.push({
      accountCode: ACCOUNTS.LUCROS_ACUMULADOS,
      direction: resultado > 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(resultado),
      lineMemo: resultado > 0 ? 'Lucro do período' : 'Prejuízo do período',
    });
  }

  if (lines.length < 2) {
    return {
      journalEntryId: null,
      receitaTotal,
      despesaTotal,
      resultado,
      jaApurado: false,
      contasZeradas: 0,
    };
  }

  const draft: JournalDraft = assertBalanced({
    entryDate: ultimoDiaDoMes(ateMes),
    referenceMonth: ateMes,
    memo: `Apuração do resultado até ${ateMes.slice(0, 7)}`,
    source: 'CLOSING',
    sourceId: null,
    event: 'ADJUSTMENT',
    lines,
  });

  const r = await postJournal(tx, companyId, draft, opts);

  return {
    journalEntryId: r.journalEntryId,
    receitaTotal,
    despesaTotal,
    resultado,
    jaApurado: false,
    contasZeradas: saldos.length,
  };
}

/**
 * Desfaz a apuração de um período.
 *
 * Existe porque a apuração é sensível à ordem: escriturar um lançamento
 * atrasado de um mês já apurado deixaria o valor fora do resultado para
 * sempre. O caminho certo é estornar a apuração, escriturar, e apurar de novo
 * — e isso precisa ser uma operação de uma linha, ou ninguém faz.
 */
export async function estornarApuracao(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
  motivo: string,
  opts: PostOptions = {},
): Promise<string | null> {
  const existente = await apuracaoExistente(tx, companyId, ateMes);
  if (!existente) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const r = await reverseJournal(tx, companyId, existente, motivo, hoje, opts);
  return r.journalEntryId;
}

/** Reapura do zero: estorna a apuração do período, se houver, e refaz. */
export async function reapurarResultado(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
  motivo: string,
  opts: PostOptions = {},
): Promise<ApuracaoResult> {
  await estornarApuracao(tx, companyId, ateMes, motivo, opts);
  return apurarResultado(tx, companyId, ateMes, opts);
}

/** '2026-09-01' → '2026-09-30'. A apuração é lançada no último dia. */
function ultimoDiaDoMes(primeiroDia: string): string {
  const [ano, mes] = primeiroDia.split('-').map(Number);
  const d = new Date(Date.UTC(ano!, mes!, 0));
  return d.toISOString().slice(0, 10);
}

/** Saldo do PL e conferência do balanço: Ativo = Passivo + PL. */
export async function conferirBalanco(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
): Promise<{ ativo: number; passivo: number; pl: number; resultado: number; fecha: boolean; diff: number }> {
  const rows = (await tx.execute(sql`
    SELECT
      a.type::text AS tipo,
      COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0) AS saldo_devedor
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    JOIN chart_of_account a ON a.id = l.account_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED'
      AND j.reference_month <= ${ateMes}::date
    GROUP BY a.type
  `)) as unknown as Record<string, unknown>[];

  const por = (t: string) => {
    const r = rows.find((x) => String(x.tipo) === t);
    return r ? Number(r.saldo_devedor ?? 0) : 0;
  };

  // Devedor positivo: ativo e despesa. Credor: invertido para leitura natural.
  const ativo = por('ATIVO');
  const passivo = -por('PASSIVO');
  const pl = -por('PATRIMONIO_LIQUIDO');
  const resultado = -por('RECEITA') - por('DESPESA');

  // Antes da apuração o resultado ainda está fora do PL — por isso entra na
  // conta. Depois dela, `resultado` é zero e a identidade continua valendo.
  const diff = Math.round((ativo - (passivo + pl + resultado)) * 100) / 100;
  return { ativo, passivo, pl, resultado, fecha: diff === 0, diff };
}
