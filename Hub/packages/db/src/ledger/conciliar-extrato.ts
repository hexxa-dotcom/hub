import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { accrueBankTransaction, ACCOUNTS } from '@hexxa/core';
import { postJournal, reverseJournal } from './repository';
import { escriturarLancamento } from './escrituracao';
import { consultarConhecimento, aprender, normalizarDescricao } from './conhecimento';
import { cnpjNoHistorico, saidaParaSocio } from './parceiro';

/**
 * CONCILIAÇÃO E ESCRITURAÇÃO DO EXTRATO.
 *
 * ── A ordem importa mais que qualquer outra coisa aqui ──────────────────
 *
 * Primeiro CASAR, depois classificar. Um pagamento de fornecedor que já está
 * na Hexx como conta a pagar não é uma despesa nova: é a BAIXA daquela conta.
 * Tratá-lo como fato novo lançaria a despesa duas vezes — uma pela nota, uma
 * pelo extrato — e o razão fecharia nas duas, porque cada partida fecha
 * isoladamente. O erro apareceria só na DRE, como um custo dobrado que
 * ninguém consegue localizar.
 *
 * Por isso a varredura tem três saídas, nesta ordem:
 *
 *   1. casou com um lançamento aberto  → baixa, não cria despesa
 *   2. não casou e foi classificado    → vira lançamento novo e escritura
 *   3. não casou e não classificou     → escritura na transitória, e o mês
 *                                        não fecha enquanto ela tiver saldo
 */

export interface ResultadoConciliacao {
  analisadas: number;
  casadas: number;
  ambiguas: number;
  classificadas: number;
  naTransitoria: number;
  erros: { bankTransactionId: string; motivo: string }[];
}

/** Dias de folga entre a data do lançamento e a do extrato para casar. */
const JANELA_DE_DIAS = 5;

