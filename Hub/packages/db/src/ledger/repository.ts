import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { chartOfAccount, journalEntry, ledgerLine } from '../schema/ledger';
import { category } from '../schema/finance';
import {
  DEFAULT_CHART,
  deriveResultAccounts,
  natureOf,
  parentCodeOf,
  type AccountSeed,
} from '@hexxa/core';
import type { JournalDraft } from '@hexxa/core';

/**
 * PERSISTÊNCIA DO RAZÃO.
 *
 * As regras de lançamento (`@hexxa/core/accounting`) são puras e produzem um
 * rascunho de partida; este módulo é o único lugar que grava esse rascunho.
 * A separação existe para que a regra contábil possa ser testada sem banco e
 * para que exista um único ponto por onde toda escrituração passa — humana ou
 * de agente.
 */

/** Conta citada por uma regra que não existe no plano da empresa. */
export class UnknownAccountError extends Error {
  constructor(public readonly code: string) {
    super(
      `Conta ${code} não existe no plano desta empresa. ` +
        `Rode ensureChartOfAccounts(companyId) antes de escriturar.`,
    );
    this.name = 'UnknownAccountError';
  }
}

/**
 * Semeia o plano de contas da empresa: o padrão ITG 1000 mais as contas de
 * resultado derivadas das categorias já cadastradas.
 *
 * Idempotente — pode rodar quantas vezes for preciso. Conta já existente é
 * ignorada, nunca sobrescrita: renomear uma conta em uso mudaria o rótulo de
 * lançamentos históricos que já foram entregues à contabilidade.
 */
export async function ensureChartOfAccounts(
  tx: DbHandle,
  companyId: string,
): Promise<{ criadas: number; total: number }> {
  const categorias = await tx
    .select({
      name: category.name,
      accountingCode: category.accountingCode,
      kind: category.kind,
    })
    .from(category)
    .where(eq(category.companyId, companyId));

  const derivadas = deriveResultAccounts(
    categorias.map((c) => ({
      name: c.name,
      accountingCode: c.accountingCode,
      kind: c.kind as 'INCOME' | 'EXPENSE',
    })),
  );

  const todas: AccountSeed[] = [...DEFAULT_CHART, ...derivadas];

  const rows = todas.map((a) => ({
    companyId,
    code: a.code,
    name: a.name,
    type: a.type,
    nature: natureOf(a.type),
    parentCode: parentCodeOf(a.code),
    analytical: a.analytical,
  }));

  const inseridas = await tx
    .insert(chartOfAccount)
    .values(rows)
    .onConflictDoNothing({ target: [chartOfAccount.companyId, chartOfAccount.code] })
    .returning({ id: chartOfAccount.id });

  return { criadas: inseridas.length, total: rows.length };
}

/** Mapa código → id, carregado uma vez por lote de escrituração. */
export async function loadAccountMap(
  tx: DbHandle,
  companyId: string,
): Promise<Map<string, string>> {
  const contas = await tx
    .select({ id: chartOfAccount.id, code: chartOfAccount.code })
    .from(chartOfAccount)
    .where(eq(chartOfAccount.companyId, companyId));
  return new Map(contas.map((c) => [c.code, c.id]));
}

export interface PostOptions {
  /** Usuário que lançou. Null quando a autoria é de um agente. */
  createdByUserId?: string | null;
  /** Execução de agente responsável pela partida (item 3 do plano). */
  agentRunId?: string | null;
  /** Mapa código→id já carregado, para escriturar em lote sem reconsultar. */
  accountMap?: Map<string, string>;
}

export interface PostResult {
  journalEntryId: string;
  /**
   * `true` quando a partida já existia para este (documento, fato) e nada foi
   * gravado. É o caminho normal de uma reexecução — não um erro.
   */
  jaExistia: boolean;
}

/**
 * Grava uma partida e a publica.
 *
 * Fluxo: insere o cabeçalho como DRAFT, insere as linhas, publica. A ordem
 * importa — os triggers só exigem equilíbrio em partida POSTED, então o
 * cabeçalho precisa nascer DRAFT para que as linhas possam entrar uma a uma.
 *
 * Idempotência: se já existe partida viva para o mesmo (documento, fato), o
 * índice único rejeita e esta função devolve a partida existente em vez de
 * propagar o erro. É isso que torna seguro um agente repetir a tentativa
 * depois de uma falha parcial de rede.
 */
