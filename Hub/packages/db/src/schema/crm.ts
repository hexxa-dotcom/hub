import { pgTable, uuid, text, timestamp, boolean, date, numeric } from 'drizzle-orm/pg-core';
import { company } from './tenancy';
import { customer } from './service-ops';

export const proposal = pgTable('proposal', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(),
  cliente: text('cliente').notNull(),
  titulo: text('titulo').notNull(),
  validade: date('validade').notNull(),
  status: text('status').notNull().default('rascunho'), // rascunho|enviada|aprovada|rejeitada|expirada
  observacoes: text('observacoes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const proposalItem = pgTable('proposal_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id')
    .notNull()
    .references(() => proposal.id, { onDelete: 'cascade' }),
  descricao: text('descricao').notNull(),
  qtd: numeric('qtd', { precision: 10, scale: 2 }).notNull().default('1'),
  valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
});

export const emailAccount = pgTable('email_account', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' })
    .unique(),
  provider: text('provider').notNull().default('IMAP'), // 'IMAP' | 'GOOGLE' | 'OUTLOOK'
  emailAddress: text('email_address').notNull(),
  imapHost: text('imap_host'),
  imapPort: text('imap_port'),
  smtpHost: text('smtp_host'),
  smtpPort: text('smtp_port'),
  username: text('username'),
  password: text('password'), // Will store encrypted password or token
  isActive: boolean('is_active').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmTask = pgTable('crm_task', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customer.id, { onDelete: 'set null' }),
  clienteNome: text('cliente_nome'),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  status: text('status').notNull().default('pendente'), // pendente|em_andamento|concluida
  prioridade: text('prioridade').notNull().default('normal'), // baixa|normal|alta|urgente
  prazo: date('prazo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailMessage = pgTable('email_message', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => emailAccount.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id, { onDelete: 'cascade' }),
  remoteId: text('remote_id').notNull(), // UID of the IMAP message
  subject: text('subject'),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  bodyText: text('body_text'),
  isRead: boolean('is_read').notNull().default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