export async function conciliarExtrato(
  tx: DbHandle,
  companyId: string,
): Promise<ResultadoConciliacao> {
  const out: ResultadoConciliacao = {
    analisadas: 0, casadas: 0, ambiguas: 0,
    classificadas: 0, naTransitoria: 0, erros: [],
  };

  const pendentes = (await tx.execute(sql`
    SELECT b.id::text, to_char(b.posted_at,'YYYY-MM-DD') AS data,
           b.amount::float AS valor, b.description AS descricao
      FROM bank_transaction b
     WHERE b.company_id = ${companyId}
       AND b.reconciliation_status = 'UNMATCHED'
     ORDER BY b.posted_at
  `)) as unknown as { id: string; data: string; valor: number; descricao: string }[];

  for (const t of pendentes) {
    out.analisadas++;
    try {
      const casou = await tentarCasar(tx, companyId, t);
      if (casou === 'CASOU') { out.casadas++; continue; }
      if (casou === 'AMBIGUO') { out.ambiguas++; continue; }

      const conta = await escriturarSemPar(tx, companyId, t);
      if (conta) out.classificadas++;
      else out.naTransitoria++;
    } catch (err) {
      out.erros.push({
        bankTransactionId: t.id,
        motivo: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return out;
}

/**
 * Procura um lançamento em aberto que corresponda à transação.
 *
 * Exige valor EXATO e tipo compatível, dentro de uma janela de dias em torno
 * do vencimento. Um único candidato é casado; vários viram revisão humana.
 *
 * Casar por aproximação seria pior que não casar: uma baixa errada marca como
 * paga uma conta que continua em aberto, e some com a cobrança que o cliente
 * deveria receber.
 */
async function tentarCasar(
  tx: DbHandle,
  companyId: string,
  t: { id: string; data: string; valor: number; descricao: string },
): Promise<'CASOU' | 'AMBIGUO' | 'SEM_PAR'> {
  const tipo = t.valor > 0 ? 'RECEIVABLE' : 'PAYABLE';
  const cnpj = cnpjNoHistorico(t.descricao);

  /**
   * Documento do parceiro do lançamento: o cadastrado ou, na nota do Emissor
   * Nacional, o tomador (recebível) / prestador (pagável) do próprio documento.
   */
  const docDoLancamento = sql`regexp_replace(coalesce(
      (SELECT bp.document FROM business_partner bp WHERE bp.id = e.partner_id),
      (SELECT CASE WHEN e.type = 'RECEIVABLE' THEN d.tomador_documento ELSE d.prestador_cnpj END
         FROM nfse_distribuicao_doc d
        WHERE d.company_id = e.company_id AND d.chave_acesso = e.external_id LIMIT 1),
      ''), '[^0-9]', '', 'g')`;

  if (cnpj) {
    /**
     * O extrato diz quem pagou: só entram os lançamentos DESSE parceiro, com
     * valor exato, e casa o de vencimento mais próximo do pagamento. Cliente
     * que paga todo mês o mesmo valor tem várias notas iguais em aberto — a
     * mais próxima é a daquele mês. Janela larga porque o parceiro já está
     * confirmado: é a data que escolhe entre as notas dele, não que valida.
     *
     * Achado na Gateway (28/09/2026): pela regra só de valor e data, um Pix da
     * Revelo Cortinas baixou a nota da Althaia, e um da UP Empreendimentos a
     * da UP House.
     */
    const [c] = (await tx.execute(sql`
      SELECT e.id::text FROM financial_entry e
       WHERE e.company_id = ${companyId}
         AND e.type = ${tipo}
         AND e.status NOT IN ('PAID', 'CANCELED')
         AND abs(e.amount::numeric - ${Math.abs(t.valor).toFixed(2)}::numeric) < 0.01
         AND ${docDoLancamento} = ${cnpj}
         AND e.due_date BETWEEN ${t.data}::date - ${'60 days'}::interval
                            AND ${t.data}::date + ${'30 days'}::interval
       ORDER BY abs(e.due_date - ${t.data}::date), e.due_date
       LIMIT 1
    `)) as unknown as { id: string }[];
    if (!c) return 'SEM_PAR';
    await casarComLancamento(tx, companyId, t, c.id);
    return 'CASOU';
  }

  // Sem CNPJ no histórico: valor exato perto do vencimento, e nunca um
  // lançamento que já tem parceiro identificado (não dá para saber se é ele).
  const candidatos = (await tx.execute(sql`
    SELECT e.id::text FROM financial_entry e
     WHERE e.company_id = ${companyId}
       AND e.type = ${tipo}
       AND e.status NOT IN ('PAID', 'CANCELED')
       AND abs(e.amount::numeric - ${Math.abs(t.valor).toFixed(2)}::numeric) < 0.01
       AND ${docDoLancamento} = ''
       -- O intervalo vai como TEXTO: este driver recusa número cru em
       -- consulta parametrizada, e o erro sai como "argumento string
       -- esperado" — nada que faça pensar em aritmética de datas.
       AND e.due_date BETWEEN ${t.data}::date - ${`${JANELA_DE_DIAS} days`}::interval
                          AND ${t.data}::date + ${`${JANELA_DE_DIAS} days`}::interval
     LIMIT 5
  `)) as unknown as { id: string }[];

  if (candidatos.length === 0) return 'SEM_PAR';
  if (candidatos.length > 1) return 'AMBIGUO';

  await casarComLancamento(tx, companyId, t, candidatos[0]!.id);
  return 'CASOU';
}

/**
 * Movimento sem lançamento correspondente: escritura pela base de
 * conhecimento ou, sem ela, na transitória. Devolve a conta usada (null =
 * transitória, esperando identificação).
 */
export async function escriturarSemPar(
  tx: DbHandle,
  companyId: string,
  t: { id: string; data: string; valor: number; descricao: string },
): Promise<string | null> {
  const conta = await contaPelaHistoria(tx, companyId, t.descricao, t.valor);
  await postJournal(tx, companyId, accrueBankTransaction({
    id: t.id, data: t.data, valor: t.valor,
    descricao: t.descricao, resultAccountCode: conta,
  }));
  await tx.execute(sql`
    UPDATE bank_transaction SET reconciliation_status = 'MATCHED' WHERE id = ${t.id}
  `);
  return conta;
}

/**
 * Casa o movimento com o lançamento: baixa na data do extrato, escritura e
 * ensina a base. Usado pela varredura (candidato único) e pela resposta do
 * empresário quando havia mais de um candidato.
 */
export async function casarComLancamento(
  tx: DbHandle,
  companyId: string,
  t: { id: string; data: string; valor: number; descricao: string },
  entryId: string,
): Promise<void> {
  /**
   * A data da baixa é a do EXTRATO, não a de hoje.
   *
   * É o erro que a conciliação manual cometia: gravava `paid_at` com a data
   * em que alguém clicou. Uma conta de março conciliada em setembro entrava
   * no razão como pagamento de setembro, e o caixa de março ficava errado
   * para sempre.
   */
  await tx.execute(sql`
    UPDATE financial_entry
       SET status = 'PAID', paid_at = ${t.data}::date
     WHERE id = ${entryId}
  `);
  await tx.execute(sql`
    INSERT INTO reconciliation_match (company_id, bank_transaction_id, financial_entry_id)
    VALUES (${companyId}, ${t.id}, ${entryId})
    ON CONFLICT DO NOTHING
  `);
  await tx.execute(sql`
    UPDATE bank_transaction SET reconciliation_status = 'MATCHED' WHERE id = ${t.id}
  `);

  // A baixa vira partida de SETTLEMENT pelo caminho normal do lançamento.
  await escriturarLancamento(tx, companyId, entryId);

  // Casou com um lançamento que já tem conta: a base aprende que esta
  // descrição de extrato é aquela conta — é fato, não palpite.
  const [cat] = (await tx.execute(sql`
    SELECT c.accounting_code AS conta, c.name AS nome
      FROM financial_entry e JOIN category c ON c.id = e.category_id
     WHERE e.id = ${entryId} AND c.accounting_code IS NOT NULL
  `)) as unknown as { conta: string; nome: string }[];
  if (cat) {
    await aprender(tx, companyId, { descricao: t.descricao, valor: t.valor, conta: cat.conta, categoriaNome: cat.nome, origem: 'LANCAMENTO' });
  }
}

/**
 * Conta contábil a partir do que já foi classificado antes.
 *
 * ── Por que a história vem antes da IA ──────────────────────────────────
 *
 * O mesmo fornecedor aparece todo mês com a mesma descrição. Depois da
 * primeira classificação — feita pela IA ou pelo contador —, a segunda é
 * dedução a partir de fato verificado, não inferência. Isso é mais barato,
 * mais rápido e mais confiável que perguntar de novo, e faz a precisão subir
 * com o uso em vez de depender do modelo.
 *
 * A IA continua entrando: ela classifica o que a história ainda não conhece,
 * pelo agente que já existe. Aqui fica só o que se pode afirmar.
 */
/**
 * Movimentos que se identificam pela forma, igual em todo banco e toda
 * empresa. Não passam pela IA nem viram pergunta:
 *
 * - Aplicação/resgate (RDB, CDB, poupança, renda fixa): o dinheiro não sai da
 *   empresa, muda de conta — Aplicações de Liquidez Imediata.
 * - Pagamento do DAS: quita o Simples a Recolher que a apuração provisionou.
 *   Lançar como despesa de novo dobraria o imposto na DRE (visto na Gateway,
 *   28/09/2026). Quando a guia está no Hub como conta a pagar, a conciliação
 *   casa com ela antes de chegar aqui.
 */
export function contaPorRegra(descricao: string, valor: number): string | null {
  const d = descricao.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(aplicacao|resgate|investimento|rendimento)\b/.test(d) && /\b(rdb|cdb|lci|lca|poupanca|renda fixa|caixinha|cofrinho)\b/.test(d)) {
    return ACCOUNTS.APLICACOES;
  }
  if (valor < 0 && /\b(das[\s-]*simples|simples nacional|pgdas)\b/.test(d)) return ACCOUNTS.DAS_A_RECOLHER;
  return null;
}

async function contaPelaHistoria(
  tx: DbHandle,
  companyId: string,
  descricao: string,
  valor: number,
): Promise<string | null> {
  // Antes de tudo, o que a própria forma do movimento já diz — sem palpite.
  const fixa = contaPorRegra(descricao, valor);
  if (fixa) return fixa;
  if (await saidaParaSocio(tx, companyId, descricao, valor)) return ACCOUNTS.LUCROS_A_PAGAR;

  // Depois o que alguém ENSINOU (contador, empresário, IA verificada) — ver
  // `conhecimento.ts`. Só depois a dedução pelos lançamentos antigos.
  const conhecido = await consultarConhecimento(tx, companyId, descricao, valor);
  if (conhecido) return conhecido.conta;

  const chave = normalizarDescricao(descricao);
  if (chave.length < 4) return null;

  const [achado] = (await tx.execute(sql`
    SELECT c.accounting_code AS conta, count(*)::int AS vezes
      FROM financial_entry e
      JOIN category c ON c.id = e.category_id
     WHERE e.company_id = ${companyId}
       AND c.accounting_code IS NOT NULL
       AND e.type = ${valor > 0 ? 'RECEIVABLE' : 'PAYABLE'}
       AND regexp_replace(lower(e.description), '[^a-z0-9 ]', '', 'g') LIKE ${'%' + chave + '%'}
     GROUP BY c.accounting_code
     ORDER BY vezes DESC
     LIMIT 1
  `)) as unknown as { conta: string; vezes: number }[];

  return achado?.conta ?? null;
}

export interface MovimentoNaTransitoria {
  bankTransactionId: string;
  journalEntryId: string;
  data: string;
  valor: number;
  descricao: string;
}

/**
 * Movimentos parados na transitória, esperando quem diga o que são.
 *
 * É a fila que a IA e o contador atacam — e a mesma que trava o fechamento.
 */
export async function movimentosNaTransitoria(
  tx: DbHandle,
  companyId: string,
  limite = 40,
): Promise<MovimentoNaTransitoria[]> {
  return (await tx.execute(sql`
    SELECT b.id::text            AS "bankTransactionId",
           j.id::text            AS "journalEntryId",
           to_char(j.entry_date, 'YYYY-MM-DD') AS data,
           b.amount::float       AS valor,
           b.description         AS descricao
      FROM journal_entry j
      JOIN ledger_line l  ON l.journal_entry_id = j.id
      JOIN chart_of_account a ON a.id = l.account_id
      JOIN bank_transaction b ON b.id = j.source_id
     WHERE j.company_id = ${companyId}
       AND j.source = 'BANK_TRANSACTION'
       AND j.status = 'POSTED'
       AND j.reversed_by IS NULL
       -- O estorno também tem linha na transitória e nunca é estornado: sem
       -- este filtro ele voltava à fila como "pendente", a IA identificava de
       -- novo e a reclassificação estornava o estorno (Gateway, 28/09/2026).
       AND j.event = 'SETTLEMENT'
       AND a.code = ${ACCOUNTS.VALORES_A_CLASSIFICAR}
     ORDER BY j.entry_date DESC
     LIMIT ${String(limite)}
  `)) as unknown as MovimentoNaTransitoria[];
}

/**
 * Tira um movimento da transitória e o põe na conta certa.
 *
 * Por ESTORNO, como toda correção neste razão: a partida antiga continua lá,
 * marcada, com a espelho ao lado. É o que permite responder depois "este
 * movimento ficou sem identificação até o dia tal, e quem o identificou foi
 * a IA" — precisamente o tipo de pergunta que aparece quando quem classificou
 * não foi uma pessoa.
 */
export async function reclassificarMovimento(
  tx: DbHandle,
  companyId: string,
  bankTransactionId: string,
  contaContabil: string,
  motivo: string,
): Promise<{ ok: boolean; erro?: string }> {
  const [mov] = (await tx.execute(sql`
    SELECT j.id::text AS journal_id, to_char(b.posted_at,'YYYY-MM-DD') AS data,
           b.amount::float AS valor, b.description AS descricao
      FROM bank_transaction b
      JOIN journal_entry j ON j.source_id = b.id AND j.source = 'BANK_TRANSACTION'
     WHERE b.id = ${bankTransactionId}
       AND b.company_id = ${companyId}
       AND j.status = 'POSTED'
       AND j.reversed_by IS NULL
       AND j.event = 'SETTLEMENT'
     LIMIT 1
  `)) as unknown as { journal_id: string; data: string; valor: number; descricao: string }[];

  if (!mov) return { ok: false, erro: 'Movimento não encontrado ou já reclassificado.' };

  // A conta tem que existir ANTES do estorno: estornar e não conseguir lançar
  // de novo tira o movimento do razão e deixa o banco errado.
  const [destino] = (await tx.execute(sql`
    SELECT 1 AS ok FROM chart_of_account
     WHERE company_id = ${companyId} AND code = ${contaContabil} AND analytical AND active
  `)) as unknown as { ok: number }[];
  if (!destino) return { ok: false, erro: `A conta ${contaContabil} não existe no plano de contas desta empresa.` };

  // Mês ainda aberto: o estorno sai na data do movimento e o balancete daquele
  // mês fica certo. Datar com hoje deixava o valor na transitória de junho até
  // setembro. Mês já conferido/enviado não se mexe: aí o estorno é de hoje.
  const [fechado] = (await tx.execute(sql`
    SELECT 1 AS ok FROM monthly_closure
     WHERE company_id = ${companyId}
       AND reference_month = date_trunc('month', ${mov.data}::date)::date
       AND stage IN ('CONFERIDO', 'ENVIADO')
  `)) as unknown as { ok: number }[];
  const dataDoEstorno = fechado ? new Date().toISOString().slice(0, 10) : mov.data;
  await reverseJournal(tx, companyId, mov.journal_id, motivo, dataDoEstorno);

  await postJournal(tx, companyId, accrueBankTransaction({
    id: bankTransactionId,
    data: mov.data,
    valor: mov.valor,
    descricao: mov.descricao,
    resultAccountCode: contaContabil,
  }));

  return { ok: true };
}

/** Saldo da transitória — é ele que trava o fechamento. */
export async function saldoDaTransitoria(
  tx: DbHandle,
  companyId: string,
  ate: string,
): Promise<{ saldo: number; quantidade: number }> {
  const [r] = (await tx.execute(sql`
    -- Saldo é a soma de TODAS as linhas publicadas: o original estornado e o
    -- seu estorno se anulam. Tirar só o original (reversed_by IS NULL) deixava
    -- o estorno sozinho e inflava o saldo que trava o fechamento.
    SELECT COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0)::float AS saldo,
           count(*) FILTER (WHERE j.event = 'SETTLEMENT' AND j.reversed_by IS NULL)::int AS quantidade
      FROM ledger_line l
      JOIN journal_entry j ON j.id = l.journal_entry_id
      JOIN chart_of_account a ON a.id = l.account_id
     WHERE l.company_id = ${companyId}
       AND a.code = ${ACCOUNTS.VALORES_A_CLASSIFICAR}
       AND j.status = 'POSTED'
       AND j.entry_date <= ${ate}::date
  `)) as unknown as { saldo: number; quantidade: number }[];

  return { saldo: r?.saldo ?? 0, quantidade: r?.quantidade ?? 0 };
}
