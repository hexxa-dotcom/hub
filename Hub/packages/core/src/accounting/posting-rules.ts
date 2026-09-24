import { ACCOUNTS } from './chart-of-accounts';

/**
 * REGRAS DE LANÇAMENTO — de documento a partida dobrada.
 *
 * São funções puras: entram os dados do documento, sai o rascunho da partida.
 * Nada aqui toca banco. É de propósito — é o que torna cada regra testável
 * isoladamente e o que permite conferir uma partida ANTES de gravá-la, que é
 * a diferença entre um agente que opera e um agente que chuta.
 *
 * Toda partida devolvida por este módulo passa por `assertBalanced` antes de
 * sair. O banco valida de novo (trigger da migration 0049); a dupla checagem
 * é intencional: aqui o erro vem com o nome da regra que o produziu, lá vem a
 * garantia de que nenhum caminho de código escapa.
 *
 * Nota sobre NFSe: a nota não gera partida própria. Ela já cria um
 * `financial_entry` com `source = 'NFSE'`, e é esse lançamento financeiro que
 * é escriturado. Duas partidas para o mesmo fato dobrariam a receita.
 */

export type Direction = 'DEBIT' | 'CREDIT';

export interface DraftLine {
  /** Código no plano de contas — resolvido para id na hora de gravar. */
  accountCode: string;
  direction: Direction;
  /** Sempre positivo. O lado é `direction`. */
  amount: number;
  lineMemo?: string;
  partnerId?: string | null;
  costCenterId?: string | null;
}

export type JournalSource =
  | 'FINANCIAL_ENTRY'
  | 'NFSE'
  | 'TAX_GUIDE'
  | 'PAYSLIP'
  | 'PROFIT_DISTRIBUTION'
  | 'BANK_TRANSACTION'
  | 'CLOSING'
  | 'OPENING'
  | 'MANUAL';

export type JournalEvent = 'ACCRUAL' | 'SETTLEMENT' | 'REVERSAL' | 'ADJUSTMENT';

export interface JournalDraft {
  entryDate: string;
  referenceMonth: string;
  memo: string;
  source: JournalSource;
  sourceId: string | null;
  event: JournalEvent;
  lines: DraftLine[];
}

/** Centavos: a comparação de igualdade em float não fecha partida. */
const cents = (n: number) => Math.round(n * 100);

export class UnbalancedEntryError extends Error {
  constructor(
    public readonly draft: JournalDraft,
    public readonly debit: number,
    public readonly credit: number,
  ) {
    super(
      `Regra de lançamento produziu partida que não fecha (${draft.source}/${draft.event}): ` +
        `débito ${debit.toFixed(2)} ≠ crédito ${credit.toFixed(2)}.`,
    );
    this.name = 'UnbalancedEntryError';
  }
}

/**
 * Confere a partida e devolve ela mesma. Toda regra abaixo termina aqui —
 * assim é impossível uma regra nova entrar no sistema sem passar pela
 * verificação, que é o tipo de coisa que se esquece quando a checagem fica
 * "do lado de fora", a cargo de quem chama.
 */
export function assertBalanced(draft: JournalDraft): JournalDraft {
  const debit = draft.lines
    .filter((l) => l.direction === 'DEBIT')
    .reduce((s, l) => s + cents(l.amount), 0);
  const credit = draft.lines
    .filter((l) => l.direction === 'CREDIT')
    .reduce((s, l) => s + cents(l.amount), 0);

  if (debit !== credit) throw new UnbalancedEntryError(draft, debit / 100, credit / 100);
  if (draft.lines.length < 2) throw new UnbalancedEntryError(draft, debit / 100, credit / 100);
  if (draft.lines.some((l) => l.amount <= 0)) {
    throw new Error(`Linha com valor não positivo em ${draft.source}/${draft.event}.`);
  }
  return draft;
}

