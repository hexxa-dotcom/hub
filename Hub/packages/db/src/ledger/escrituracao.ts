import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { financialEntry, category } from '../schema/finance';
import { taxGuide, profitDistribution } from '../schema/accounting';
import {
  accrueFinancialEntry,
  settleFinancialEntry,
  accrueTaxGuide,
  settleTaxGuide,
  accrueProfitDistribution,
  settleProfitDistribution,
} from '@hexxa/core';
import type { JournalDraft } from '@hexxa/core';
import {
  ensureChartOfAccounts,
  loadAccountMap,
  postJournal,
  reverseJournal,
  type PostOptions,
} from './repository';
import { journalEntry } from '../schema/ledger';

/**
 * ESCRITURAÇÃO — liga os documentos que já existem no Hub às regras de
 * lançamento.
 *
 * Cada função aqui lê um documento, monta os rascunhos de partida que ele
 * gera e grava. Um documento pode gerar mais de uma partida: uma conta a
 * receber gera o reconhecimento da receita (ACCRUAL) e, se já foi paga, a
 * baixa (SETTLEMENT). São fatos contábeis distintos, em meses possivelmente
 * distintos — por isso são partidas distintas, e não uma só.
 */

export interface EscrituracaoResult {
  gravadas: number;
  jaExistiam: number;
  /** Documento que não escritura por dado inválido — não é falha nossa. */
  ignorados: { documento: string; motivo: string }[];
  erros: { documento: string; motivo: string }[];
}

const vazio = (): EscrituracaoResult => ({ gravadas: 0, jaExistiam: 0, ignorados: [], erros: [] });

function somar(acc: EscrituracaoResult, outro: EscrituracaoResult): EscrituracaoResult {
  return {
    gravadas: acc.gravadas + outro.gravadas,
    jaExistiam: acc.jaExistiam + outro.jaExistiam,
    ignorados: [...acc.ignorados, ...outro.ignorados],
    erros: [...acc.erros, ...outro.erros],
  };
}

/**
 * Rascunho sob demanda. A regra de lançamento é chamada DENTRO do try de
 * `gravarLote`, e não na montagem da lista — na primeira versão ela era
 * avaliada antes, e um único lançamento inválido derrubava o backfill inteiro,
 * exatamente a falha que o isolamento por documento existia para evitar.
 */
type DraftThunk = { documento: string; montar: () => JournalDraft };

/**
 * Grava uma lista de rascunhos, isolando a falha de cada um.
 *
 * Um documento que não escritura não pode derrubar o lote: num backfill de
 * anos de histórico a chance de haver registro estranho é alta, e perder o
 * trabalho todo por causa dele é pior que terminar com pendências nomeadas.
 */
