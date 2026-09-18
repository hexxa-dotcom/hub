import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { accrueBankTransaction, ACCOUNTS } from '@hexxa/core';
import { postJournal, reverseJournal } from './repository';
import { escriturarLancamento } from './escrituracao';

/**
 * CONCILIAÇÃO E ESCRITURAÇÃO DO EXTRATO.
 *
 * ── A ordem importa mais que qualquer outra coisa aqui ──────────────────
 *
 * Primeiro CASAR, depois classificar. Um pagamento de fornecedor que já está
 * no Hub como conta a pagar não é uma despesa nova: é a BAIXA daquela conta.
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

      const conta = await contaPelaHistoria(tx, companyId, t.descricao, t.valor);
      await postJournal(tx, companyId, accrueBankTransaction({
        id: t.id, data: t.data, valor: t.valor,
        descricao: t.descricao, resultAccountCode: conta,
      }));

      await tx.execute(sql`
        UPDATE bank_transaction SET reconciliation_status = 'MATCHED' WHERE id = ${t.id}
      `);

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
  t: { id: string; data: string; valor: number },
): Promise<'CASOU' | 'AMBIGUO' | 'SEM_PAR'> {
  const tipo = t.valor > 0 ? 'RECEIVABLE' : 'PAYABLE';

  const candidatos = (await tx.execute(sql`
    SELECT id::text FROM financial_entry
     WHERE company_id = ${companyId}
       AND type = ${tipo}
       AND status <> 'PAID'
       AND abs(amount::numeric - ${Math.abs(t.valor).toFixed(2)}::numeric) < 0.01
       -- O intervalo vai como TEXTO: este driver recusa número cru em
       -- consulta parametrizada, e o erro sai como "argumento string
       -- esperado" — nada que faça pensar em aritmética de datas.
       AND due_date BETWEEN ${t.data}::date - ${`${JANELA_DE_DIAS} days`}::interval
                        AND ${t.data}::date + ${`${JANELA_DE_DIAS} days`}::interval
     LIMIT 5
  `)) as unknown as { id: string }[];

  if (candidatos.length === 0) return 'SEM_PAR';
  if (candidatos.length > 1) return 'AMBIGUO';

  const entryId = candidatos[0]!.id;

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
  return 'CASOU';
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
async function contaPelaHistoria(
  tx: DbHandle,
  companyId: string,
  descricao: string,
  valor: number,
): Promise<string | null> {
  const chave = normalizar(descricao);
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

/** Reduz a descrição ao miolo que se repete entre meses. */
function normalizar(d: string): string {
  return d
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    // Números de documento, parcela e data mudam a cada mês e atrapalham.
    .replace(/\b\d+\b/g, ' ')
    .replace(/\b(pix|ted|doc|pagamento|transferencia|debito|credito|enviado|recebido)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
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
     LIMIT 1
  `)) as unknown as { journal_id: string; data: string; valor: number; descricao: string }[];

  if (!mov) return { ok: false, erro: 'Movimento não encontrado ou já reclassificado.' };

  const hoje = new Date().toISOString().slice(0, 10);
  await reverseJournal(tx, companyId, mov.journal_id, motivo, hoje);

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
    SELECT COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0)::float AS saldo,
           count(*)::int AS quantidade
      FROM ledger_line l
      JOIN journal_entry j ON j.id = l.journal_entry_id
      JOIN chart_of_account a ON a.id = l.account_id
     WHERE l.company_id = ${companyId}
       AND a.code = ${ACCOUNTS.VALORES_A_CLASSIFICAR}
       AND j.status = 'POSTED'
       AND j.reversed_by IS NULL
       AND j.entry_date <= ${ate}::date
  `)) as unknown as { saldo: number; quantidade: number }[];

  return { saldo: r?.saldo ?? 0, quantidade: r?.quantidade ?? 0 };
}