export async function postJournal(
  tx: DbHandle,
  companyId: string,
  draft: JournalDraft,
  opts: PostOptions = {},
): Promise<PostResult> {
  const contas = opts.accountMap ?? (await loadAccountMap(tx, companyId));

  // Resolve TODOS os códigos antes de gravar qualquer coisa: uma partida pela
  // metade, com o cabeçalho gravado e as linhas faltando, seria pior que erro.
  const linhas = draft.lines.map((l, i) => {
    const accountId = contas.get(l.accountCode);
    if (!accountId) throw new UnknownAccountError(l.accountCode);
    return {
      companyId,
      accountId,
      direction: l.direction,
      amount: l.amount.toFixed(2),
      sequence: i,
      lineMemo: l.lineMemo ?? null,
      partnerId: l.partnerId ?? null,
      costCenterId: l.costCenterId ?? null,
    };
  });

  const [cabecalho] = await tx
    .insert(journalEntry)
    .values({
      companyId,
      entryDate: draft.entryDate,
      referenceMonth: draft.referenceMonth,
      memo: draft.memo,
      source: draft.source,
      sourceId: draft.sourceId,
      event: draft.event,
      status: 'DRAFT',
      createdByUserId: opts.createdByUserId ?? null,
      agentRunId: opts.agentRunId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: journalEntry.id });

  if (!cabecalho) {
    const existente = await findJournalBySource(
      tx,
      companyId,
      draft.source,
      draft.sourceId,
      draft.event,
    );
    if (!existente) {
      // Conflito sem partida correspondente não deveria acontecer: significa
      // que a restrição violada foi outra. Melhor falhar alto do que devolver
      // um id inventado.
      throw new Error(
        `Conflito ao gravar partida ${draft.source}/${draft.event} sem partida existente correspondente.`,
      );
    }
    return { journalEntryId: existente, jaExistia: true };
  }

  await tx.insert(ledgerLine).values(linhas.map((l) => ({ ...l, journalEntryId: cabecalho.id })));

  await tx
    .update(journalEntry)
    .set({ status: 'POSTED', postedAt: new Date() })
    .where(eq(journalEntry.id, cabecalho.id));

  return { journalEntryId: cabecalho.id, jaExistia: false };
}

/** Partida viva de um documento para um fato contábil, se houver. */
export async function findJournalBySource(
  tx: DbHandle,
  companyId: string,
  source: JournalDraft['source'],
  sourceId: string | null,
  event: JournalDraft['event'],
): Promise<string | null> {
  if (!sourceId) return null;
  const [row] = await tx
    .select({ id: journalEntry.id })
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.companyId, companyId),
        eq(journalEntry.source, source),
        eq(journalEntry.sourceId, sourceId),
        eq(journalEntry.event, event),
        sql`${journalEntry.reversedBy} IS NULL`,
      ),
    );
  return row?.id ?? null;
}

/**
 * Estorna uma partida publicada: grava a partida espelho e liga a original a
 * ela por `reversedBy`. A original CONTINUA publicada — as duas ficam no razão
 * e se anulam.
 *
 * Correção é sempre assim, nunca por alteração — o histórico precisa continuar
 * contando o que aconteceu, inclusive o erro. Quando quem lançou foi um
 * agente, isso deixa de ser preferência contábil e vira requisito de
 * auditoria.
 */
