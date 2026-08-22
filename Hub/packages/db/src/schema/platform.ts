import { pgTable, uuid, text, numeric, date, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { company, appUser } from './tenancy';
import {
  ticketStatus,
  ticketPriority,
  integrationKind,
  subscriptionStatus,
  notificationSeverity,
} from './_enums';

/**
 * MÓDULO 5 — Cofre Digital, Suporte e Planos + plataforma (integrações,
 * notificações). Comum a SERVICE e HOLDING.
 */

/** Cofre Digital — arquivos fixos (Contrato Social, Alvarás...). */
export const vaultDocument = pgTable('vault_document', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Help Desk. */
export const ticket = pgTable('ticket', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  category: text('category'),
  status: ticketStatus('status').notNull().default('OPEN'),
  priority: ticketPriority('priority').notNull().default('MEDIUM'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ticketMessage = pgTable('ticket_message', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => ticket.id, { onDelete: 'cascade' }),
  authorUserId: uuid('author_user_id').references(() => appUser.id),
  sender: text('sender').notNull().default('CLIENT'), // 'CLIENT' | 'ACCOUNTING'
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Catálogo de planos (Início, Crescimento...). monthlyValue = valor mensal. */
export const plan = pgTable('plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  monthlyValue: numeric('monthly_value', { precision: 14, scale: 2 }).notNull(),
  features: jsonb('features'),
});

export const subscription = pgTable('subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plan.id),
  status: subscriptionStatus('status').notNull().default('TRIAL'),
  currentPeriodStart: date('current_period_start'),
  currentPeriodEnd: date('current_period_end'),
  asaasCustomerId: text('asaas_customer_id'),
  asaasSubscriptionId: text('asaas_subscription_id'),
});

/** Credenciais por empresa para cada integração (segredo fica em secret manager). */
export const integrationCredential = pgTable('integration_credential', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  kind: integrationKind('kind').notNull(),
  provider: text('provider').notNull(),
  secretRef: jsonb('secret_ref'),
  active: boolean('active').notNull().default(true),
});

/** Avisos Urgentes (Dashboard) + alertas do Termômetro Tributário. */
export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  severity: notificationSeverity('severity').notNull().default('INFO'),
  title: text('title').notNull(),
  body: text('body'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
