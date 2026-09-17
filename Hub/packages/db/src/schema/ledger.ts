import { pgTable, uuid, text, numeric, date, timestamp, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { company, appUser } from './tenancy';
import { businessPartner, costCenter } from './finance';
import {
  accountType,
  accountNature,
  ledgerDirection,
  journalStatus,
  journalSource,
  journalEvent,
} from './_enums';

/**
 * ESCRITURAÇÃO CONTÁBIL — razão de partidas dobradas.
 *
 * Por que isto existe: até aqui o Hub guardava movimento de caixa
 * (`financial_entry`) e um "fechamento" que era a soma desse movimento. Soma
 * não é escrituração: não se confere, não vira balanço, e não se entrega à
 * contabilidade. Sem um razão, qualquer trabalho que uma IA fizesse sobre
 * esses números seria inverificável — não haveria invariante contra o qual
 * checar o resultado.
 *
 * O razão é esse invariante: débito igual a crédito, sempre, garantido por
 * trigger no banco (ver migration 0049). É o chão sobre o qual as camadas de
 * agente se apoiam.
 *
 * Relação com o que já existia:
 * - `category` (finance.ts) continua sendo a categoria GERENCIAL do
 *   lançamento de caixa, e seu `accountingCode` é o de-para para a conta
 *   contábil de resultado.
 * - `financial_entry` continua sendo o documento financeiro. A partida é
 *   derivada dele, não o substitui.
 */

/**
 * Plano de contas contábil, na numeração do ANEXO 7 da ITG 1000 (CFC,
 * Resolução 1.418/2012) — a mesma já usada em `seed-categories-anexo7.ts`,
 * agora estendida aos grupos 1 (Ativo) e 2 (Passivo e PL), que aquele seed
 * deliberadamente deixou de fora por não haver escrituração ainda.
 */
export const chartOfAccount = pgTable(
  'chart_of_account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => company.id, { onDelete: 'cascade' }),
    /** Código hierárquico, ex: '1.1.02.001'. Único por empresa. */
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: accountType('type').notNull(),
    nature: accountNature('nature').notNull(),
    /** Conta de agrupamento imediatamente acima, ex: '1.1.02' para '1.1.02.001'. */
    parentCode: text('parent_code'),
    /**
     * Só conta analítica recebe lançamento. Sintética existe para somar as
     * filhas no balanço — lançar nela quebraria o total do grupo.
     */
    analytical: boolean('analytical').notNull().default(true),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_chart_of_account_company_code').on(t.companyId, t.code),
    index('idx_chart_of_account_company').on(t.companyId),
  ],
);

/**
 * Partida (cabeçalho do lançamento contábil). As linhas de débito e crédito
 * ficam em `ledger_line`.
 */
export const journalEntry = pgTable(
  'journal_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => company.id, { onDelete: 'cascade' }),
    /** Data do fato contábil. */
    entryDate: date('entry_date').notNull(),
    /** mês de referência (NUNCA "competência"). Primeiro dia do mês. */
    referenceMonth: date('reference_month').notNull(),
    /** Histórico do lançamento — o texto que a contabilidade lê. */
    memo: text('memo').notNull(),
    source: journalSource('source').notNull(),
    /** Id do documento de origem na sua própria tabela. Null em MANUAL/OPENING. */
    sourceId: uuid('source_id'),
    event: journalEvent('event').notNull(),
    status: journalStatus('status').notNull().default('DRAFT'),
    /**
     * Partida espelho que anulou esta. Preenchido = estornada.
     *
     * A original continua POSTED: partida publicada não se despublica, e a
     * espelho ao lado a anula somando zero. Tirá-la do balancete faria o
     * estorno ser contado duas vezes.
     */
    reversedBy: uuid('reversed_by'),
    /**
     * Quem lançou. Null quando a autoria é de um agente — nesse caso
     * `agentRunId` responde por ela (ver migration da camada de trilha).
     */
    createdByUserId: uuid('created_by_user_id').references(() => appUser.id, { onDelete: 'set null' }),
    /**
     * Execução de agente que produziu a partida. A FK é adicionada junto com a
     * tabela `agent_run` (item 3 do plano); aqui fica a coluna, para que
     * partidas lançadas por IA já nasçam rastreáveis.
     */
    agentRunId: uuid('agent_run_id'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_journal_entry_company').on(t.companyId),
    index('idx_journal_entry_month').on(t.companyId, t.referenceMonth),
    /**
     * Idempotência: um documento só produz uma partida por fato DERIVADO.
     * É esta restrição que torna seguro um agente reexecutar o lançamento
     * depois de uma falha parcial — a segunda tentativa colide em vez de
     * duplicar a receita.
     *
     * Cobre só ACCRUAL e SETTLEMENT, que acontecem uma vez por documento.
     * Estorno e ajuste ficam de fora de propósito: um lançamento
     * reclassificado duas vezes precisa ser estornado duas vezes, e incluir
     * REVERSAL aqui travava justamente a correção — o caminho que o sistema
     * oferece para consertar erro de agente.
     */
    uniqueIndex('uq_journal_entry_source_event')
      .on(t.companyId, t.source, t.sourceId, t.event)
      .where(
        sql`source_id IS NOT NULL AND reversed_by IS NULL AND event IN ('ACCRUAL', 'SETTLEMENT')`,
      ),
  ],
);

/**
 * Linha do razão. Débito e crédito são o enum `direction` e o valor é sempre
 * positivo — nunca um número com sinal, que abriria espaço para um "débito
 * negativo" que ninguém sabe ler.
 */
export const ledgerLine = pgTable(
  'ledger_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Denormalizado do cabeçalho para RLS e índice, como nas demais tabelas. */
    companyId: uuid('company_id')
      .notNull()
      .references(() => company.id, { onDelete: 'cascade' }),
    journalEntryId: uuid('journal_entry_id')
      .notNull()
      .references(() => journalEntry.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => chartOfAccount.id),
    direction: ledgerDirection('direction').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    /** Ordem de exibição dentro da partida. */
    sequence: integer('sequence').notNull().default(0),
    /** Complemento do histórico, quando a linha precisa dizer mais que o cabeçalho. */
    lineMemo: text('line_memo'),
    partnerId: uuid('partner_id').references(() => businessPartner.id, { onDelete: 'set null' }),
    costCenterId: uuid('cost_center_id').references(() => costCenter.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('idx_ledger_line_company').on(t.companyId),
    index('idx_ledger_line_journal').on(t.journalEntryId),
    index('idx_ledger_line_account').on(t.accountId),
  ],
);
