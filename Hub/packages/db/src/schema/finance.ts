import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
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

export const category = pgTable('category', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: categoryKind('kind').notNull(),
});

export const financialEntry = pgTable('financial_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id').references(() => bankAccount.id),
  categoryId: uuid('category_id').references(() => category.id),
  type: entryType('type').notNull(),
  status: entryStatus('status').notNull().default('PENDING'),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  /** mês de referência (NUNCA "competência"). Primeiro dia do mês. */
  referenceMonth: date('reference_month').notNull(),
  /** Origem operacional do lançamento: NFSE | RENT | MANUAL | IMPORT. */
  source: text('source').notNull().default('MANUAL'),
  sourceId: uuid('source_id'),
  externalId: text('external_id'),
  paidAt: date('paid_at'),
  notes: text('notes'),
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
    .references(() => bankTransaction.id, { onDelete: 'cascade' }),
  financialEntryId: uuid('financial_entry_id')
    .notNull()
    .references(() => financialEntry.id, { onDelete: 'cascade' }),
  matchedAt: timestamp('matched_at', { withTimezone: true }).notNull().defaultNow(),
});