export async function reverseJournal(
  tx: DbHandle,
  companyId: string,
  journalEntryId: string,
  motivo: string,
  data: string,
  opts: PostOptions = {},
): Promise<PostResult> {
  const [original] = await tx
    .select()
    .from(journalEntry)
    .where(and(eq(journalEntry.id, journalEntryId), eq(journalEntry.companyId, companyId)));

  if (!original) throw new Error(`Partida ${journalEntryId} não encontrada.`);
  if (original.status !== 'POSTED') {
    throw new Error(`Só partida publicada pode ser estornada (status atual: ${original.status}).`);
  }
  if (original.reversedBy) {
    throw new Error(`Partida ${journalEntryId} já foi estornada por ${original.reversedBy}.`);
  }

  const linhas = await tx
    .select()
    .from(ledgerLine)
    .where(eq(ledgerLine.journalEntryId, journalEntryId))
    .orderBy(ledgerLine.sequence);

  const contas = opts.accountMap ?? (await loadAccountMap(tx, companyId));
  const porId = new Map([...contas.entries()].map(([code, id]) => [id, code]));

  const [espelho] = await tx
    .insert(journalEntry)
    .values({
      companyId,
      entryDate: data,
      referenceMonth: `${data.slice(0, 7)}-01`,
      memo: `Estorno — ${original.memo} (${motivo})`,
      source: original.source,
      sourceId: original.sourceId,
      event: 'REVERSAL',
      status: 'DRAFT',
      createdByUserId: opts.createdByUserId ?? null,
      agentRunId: opts.agentRunId ?? null,
    })
    .returning({ id: journalEntry.id });

  await tx.insert(ledgerLine).values(
    linhas.map((l, i) => ({
      companyId,
      journalEntryId: espelho!.id,
      accountId: l.accountId,
      // Inverte o lado. O valor continua positivo — é o lado que carrega o
      // sinal, aqui como em qualquer outra partida.
      direction: l.direction === 'DEBIT' ? ('CREDIT' as const) : ('DEBIT' as const),
      amount: l.amount,
      sequence: i,
      lineMemo: porId.get(l.accountId) ? `Estorno de ${porId.get(l.accountId)}` : null,
      partnerId: l.partnerId,
      costCenterId: l.costCenterId,
    })),
  );

  await tx
    .update(journalEntry)
    .set({ status: 'POSTED', postedAt: new Date() })
    .where(eq(journalEntry.id, espelho!.id));

  // A original permanece POSTED. Partida publicada não se despublica: ela fica
  // no razão e a espelho ao lado a anula, somando zero. Marcá-la como REVERSED
  // a tirava do balancete, e o efeito do estorno era contado duas vezes — uma
  // pela remoção, outra pelo contra-lançamento.
  //
  // `reversedBy` é o marcador de que foi anulada, e é ele que libera a chave de
  // idempotência para uma nova escrituração do mesmo fato.
  await tx
    .update(journalEntry)
    .set({ reversedBy: espelho!.id })
    .where(eq(journalEntry.id, journalEntryId));

  return { journalEntryId: espelho!.id, jaExistia: false };
}

/* ══════════════════════════════════════════════════════════════════════════
   Leitura — balancete e conferências
   ══════════════════════════════════════════════════════════════════════════ */

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  nature: 'DEBIT' | 'CREDIT';
  debit: number;
  credit: number;
  /** Saldo com sinal na natureza da conta: positivo = saldo normal. */
  balance: number;
}

/**
 * Balancete de verificação até o fim de um mês (acumulado, não só o mês).
 *
 * `balance` já vem com o sinal ajustado pela natureza da conta — conta
 * devedora é débito menos crédito, credora é o inverso. Sem isso, toda tela
 * que consumir o balancete teria que reimplementar essa regra, e uma delas
 * acabaria implementando errado.
 */
export async function trialBalance(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
): Promise<TrialBalanceRow[]> {
  const rows = await tx.execute(sql`
    SELECT
      a.code, a.name, a.type::text AS type, a.nature::text AS nature,
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'DEBIT'),  0) AS debit,
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'CREDIT'), 0) AS credit
    FROM ledger_line l
    JOIN journal_entry  j ON j.id = l.journal_entry_id
    JOIN chart_of_account a ON a.id = l.account_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED'
      AND j.reference_month <= ${ateMes}::date
    GROUP BY a.code, a.name, a.type, a.nature
    HAVING COALESCE(SUM(l.amount), 0) <> 0
    ORDER BY a.code
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => {
    const debit = Number(r.debit ?? 0);
    const credit = Number(r.credit ?? 0);
    const nature = String(r.nature) as 'DEBIT' | 'CREDIT';
    return {
      code: String(r.code),
      name: String(r.name),
      type: String(r.type),
      nature,
      debit,
      credit,
      balance: nature === 'DEBIT' ? debit - credit : credit - debit,
    };
  });
}

/**
 * Confere se o razão fecha no período. Deve ser sempre `true` — os triggers
 * garantem isso partida a partida.
 *
 * Existe mesmo assim porque é a checagem que o agente de fechamento roda
 * antes de declarar um mês fechado: uma asserção barata sobre um invariante
 * que já deveria valer é exatamente o que detecta o dia em que ele deixou de
 * valer por um caminho que ninguém previu.
 */
export async function assertLedgerBalances(
  tx: DbHandle,
  companyId: string,
  ateMes: string,
): Promise<{ ok: boolean; debit: number; credit: number; diff: number }> {
  const [row] = (await tx.execute(sql`
    SELECT
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'DEBIT'),  0) AS debit,
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'CREDIT'), 0) AS credit
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED'
      AND j.reference_month <= ${ateMes}::date
  `)) as unknown as Record<string, unknown>[];

  const debit = Number(row?.debit ?? 0);
  const credit = Number(row?.credit ?? 0);
  const diff = Math.round((debit - credit) * 100) / 100;
  return { ok: diff === 0, debit, credit, diff };
}