/** Primeiro dia do mês de uma data ISO — o `reference_month` do sistema. */
export function monthOf(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Lançamento financeiro (financial_entry)
   ══════════════════════════════════════════════════════════════════════════ */

export interface FinancialEntryDoc {
  id: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  description: string;
  /** Valor efetivamente liquidado = originalAmount + juros − desconto. */
  amount: number;
  originalAmount?: number | null;
  interest?: number | null;
  discount?: number | null;
  dueDate: string;
  referenceMonth: string;
  paidAt?: string | null;
  partnerId?: string | null;
  costCenterId?: string | null;
  /**
   * Conta de resultado vinda do `accountingCode` da categoria. Quando a
   * categoria não tem código (ou não há categoria), cai na conta "a
   * classificar" — a partida fecha e a pendência fica visível, em vez de a
   * despesa ser empurrada para uma conta plausível e errada.
   */
  resultAccountCode?: string | null;
  /**
   * Origem operacional (`financial_entry.source`): PAYROLL, NFSE, RECURRING…
   * Serve de segunda pista para a conta de resultado quando a categoria não
   * tem código — folha vai para despesa de pessoal, não para "a classificar".
   */
  source?: string | null;
  /** Conta do banco que recebeu/pagou. Default: Bancos Conta Movimento. */
  cashAccountCode?: string | null;
}

/**
 * Reconhecimento pelo regime de competência: a receita nasce quando o serviço
 * é prestado e a despesa quando é incorrida, não quando o dinheiro se move.
 * É o que separa este razão de um extrato de caixa reetiquetado.
 */
export function accrueFinancialEntry(doc: FinancialEntryDoc): JournalDraft {
  const valor = doc.originalAmount ?? doc.amount;
  const resultado = doc.resultAccountCode ?? contaPorOrigem(doc.type, doc.source);
  if (!resultado) throw new SemContaContabilError(doc.id, doc.description);

  const lines: DraftLine[] =
    doc.type === 'RECEIVABLE'
      ? [
          { accountCode: ACCOUNTS.CLIENTES, direction: 'DEBIT', amount: valor, partnerId: doc.partnerId },
          { accountCode: resultado, direction: 'CREDIT', amount: valor, costCenterId: doc.costCenterId },
        ]
      : [
          { accountCode: resultado, direction: 'DEBIT', amount: valor, costCenterId: doc.costCenterId },
          { accountCode: ACCOUNTS.FORNECEDORES, direction: 'CREDIT', amount: valor, partnerId: doc.partnerId },
        ];

  return assertBalanced({
    entryDate: doc.dueDate,
    referenceMonth: doc.referenceMonth,
    memo: doc.description,
    source: 'FINANCIAL_ENTRY',
    sourceId: doc.id,
    event: 'ACCRUAL',
    lines,
  });
}

/**
 * Conta de resultado quando a categoria não tem código contábil.
 *
 * A origem do lançamento é informação de verdade, não chute: um lançamento
 * gerado pela folha É despesa de pessoal, e mandá-lo para "a classificar"
 * jogaria fora um fato que o sistema já sabe.
 */
/**
 * Lançamento que não tem conta contábil resolvível.
 *
 * Não existe conta de despejo. A ITG 1000 não prevê "a classificar", e usar
 * uma produzia balanço de perna quebrada — um terço do custo numa linha que
 * não diz nada, que outro profissional pegaria depois e teria que refazer.
 *
 * Então a escrituração FALHA, e o documento fica pendente até alguém
 * classificar. É como a contabilidade sempre funcionou: documento sem
 * classificação não entra no razão.
 */
export class SemContaContabilError extends Error {
  constructor(
    public readonly documentoId: string,
    public readonly descricao: string,
  ) {
    super(
      `Lançamento "${descricao.slice(0, 60)}" não tem conta contábil definida. ` +
        'Classifique antes de escriturar — a norma não prevê conta "a classificar".',
    );
    this.name = 'SemContaContabilError';
  }
}

/**
 * Conta de resultado a partir da origem do lançamento.
 *
 * A origem é informação de verdade, não chute: um lançamento gerado pela folha
 * É despesa de pessoal. Fora os casos que o sistema sabe, devolve `null` e
 * quem chama decide — e a decisão certa é não escriturar.
 */
function contaPorOrigem(type: 'RECEIVABLE' | 'PAYABLE', source?: string | null): string | null {
  if (type === 'RECEIVABLE') return ACCOUNTS.RECEITA_SERVICOS;
  if (source === 'PAYROLL') return ACCOUNTS.DESPESA_PESSOAL;
  return null;
}

/**
 * Liquidação: o dinheiro se move e baixa o direito (ou a obrigação) que já
 * estava reconhecido.
 *
 * Juros e desconto entram como linhas próprias de resultado financeiro. Sem
 * isso, pagar R$ 1.030 numa conta de R$ 1.000 exigiria "baixar" R$ 1.030 de
 * um passivo de R$ 1.000 — a partida fecharia e o balanço mentiria.
 */
export function settleFinancialEntry(doc: FinancialEntryDoc): JournalDraft {
  const pago = doc.amount;
  const original = doc.originalAmount ?? doc.amount;
  const juros = doc.interest ?? 0;
  const desconto = doc.discount ?? 0;
  const caixa = doc.cashAccountCode ?? ACCOUNTS.BANCOS;
  const dataLiquidacao = doc.paidAt ?? doc.dueDate;

  const lines: DraftLine[] = [];

  if (doc.type === 'RECEIVABLE') {
    lines.push({ accountCode: caixa, direction: 'DEBIT', amount: pago });
    if (desconto > 0) {
      lines.push({
        accountCode: ACCOUNTS.DESCONTOS_CONCEDIDOS,
        direction: 'DEBIT',
        amount: desconto,
        lineMemo: 'Desconto concedido',
      });
    }
    lines.push({
      accountCode: ACCOUNTS.CLIENTES,
      direction: 'CREDIT',
      amount: original,
      partnerId: doc.partnerId,
    });
    if (juros > 0) {
      lines.push({
        accountCode: ACCOUNTS.JUROS_ATIVOS,
        direction: 'CREDIT',
        amount: juros,
        lineMemo: 'Juros recebidos por atraso',
      });
    }
  } else {
    lines.push({
      accountCode: ACCOUNTS.FORNECEDORES,
      direction: 'DEBIT',
      amount: original,
      partnerId: doc.partnerId,
    });
    if (juros > 0) {
      lines.push({
        accountCode: ACCOUNTS.JUROS_PASSIVOS,
        direction: 'DEBIT',
        amount: juros,
        lineMemo: 'Juros e multa por atraso',
      });
    }
    lines.push({ accountCode: caixa, direction: 'CREDIT', amount: pago });
    if (desconto > 0) {
      lines.push({
        accountCode: ACCOUNTS.DESCONTOS_OBTIDOS,
        direction: 'CREDIT',
        amount: desconto,
        lineMemo: 'Desconto obtido',
      });
    }
  }

  return assertBalanced({
    entryDate: dataLiquidacao,
    referenceMonth: monthOf(dataLiquidacao),
    memo: `Liquidação — ${doc.description}`,
    source: 'FINANCIAL_ENTRY',
    sourceId: doc.id,
    event: 'SETTLEMENT',
    lines,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Guia de imposto (tax_guide)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Conta de despesa e de passivo conforme o tributo.
 *
 * O DAS entra como dedução da receita bruta (3.1.2) — é o que a ITG 1000 pede
 * e o que faz a DRE bater com o faturamento declarado. Os demais tributos
 * sobre faturamento têm conta própria: jogá-los na conta do DAS inflaria o
 * Simples na DRE e faria a conferência contra o PGDAS falhar.
 */
function contasDoTributo(taxName: string): { despesa: string; passivo: string } {
  const ehSimples = /simples|\bdas\b/i.test(taxName);
  return ehSimples
    ? { despesa: ACCOUNTS.IMPOSTO_SIMPLES, passivo: ACCOUNTS.DAS_A_RECOLHER }
    : { despesa: ACCOUNTS.IMPOSTO_OUTROS, passivo: ACCOUNTS.IMPOSTOS_A_RECOLHER };
}

export interface TaxGuideDoc {
  id: string;
  taxName: string;
  amount: number;
  dueDate: string;
  referenceMonth: string;
  paidAt?: string | null;
  cashAccountCode?: string | null;
  /**
   * Repartição do DAS por tributo, em PERCENTUAL da guia (soma 100).
   * Vem de `tax_annex_bracket.partition_distribution`, que é a tabela do
   * Anexo da LC 123 — não é estimativa, é a lei.
   *
   * Sem ela, a guia inteira vira dedução da receita, que é o que o sistema
   * fazia e a ITG 1000 não permite.
   */
  reparticao?: Partial<Record<'irpj' | 'csll' | 'cofins' | 'pis' | 'cpp' | 'icms' | 'iss', number>> | null;
}

/**
 * Conta de cada componente do DAS, conforme a ITG 1000.
 *
 * A guia é UMA, os tributos dentro dela vão para três lugares diferentes da
 * DRE — e é isso que o Anexo 3 da norma determina:
 *
 *   PIS, COFINS, ISS, ICMS  →  dedução da receita bruta (acima da linha)
 *   IRPJ, CSLL              →  tributos sobre o lucro (abaixo do resultado)
 *   CPP                     →  despesa com pessoal (encargo patronal)
 */
const CONTA_DO_TRIBUTO: Record<string, string> = {
  pis: ACCOUNTS.IMPOSTO_PIS,
  cofins: ACCOUNTS.IMPOSTO_COFINS,
  iss: ACCOUNTS.IMPOSTO_ISS,
  icms: ACCOUNTS.IMPOSTO_ICMS,
  irpj: ACCOUNTS.IRPJ,
  csll: ACCOUNTS.CSLL,
  cpp: ACCOUNTS.ENCARGOS_PESSOAL,
};

/**
 * O DAS é dedução da receita bruta (3.1.2), não despesa operacional — é o que
 * a ITG 1000 pede e o que faz a DRE bater com o faturamento declarado.
 */
export function accrueTaxGuide(doc: TaxGuideDoc): JournalDraft {
  const { despesa: contaDespesa, passivo: contaPassivo } = contasDoTributo(doc.taxName);

  return assertBalanced({
    entryDate: doc.dueDate,
    referenceMonth: doc.referenceMonth,
    memo: `Provisão — ${doc.taxName}`,
    source: 'TAX_GUIDE',
    sourceId: doc.id,
    event: 'ACCRUAL',
    lines: [
      ...segregarGuia(doc, contaDespesa),
      { accountCode: contaPassivo, direction: 'CREDIT', amount: doc.amount },
    ],
  });
}

/**
 * Abre a guia nas contas de cada tributo que ela embute.
 *
 * O último centavo vai para a maior linha. Distribuir percentual sobre um
 * valor em reais quase nunca fecha na casa dos centavos, e uma partida que
 * erra R$ 0,01 é uma partida recusada — o razão não aceita e o OneFlow
 * também não.
 *
 * Sem repartição conhecida, cai numa linha só. É pior contabilmente, mas é
 * honesto: inventar a proporção seria afirmar um número que ninguém apurou.
 */
function segregarGuia(doc: TaxGuideDoc, contaPadrao: string): DraftLine[] {
  const r = doc.reparticao;
  if (!r || Object.keys(r).length === 0) {
    return [{ accountCode: contaPadrao, direction: 'DEBIT', amount: doc.amount }];
  }

  const totalCentavos = Math.round(doc.amount * 100);
  const partes: { conta: string; centavos: number; nome: string }[] = [];

  for (const [tributo, pct] of Object.entries(r)) {
    const conta = CONTA_DO_TRIBUTO[tributo];
    if (!conta || !pct) continue;
    const centavos = Math.round((totalCentavos * pct) / 100);
    if (centavos > 0) partes.push({ conta, centavos, nome: tributo.toUpperCase() });
  }

  if (!partes.length) {
    return [{ accountCode: contaPadrao, direction: 'DEBIT', amount: doc.amount }];
  }

  const soma = partes.reduce((s, p) => s + p.centavos, 0);
  const sobra = totalCentavos - soma;
  if (sobra !== 0) {
    const maior = partes.reduce((a, b) => (b.centavos > a.centavos ? b : a));
    maior.centavos += sobra;
  }

  return partes.map((p) => ({
    accountCode: p.conta,
    direction: 'DEBIT' as const,
    amount: p.centavos / 100,
    lineMemo: `${p.nome} embutido no DAS`,
  }));
}

export function settleTaxGuide(doc: TaxGuideDoc): JournalDraft {
  const { passivo: contaPassivo } = contasDoTributo(doc.taxName);
  const data = doc.paidAt ?? doc.dueDate;

  return assertBalanced({
    entryDate: data,
    referenceMonth: monthOf(data),
    memo: `Pagamento — ${doc.taxName}`,
    source: 'TAX_GUIDE',
    sourceId: doc.id,
    event: 'SETTLEMENT',
    lines: [
      { accountCode: contaPassivo, direction: 'DEBIT', amount: doc.amount },
      {
        accountCode: doc.cashAccountCode ?? ACCOUNTS.BANCOS,
        direction: 'CREDIT',
        amount: doc.amount,
      },
    ],
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Folha (payslip)
   ══════════════════════════════════════════════════════════════════════════ */

export interface PayslipDoc {
  id: string;
  employeeName: string;
  netAmount: number;
  referenceMonth: string;
  paidAt?: string | null;
  cashAccountCode?: string | null;
}

/**
 * ⚠️ NÃO ESTÁ LIGADA A NADA, e ligá-la sem cuidado duplica o custo de folha.
 *
 * `generatePayslipsAction` grava um `payslip` E um `financial_entry` com
 * `source = 'PAYROLL'` para o mesmo fato. Hoje quem escritura a folha é o
 * lançamento financeiro, roteado pela origem para a conta de despesa com
 * pessoal (ver `contaPorOrigem`). Estas duas funções existem para o dia em
 * que a folha tiver documento contábil próprio, com encargos e retenções
 * discriminados — e nesse dia o `financial_entry` de PAYROLL precisa deixar
 * de gerar reconhecimento, ou a despesa entra duas vezes.
 */
export function accruePayslip(doc: PayslipDoc): JournalDraft {
  return assertBalanced({
    entryDate: doc.referenceMonth,
    referenceMonth: doc.referenceMonth,
    memo: `Folha — ${doc.employeeName}`,
    source: 'PAYSLIP',
    sourceId: doc.id,
    event: 'ACCRUAL',
    lines: [
      { accountCode: ACCOUNTS.DESPESA_PESSOAL, direction: 'DEBIT', amount: doc.netAmount },
      { accountCode: ACCOUNTS.SALARIOS_A_PAGAR, direction: 'CREDIT', amount: doc.netAmount },
    ],
  });
}

export function settlePayslip(doc: PayslipDoc): JournalDraft {
  const data = doc.paidAt ?? doc.referenceMonth;
  return assertBalanced({
    entryDate: data,
    referenceMonth: monthOf(data),
    memo: `Pagamento de folha — ${doc.employeeName}`,
    source: 'PAYSLIP',
    sourceId: doc.id,
    event: 'SETTLEMENT',
    lines: [
      { accountCode: ACCOUNTS.SALARIOS_A_PAGAR, direction: 'DEBIT', amount: doc.netAmount },
      {
        accountCode: doc.cashAccountCode ?? ACCOUNTS.BANCOS,
        direction: 'CREDIT',
        amount: doc.netAmount,
      },
    ],
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Movimento bancário sem par no financeiro
   ══════════════════════════════════════════════════════════════════════════ */

export interface MovimentoBancarioDoc {
  id: string;
  data: string;
  /** Positivo entrou na conta; negativo saiu. */
  valor: number;
  descricao: string;
  /**
   * Conta de resultado, quando a classificação encontrou uma.
   *
   * `null` manda para a transitória — e é o único lugar do sistema onde não
   * ter conta ainda assim lança. Ver o comentário da regra.
   */
  resultAccountCode?: string | null;
  cashAccountCode?: string | null;
}

/**
 * Lança um movimento bancário que não casou com nenhum lançamento financeiro.
 *
 * ── Por que este caso lança SEM classificação, e a nota não ─────────────
 *
 * Documento sem classificação não é escriturado: fica pendente, e a regra é
 * essa porque a competência pode esperar. O extrato é o oposto — o dinheiro
 * JÁ saiu da conta. Não lançar faria o saldo do razão divergir do saldo real
 * do banco, e é justamente essa igualdade que dá sentido à conciliação.
 *
 * Então lança-se contra a transitória: o caixa bate, a pendência fica visível
 * numa conta com nome próprio, e o fechamento do mês trava enquanto ela tiver
 * saldo. Fila com alarme, não balde.
 */
export function accrueBankTransaction(doc: MovimentoBancarioDoc): JournalDraft {
  const caixa = doc.cashAccountCode ?? ACCOUNTS.BANCOS;
  const contrapartida = doc.resultAccountCode ?? ACCOUNTS.VALORES_A_CLASSIFICAR;
  const valor = Math.abs(doc.valor);
  const entrou = doc.valor > 0;

  return assertBalanced({
    entryDate: doc.data,
    referenceMonth: monthOf(doc.data),
    memo: doc.descricao.slice(0, 255),
    source: 'BANK_TRANSACTION',
    sourceId: doc.id,
    event: 'SETTLEMENT',
    lines: entrou
      ? [
          { accountCode: caixa, direction: 'DEBIT', amount: valor },
          { accountCode: contrapartida, direction: 'CREDIT', amount: valor },
        ]
      : [
          { accountCode: contrapartida, direction: 'DEBIT', amount: valor },
          { accountCode: caixa, direction: 'CREDIT', amount: valor },
        ],
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Saldos de abertura — a empresa que chega no meio do caminho
   ══════════════════════════════════════════════════════════════════════════ */

export interface SaldoDeAbertura {
  accountCode: string;
  /** Sempre positivo; o lado é `direction`. */
  amount: number;
  direction: Direction;
}

export class AberturaNaoFechaError extends Error {
  constructor(
    public readonly debito: number,
    public readonly credito: number,
  ) {
    super(
      `O balancete de abertura não fecha: débito ${debito.toFixed(2)} ≠ crédito ` +
        `${credito.toFixed(2)}, diferença de ${Math.abs(debito - credito).toFixed(2)}. ` +
        'Confira o balancete recebido antes de abrir a empresa — a diferença é ' +
        'informação faltando, não um arredondamento para acertar aqui.',
    );
    this.name = 'AberturaNaoFechaError';
  }
}

/**
 * Partida de abertura: traz os saldos com que a empresa chega.
 *
 * ── Para que serve ──────────────────────────────────────────────────────
 *
 * Cliente que troca de contabilidade no meio do ano não traz lançamento
 * nenhum — traz um balancete da contabilidade anterior. Sem uma partida de
 * abertura, o razão da Hexx começaria do zero e o balanço diria que a empresa
 * não tem caixa, não deve a ninguém e não tem capital. Todo relatório sairia
 * errado até o primeiro exercício fechar.
 *
 * ── Por que ela RECUSA quando não fecha ─────────────────────────────────
 *
 * Um balancete que não fecha significa informação faltando: conta que não
 * veio, saldo transcrito errado, página que faltou no PDF. A tentação é
 * jogar a diferença numa conta de ajuste e seguir — e é exatamente isso que
 * produz um balanço que ninguém consegue explicar dois anos depois.
 *
 * Recusar devolve o problema a quem pode resolvê-lo, que é quem tem o
 * balancete na mão.
 */
export function openingBalance(doc: {
  id: string;
  /** Data do saldo: o último dia do período que veio pronto. */
  date: string;
  saldos: SaldoDeAbertura[];
  origem?: string;
}): JournalDraft {
  const validos = doc.saldos.filter((s) => Math.round(s.amount * 100) !== 0);
  if (validos.length < 2) {
    throw new Error('Abertura precisa de ao menos duas contas com saldo.');
  }

  const debito = validos.filter((s) => s.direction === 'DEBIT').reduce((t, s) => t + cents(s.amount), 0);
  const credito = validos.filter((s) => s.direction === 'CREDIT').reduce((t, s) => t + cents(s.amount), 0);
  if (debito !== credito) throw new AberturaNaoFechaError(debito / 100, credito / 100);

  return assertBalanced({
    entryDate: doc.date,
    referenceMonth: monthOf(doc.date),
    memo: doc.origem
      ? `Saldos de abertura — ${doc.origem}`
      : 'Saldos de abertura',
    source: 'OPENING',
    sourceId: doc.id,
    event: 'ADJUSTMENT',
    lines: validos.map((s) => ({
      accountCode: s.accountCode,
      direction: s.direction,
      amount: s.amount,
      lineMemo: 'Saldo transportado',
    })),
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Folha vinda do OneFlow — com encargos e retenções discriminados
   ══════════════════════════════════════════════════════════════════════════ */

export interface FolhaDoc {
  /** Identificador do fato: empresa + competência + tipo de folha. */
  id: string;
  referenceMonth: string;
  tipoFolha: string;
  /** Bruto da folha: é ele que vira despesa, não o líquido. */
  totalProventos: number;
  /** Líquido a pagar ao trabalhador ou ao sócio. */
  totalLiquido: number;
  /** INSS retido do segurado — obrigação da empresa recolher. */
  inssSegurado: number;
  /** IRRF retido na fonte. */
  irrf: number;
  /** Pró-labore tem conta própria; salário vai para Salários a Pagar. */
  proLabore: boolean;
}

/**
 * Reconhece a folha do mês pelo BRUTO, repartindo as retenções.
 *
 * A diferença em relação a `accruePayslip` é o que define esta função: o
 * recibo do OneFlow discrimina proventos, descontos, INSS e IRRF, então a
 * despesa pode ser reconhecida pelo que ela de fato é — o custo total do
 * trabalhador — em vez de pelo líquido que sai do banco.
 *
 * Reconhecer pelo líquido subavaliaria a despesa de pessoal exatamente no
 * valor das retenções, e sumiria com obrigações que a empresa tem a recolher.
 * Num Simples isso distorce o Fator R, que é calculado sobre a folha.
 *
 * O resíduo (`totalProventos - líquido - INSS - IRRF`) é o que o recibo não
 * discrimina: assistência, contribuição sindical, vale. Vai para Outras
 * Obrigações a Pagar, com nome próprio, para não ser somado a um encargo que
 * não é dele.
 */
export function accrueFolha(doc: FolhaDoc): JournalDraft {
  const contaLiquido = doc.proLabore
    ? ACCOUNTS.PRO_LABORE_A_PAGAR
    : ACCOUNTS.SALARIOS_A_PAGAR;
  const contaDespesa = doc.proLabore ? ACCOUNTS.PRO_LABORE : ACCOUNTS.DESPESA_PESSOAL;

  const residuo = Number(
    (doc.totalProventos - doc.totalLiquido - doc.inssSegurado - doc.irrf).toFixed(2),
  );

  const lines: DraftLine[] = [
    { accountCode: contaDespesa, direction: 'DEBIT', amount: doc.totalProventos },
    { accountCode: contaLiquido, direction: 'CREDIT', amount: doc.totalLiquido },
  ];
  if (doc.inssSegurado > 0) {
    lines.push({ accountCode: ACCOUNTS.ENCARGOS_A_RECOLHER, direction: 'CREDIT', amount: doc.inssSegurado });
  }
  if (doc.irrf > 0) {
    lines.push({ accountCode: ACCOUNTS.IMPOSTOS_A_RECOLHER, direction: 'CREDIT', amount: doc.irrf });
  }
  if (residuo > 0) {
    lines.push({ accountCode: ACCOUNTS.OUTRAS_OBRIGACOES, direction: 'CREDIT', amount: residuo });
  }

  return assertBalanced({
    entryDate: doc.referenceMonth,
    referenceMonth: doc.referenceMonth,
    memo: `${doc.tipoFolha} — ${doc.referenceMonth.slice(0, 7)}`,
    source: 'PAYSLIP',
    sourceId: doc.id,
    event: 'ACCRUAL',
    lines,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Distribuição de lucros (profit_distribution)
   ══════════════════════════════════════════════════════════════════════════ */

export interface ProfitDistributionDoc {
  id: string;
  partnerName: string;
  amount: number;
  distributedAt: string;
  cashAccountCode?: string | null;
}

/**
 * Distribuição reduz o PL e cria obrigação com o sócio. Não passa por conta de
 * resultado: dividendo não é despesa — tratá-lo como tal derrubaria o lucro do
 * exercício e, com ele, a própria base do que pode ser distribuído.
 */
export function accrueProfitDistribution(doc: ProfitDistributionDoc): JournalDraft {
  return assertBalanced({
    entryDate: doc.distributedAt,
    referenceMonth: monthOf(doc.distributedAt),
    memo: `Distribuição de lucros — ${doc.partnerName}`,
    source: 'PROFIT_DISTRIBUTION',
    sourceId: doc.id,
    event: 'ACCRUAL',
    lines: [
      { accountCode: ACCOUNTS.LUCROS_ACUMULADOS, direction: 'DEBIT', amount: doc.amount },
      { accountCode: ACCOUNTS.LUCROS_A_PAGAR, direction: 'CREDIT', amount: doc.amount },
    ],
  });
}

export function settleProfitDistribution(doc: ProfitDistributionDoc): JournalDraft {
  return assertBalanced({
    entryDate: doc.distributedAt,
    referenceMonth: monthOf(doc.distributedAt),
    memo: `Pagamento de lucros — ${doc.partnerName}`,
    source: 'PROFIT_DISTRIBUTION',
    sourceId: doc.id,
    event: 'SETTLEMENT',
    lines: [
      { accountCode: ACCOUNTS.LUCROS_A_PAGAR, direction: 'DEBIT', amount: doc.amount },
      {
        accountCode: doc.cashAccountCode ?? ACCOUNTS.BANCOS,
        direction: 'CREDIT',
        amount: doc.amount,
      },
    ],
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Estorno
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Espelha a partida invertendo cada lado. Correção de partida publicada é
 * sempre assim — nunca por alteração — para que o histórico continue contando
 * o que aconteceu, inclusive o erro. Quando quem lançou foi um agente, isso
 * deixa de ser preferência contábil e vira requisito de auditoria.
 */
export function reverseEntry(original: JournalDraft, motivo: string, data: string): JournalDraft {
  return assertBalanced({
    entryDate: data,
    referenceMonth: monthOf(data),
    memo: `Estorno — ${original.memo} (${motivo})`,
    source: original.source,
    sourceId: original.sourceId,
    event: 'REVERSAL',
    lines: original.lines.map((l) => ({
      ...l,
      direction: l.direction === 'DEBIT' ? ('CREDIT' as const) : ('DEBIT' as const),
    })),
  });
}
