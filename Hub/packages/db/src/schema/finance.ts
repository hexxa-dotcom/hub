import { pgTable, uuid, text, numeric, date, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { company } from './tenancy';
import { entryType, entryStatus, categoryKind, reconciliationStatus } from './_enums';

/**
 * CAMADA FINANCEIRA UNIFICADA — comum a SERVICE e HOLDING.
 * NFSe e aluguel ambos viram financial_entry (RECEIVABLE).
 */

export const bankAccount = pgTable('bank_account', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  bankName: text('bank_name').notNull(),
  number: text('number'),
  currentBalance: numeric('current_balance', { precision: 14, scale: 2 }).notNull().default('0'),
  /** Vínculo com o item do agregador Open Finance. */
  openFinanceItemId: text('open_finance_item_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const businessPartner = pgTable('business_partner', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  document: text('document'), // CPF/CNPJ
  type: text('type').notNull().default('CLIENT'), // CLIENT, SUPPLIER, BOTH
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const costCenter = pgTable('cost_center', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const category = pgTable('category', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: categoryKind('kind').notNull(),
  /** Código Contábil para integração Omie/OneFlow (ex: 1.1.01.01) */
  accountingCode: text('accounting_code'),
  /** Grupo Contábil (Ativo, Passivo, Despesa, Receita) */
  accountingGroup: text('accounting_group'),
});

export const financialEntry = pgTable('financial_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id').references(() => bankAccount.id),
  categoryId: uuid('category_id').references(() => category.id),
  partnerId: uuid('partner_id').references(() => businessPartner.id),
  costCenterId: uuid('cost_center_id').references(() => costCenter.id),
  type: entryType('type').notNull(),
  status: entryStatus('status').notNull().default('PENDING'),
  description: text('description').notNull(),
  /** amount = Valor final pago (originalAmount + interest - discount) */
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  originalAmount: numeric('original_amount', { precision: 14, scale: 2 }),
  interest: numeric('interest', { precision: 14, scale: 2 }), // Juros e Multas
  discount: numeric('discount', { precision: 14, scale: 2 }), // Descontos
  dueDate: date('due_date').notNull(),
  /** mês de referência (NUNCA "competência"). Primeiro dia do mês. */
  referenceMonth: date('reference_month').notNull(),
  /** Origem operacional do lançamento: NFSE | RENT | MANUAL | IMPORT. */
  source: text('source').notNull().default('MANUAL'),
  sourceId: uuid('source_id'),
  externalId: text('external_id').unique(),
  paidAt: date('paid_at'),
  notes: text('notes'),
  /** Comprovante anexado (recibo/nota/print do Pix) — guardado em base64, sem storage externo. */
  receiptBase64: text('receipt_base64'),
  receiptFilename: text('receipt_filename'),
  receiptMimeType: text('receipt_mime_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Despesa fixa mensal (aluguel, softwares, mensalidades). O cron
 * `api/cron/despesas-fixas` gera um financial_entry PAYABLE (source='RECURRING')
 * por mês de referência, uma vez, controlado por `last_generated_month`.
 */
export const recurringExpense = pgTable('recurring_expense', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('PAYABLE'),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  categoryName: text('category_name'),
  /** Dia do vencimento no mês (1-28, pra funcionar em qualquer mês). */
  dueDay: integer('due_day').notNull(),
  active: boolean('active').notNull().default(true),
  /** Primeiro mês de referência em que deve gerar (primeiro dia do mês). */
  startMonth: date('start_month').notNull(),
  /** Último mês de referência em que deve gerar, ou null = indefinido. */
  endMonth: date('end_month'),
  lastGeneratedMonth: date('last_generated_month'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Transações importadas do banco (Open Finance) para conciliação. */
export const bankTransaction = pgTable('bank_transaction', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id')
    .notNull()
    .references(() => bankAccount.id, { onDelete: 'cascade' }),
  externalId: text('external_id'),
  postedAt: date('posted_at').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  description: text('description').notNull(),
  reconciliationStatus: reconciliationStatus('reconciliation_status')
    .notNull()
    .default('UNMATCHED'),
});

/** Ligação 1:1 entre uma transação bancária e um lançamento. */
export const reconciliationMatch = pgTable('reconciliation_match', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  bankTransactionId: uuid('bank_transaction_id')
    .notNull()
    .unique()
    .references(() => bankTransaction.id, { onDelete: 'cascade' }),
  financialEntryId: uuid('financial_entry_id')
    .notNull()
    .unique()
    .references(() => financialEntry.id, { onDelete: 'cascade' }),
  matchedAt: timestamp('matched_at', { withTimezone: true }).notNull().defaultNow(),
});