async function gravarLote(
  tx: DbHandle,
  companyId: string,
  drafts: DraftThunk[],
  opts: PostOptions,
): Promise<EscrituracaoResult> {
  const out = vazio();
  for (const { documento, montar } of drafts) {
    try {
      const r = await postJournal(tx, companyId, montar(), opts);
      if (r.jaExistia) out.jaExistiam++;
      else out.gravadas++;
    } catch (err) {
      out.erros.push({
        documento,
        motivo: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

/* ── Lançamentos financeiros ───────────────────────────────────────────── */

/**
 * Escritura um lançamento financeiro. Chame depois de criar, e de novo depois
 * de marcar como pago — a segunda chamada só acrescenta a baixa, porque o
 * reconhecimento já terá a chave de idempotência ocupada.
 */
export async function escriturarLancamento(
  tx: DbHandle,
  companyId: string,
  entryId: string,
  opts: PostOptions = {},
): Promise<EscrituracaoResult> {
  const [row] = await tx
    .select({
      e: financialEntry,
      /** Conta contábil da categoria gerencial — o de-para do Anexo 7. */
      accountingCode: category.accountingCode,
    })
    .from(financialEntry)
    .leftJoin(category, eq(category.id, financialEntry.categoryId))
    .where(and(eq(financialEntry.id, entryId), eq(financialEntry.companyId, companyId)));

  if (!row) return { ...vazio(), erros: [{ documento: entryId, motivo: 'Lançamento não encontrado.' }] };
  return escriturarLinhaFinanceira(tx, companyId, row.e, row.accountingCode, opts);
}

type FinancialRow = typeof financialEntry.$inferSelect;

async function escriturarLinhaFinanceira(
  tx: DbHandle,
  companyId: string,
  e: FinancialRow,
  accountingCode: string | null,
  opts: PostOptions,
): Promise<EscrituracaoResult> {
  // Cancelado não gera partida. Se já tiver sido escriturado antes do
  // cancelamento, a correção é estorno explícito — nunca a ausência silenciosa
  // de lançamento.
  if (e.status === 'CANCELED') return vazio();

  // Valor zero não é fato contábil — é artefato de dado. Escriturá-lo seria
  // impossível de qualquer forma (a linha exige valor positivo), e deixá-lo
  // como "erro" esconderia os erros de verdade no meio do ruído. Vira
  // pendência nomeada, para que a origem seja corrigida na fonte.
  if (Number(e.amount) <= 0) {
    return {
      ...vazio(),
      ignorados: [
        {
          documento: `financial_entry/${e.id}`,
          motivo: `Valor zerado ou negativo (${e.amount}) — "${e.description.slice(0, 60)}"`,
        },
      ],
    };
  }

  const doc = {
    id: e.id,
    type: e.type,
    description: e.description,
    amount: Number(e.amount),
    originalAmount: e.originalAmount === null ? null : Number(e.originalAmount),
    interest: e.interest === null ? null : Number(e.interest),
    discount: e.discount === null ? null : Number(e.discount),
    dueDate: e.dueDate,
    referenceMonth: e.referenceMonth,
    paidAt: e.paidAt,
    partnerId: e.partnerId,
    costCenterId: e.costCenterId,
    resultAccountCode: accountingCode,
    source: e.source,
  };

  const reconhecimento = await gravarLote(
    tx, companyId,
    [{ documento: `financial_entry/${e.id}`, montar: () => accrueFinancialEntry(doc) }],
    opts,
  );

  /**
   * A baixa só vai se o reconhecimento foi.
   *
   * `gravarLote` isola a falha de cada rascunho, e isso é certo para um lote
   * de documentos independentes — mas reconhecimento e baixa do MESMO
   * lançamento não são independentes. Gravar a baixa sozinha debita
   * Fornecedores que nunca foi creditado, e o passivo fica com saldo devedor:
   * um número que não existe no mundo e que o razão aceita, porque cada
   * partida fecha isoladamente.
   *
   * Aparecia quando o lançamento não tinha categoria: o reconhecimento era
   * recusado por falta de conta contábil — corretamente — e a baixa passava
   * assim mesmo. Ficou raro enquanto a baixa era manual; virou rotina quando
   * o extrato bancário passou a baixar sozinho o que casa.
   */
  if (reconhecimento.erros.length) return reconhecimento;
  if (e.status !== 'PAID') return reconhecimento;

  const baixa = await gravarLote(
    tx, companyId,
    [{ documento: `financial_entry/${e.id}#baixa`, montar: () => settleFinancialEntry(doc) }],
    opts,
  );
  return somar(reconhecimento, baixa);
}

/* ── Guias de imposto ──────────────────────────────────────────────────── */

export async function escriturarGuia(
  tx: DbHandle,
  companyId: string,
  guiaId: string,
  opts: PostOptions = {},
): Promise<EscrituracaoResult> {
  const [g] = await tx
    .select()
    .from(taxGuide)
    .where(and(eq(taxGuide.id, guiaId), eq(taxGuide.companyId, companyId)));
  if (!g) return { ...vazio(), erros: [{ documento: guiaId, motivo: 'Guia não encontrada.' }] };
  return escriturarLinhaGuia(tx, companyId, g, opts);
}

type GuiaRow = typeof taxGuide.$inferSelect;

/**
 * Repartição do DAS por tributo, da tabela do Anexo em que a empresa está.
 *
 * Vem de `tax_annex_bracket.partition_distribution`, que é a tabela da
 * LC 123 — não é estimativa nossa, é a lei. Sem ela a guia inteira viraria
 * dedução da receita bruta, que a ITG 1000 não permite.
 *
 * Devolve `null` fora do Simples ou quando a faixa não tem repartição
 * cadastrada; aí a regra de lançamento cai numa linha só, de propósito.
 */
async function reparticaoDoDas(
  tx: DbHandle,
  companyId: string,
  taxName: string,
  referenceMonth: string,
): Promise<Record<string, number> | null> {
  if (!/simples|\bdas\b/i.test(taxName)) return null;

  const [row] = (await tx.execute(sql`
    SELECT b.partition_distribution AS p
    FROM tax_history h
    JOIN tax_annex_bracket b
      ON b.annex = split_part(split_part(h.tax_bracket, ' - ', 1), ' ', 2)
     AND b.bracket = (split_part(h.tax_bracket, 'Faixa ', 2))::int
    WHERE h.company_id = ${companyId}
      AND h.reference_month = ${referenceMonth.slice(0, 7)}
    LIMIT 1
  `)) as unknown as { p: Record<string, number> | null }[];

  const p = row?.p;
  return p && Object.keys(p).length ? p : null;
}

async function escriturarLinhaGuia(
  tx: DbHandle,
  companyId: string,
  g: GuiaRow,
  opts: PostOptions,
): Promise<EscrituracaoResult> {
  const doc = {
    id: g.id,
    taxName: g.taxName,
    amount: Number(g.amount),
    dueDate: g.dueDate,
    referenceMonth: g.referenceMonth,
    // `tax_guide` não guarda a data do pagamento, só o status. Usar o
    // vencimento como data da baixa é a melhor aproximação disponível — e
    // fica registrado aqui para que a lacuna seja conhecida em vez de virar
    // um número inexplicável no balancete.
    paidAt: g.status === 'PAID' ? g.dueDate : null,
    reparticao: await reparticaoDoDas(tx, companyId, g.taxName, g.referenceMonth),
  };

  const drafts: DraftThunk[] = [
    { documento: `tax_guide/${g.id}`, montar: () => accrueTaxGuide(doc) },
  ];
  if (g.status === 'PAID') {
    drafts.push({ documento: `tax_guide/${g.id}#baixa`, montar: () => settleTaxGuide(doc) });
  }
  return gravarLote(tx, companyId, drafts, opts);
}

/* ── Folha ──────────────────────────────────────────────────────────────
 *
 * NÃO existe `escriturarFolha`, e isso é deliberado.
 *
 * `generatePayslipsAction` grava DOIS registros para o mesmo fato: um
 * `payslip` (documento de RH) e um `financial_entry` com `source = 'PAYROLL'`
 * (a obrigação a pagar). Escriturar os dois lançaria a despesa de pessoal em
 * dobro — o razão fecharia, porque cada partida fecha isoladamente, e ainda
 * assim a DRE estaria com o custo de folha duplicado.
 *
 * Então a folha é escriturada pelo `financial_entry`, como qualquer outra
 * obrigação, e `contaPorOrigem` usa `source = 'PAYROLL'` para mandá-la à conta
 * de despesa com pessoal em vez de "a classificar". Um fato, uma partida.
 *
 * É a mesma regra da NFSe: quando há documento especializado e lançamento
 * financeiro para o mesmo fato, o lançamento financeiro é o veículo da
 * escrituração e o documento especializado só informa a conta.
 */

/* ── Distribuição de lucros ────────────────────────────────────────────── */

export async function escriturarDistribuicao(
  tx: DbHandle,
  companyId: string,
  distId: string,
  opts: PostOptions = {},
): Promise<EscrituracaoResult> {
  const [d] = await tx
    .select()
    .from(profitDistribution)
    .where(and(eq(profitDistribution.id, distId), eq(profitDistribution.companyId, companyId)));
  if (!d) return { ...vazio(), erros: [{ documento: distId, motivo: 'Distribuição não encontrada.' }] };
  return escriturarLinhaDistribuicao(tx, companyId, d, opts);
}

type DistRow = typeof profitDistribution.$inferSelect;

async function escriturarLinhaDistribuicao(
  tx: DbHandle,
  companyId: string,
  d: DistRow,
  opts: PostOptions,
): Promise<EscrituracaoResult> {
  const doc = {
    id: d.id,
    partnerName: d.partnerName,
    amount: Number(d.amount),
    distributedAt: d.distributedAt,
  };
  // A tabela registra distribuição já feita: reconhecimento e pagamento
  // acontecem no mesmo ato, então as duas partidas saem juntas.
  return gravarLote(
    tx,
    companyId,
    [
      { documento: `profit_distribution/${d.id}`, montar: () => accrueProfitDistribution(doc) },
      {
        documento: `profit_distribution/${d.id}#pagamento`,
        montar: () => settleProfitDistribution(doc),
      },
    ],
    opts,
  );
}

/* ── Backfill ──────────────────────────────────────────────────────────── */

export interface BackfillResult extends EscrituracaoResult {
  planoDeContas: { criadas: number; total: number };
  porDocumento: Record<
    string,
    { gravadas: number; jaExistiam: number; ignorados: number; erros: number }
  >;
}

/**
 * Escritura todo o histórico de uma empresa.
 *
 * Roda o plano de contas primeiro — sem ele toda partida falharia com
 * `UnknownAccountError` — e depois varre os documentos em ordem cronológica,
 * para que o razão conte a história na sequência em que ela aconteceu.
 *
 * É idempotente: rodar duas vezes não duplica nada, graças à chave
 * (documento, fato) do índice único. Isso é deliberado — um backfill de
 * histórico longo tende a ser interrompido e retomado.
 */
export async function backfillCompany(
  tx: DbHandle,
  companyId: string,
  opts: PostOptions = {},
): Promise<BackfillResult> {
  const planoDeContas = await ensureChartOfAccounts(tx, companyId);
  const accountMap = await loadAccountMap(tx, companyId);
  const o: PostOptions = { ...opts, accountMap };

  const porDocumento: BackfillResult['porDocumento'] = {};
  let total = vazio();

  const registrar = (nome: string, r: EscrituracaoResult) => {
    porDocumento[nome] = {
      gravadas: r.gravadas,
      jaExistiam: r.jaExistiam,
      ignorados: r.ignorados.length,
      erros: r.erros.length,
    };
    total = somar(total, r);
  };

  /* Lançamentos financeiros */
  const lancamentos = await tx
    .select({ e: financialEntry, accountingCode: category.accountingCode })
    .from(financialEntry)
    .leftJoin(category, eq(category.id, financialEntry.categoryId))
    .where(eq(financialEntry.companyId, companyId))
    .orderBy(financialEntry.referenceMonth, financialEntry.dueDate);

  let acc = vazio();
  for (const row of lancamentos) {
    acc = somar(acc, await escriturarLinhaFinanceira(tx, companyId, row.e, row.accountingCode, o));
  }
  registrar('financial_entry', acc);

  /* Guias */
  const guias = await tx
    .select()
    .from(taxGuide)
    .where(eq(taxGuide.companyId, companyId))
    .orderBy(taxGuide.referenceMonth);

  acc = vazio();
  for (const g of guias) acc = somar(acc, await escriturarLinhaGuia(tx, companyId, g, o));
  registrar('tax_guide', acc);

  /* Distribuições */
  const distribuicoes = await tx
    .select()
    .from(profitDistribution)
    .where(eq(profitDistribution.companyId, companyId))
    .orderBy(profitDistribution.distributedAt);

  acc = vazio();
  for (const d of distribuicoes) {
    acc = somar(acc, await escriturarLinhaDistribuicao(tx, companyId, d, o));
  }
  registrar('profit_distribution', acc);

  return { ...total, planoDeContas, porDocumento };
}

/** Empresas com pelo menos um documento a escriturar — para o backfill em massa. */
export async function companiesComMovimento(tx: DbHandle): Promise<string[]> {
  const rows = await tx.execute(sql`
    SELECT DISTINCT company_id FROM financial_entry
    UNION
    SELECT DISTINCT company_id FROM tax_guide
    UNION
    SELECT DISTINCT company_id FROM profit_distribution
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => String(r.company_id));
}

/* ── Reescrituração ────────────────────────────────────────────────────── */

/**
 * Refaz a escrituração de um lançamento cuja conta contábil mudou.
 *
 * Existe por causa da classificação: quando um agente (ou uma pessoa) atribui
 * categoria a um lançamento que estava sem, a partida já gravada aponta para
 * "Despesas Diversas a Classificar". Só atualizar a categoria deixaria o
 * balancete igual — a informação nova não chegaria ao razão, e a tela diria
 * uma coisa enquanto a contabilidade diz outra.
 *
 * Correção é por ESTORNO, nunca por alteração: a partida errada continua no
 * razão, marcada como estornada, com a partida espelho ao lado. É o que
 * permite responder depois "esta despesa estava classificada errado até o dia
 * tal" — que é precisamente o tipo de pergunta que aparece quando quem
 * classificou foi uma IA.
 */
export async function reescriturarLancamento(
  tx: DbHandle,
  companyId: string,
  entryId: string,
  motivo: string,
  opts: PostOptions = {},
): Promise<EscrituracaoResult & { estornadas: number }> {
  const estornadas = await estornarVivas(tx, companyId, 'FINANCIAL_ENTRY', entryId, motivo, opts);
  // Com as antigas marcadas REVERSED, a chave de idempotência
  // (empresa, documento, fato) volta a ficar livre — é por isso que o índice
  // único exclui REVERSED. Sem isso, reescriturar seria impossível.
  const r = await escriturarLancamento(tx, companyId, entryId, opts);
  return { ...r, estornadas };
}

/**
 * Refaz a escrituração de uma guia cujo valor mudou.
 *
 * O caso que a exige é a mão de volta do OneFlow: a apuração oficial pode
 * divergir da guia que o Hub já tinha (retificação, competência reaberta), e
 * lá é que está a verdade fiscal. Mesma regra da reclassificação — estorno,
 * nunca alteração.
 */
export async function reescriturarGuia(
  tx: DbHandle,
  companyId: string,
  guiaId: string,
  motivo: string,
  opts: PostOptions = {},
): Promise<EscrituracaoResult & { estornadas: number }> {
  const estornadas = await estornarVivas(tx, companyId, 'TAX_GUIDE', guiaId, motivo, opts);
  const r = await escriturarGuia(tx, companyId, guiaId, opts);
  return { ...r, estornadas };
}

/**
 * Anula no razão tudo o que uma guia lançou — por estorno.
 *
 * Existe para a provisão de DAS que a apuração oficial desmente: o fechamento
 * provisionou imposto pela alíquota efetiva, e o OneFlow apurou zero. Sem
 * isto, a despesa estimada ficava no razão para sempre, porque a volta
 * pulava a apuração zerada sem olhar se havia algo a desfazer.
 */
export async function anularGuia(
  tx: DbHandle,
  companyId: string,
  guiaId: string,
  motivo: string,
  opts: PostOptions = {},
): Promise<number> {
  return estornarVivas(tx, companyId, 'TAX_GUIDE', guiaId, motivo, opts);
}

/** Estorna as partidas vivas de um documento. Devolve quantas. */
async function estornarVivas(
  tx: DbHandle,
  companyId: string,
  source: typeof journalEntry.$inferSelect.source,
  sourceId: string,
  motivo: string,
  opts: PostOptions,
): Promise<number> {
  const vivas = await tx
    .select({ id: journalEntry.id })
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.companyId, companyId),
        eq(journalEntry.source, source),
        eq(journalEntry.sourceId, sourceId),
        eq(journalEntry.status, 'POSTED'),
        sql`${journalEntry.reversedBy} IS NULL`,
        // SÓ os fatos derivados. Um espelho de estorno não é fato a
        // re-derivar: estorná-lo desfaria a correção anterior e, pior,
        // criaria um novo espelho que a próxima reclassificação estornaria de
        // novo. A primeira versão fazia isso e produziu uma cascata de
        // "Estorno — Estorno — Estorno" com 13 partidas para um lançamento.
        sql`${journalEntry.event} IN ('ACCRUAL', 'SETTLEMENT')`,
      ),
    );

  const hoje = new Date().toISOString().slice(0, 10);
  let estornadas = 0;
  for (const v of vivas) {
    await reverseJournal(tx, companyId, v.id, motivo, hoje, opts);
    estornadas++;
  }
  return estornadas;
}
