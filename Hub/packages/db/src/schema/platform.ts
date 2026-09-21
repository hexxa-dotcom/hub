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

/**
 * Config GLOBAL da conta Asaas da própria Hexxa (usada pra cobrar TODAS as
 * empresas-cliente da plataforma pela mensalidade do Hub) — singleton (uma
 * linha só), mesmo padrão de `ai_insight_config`. NÃO é por tenant: essa é
 * a chave da Hexxa, não de cada empresa-cliente (ver nota em
 * meu-negocio/clientes/actions.ts sobre isolar por empresa no futuro).
 * lib/asaas.ts lê daqui primeiro, cai pra env var (ASAAS_API_KEY etc) se
 * a linha não existir — permite configurar pelo painel do contador sem
 * precisar redeploy.
 */
export const platformAsaasConfig = pgTable('platform_asaas_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  env: text('env').notNull().default('sandbox'), // 'sandbox' | 'production'
  apiKeyEncrypted: text('api_key_encrypted'),
  webhookTokenEncrypted: text('webhook_token_encrypted'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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
  /**
   * Abatimento combinado com este cliente, em reais. A fatura mostra o preço
   * do plano e o desconto separados — se a tabela subir, o acordo continua
   * sendo "R$ 100 a menos", não um preço congelado.
   */
  discountValue: numeric('discount_value', { precision: 14, scale: 2 }).notNull().default('0'),
  discountReason: text('discount_reason'),
  /**
   * Honorário combinado caso a caso. Quando preenchido, ELE é o preço: a
   * tabela do plano e o desconto saem da conta.
   *
   * Existe porque nem todo acordo é um abatimento sobre a tabela. Espremer um
   * valor combinado na forma "R$ 500 − R$ 137" inventa um desconto que não
   * foi combinado e o imprime na fatura do cliente. Ver `valorDosHonorarios`.
   */
  customValue: numeric('custom_value', { precision: 14, scale: 2 }),
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

/**
 * Token de API pessoal por empresa — dá acesso de leitura aos dados
 * financeiros via o servidor MCP (`/api/mcp`), pra conectar um assistente de
 * IA (Claude, ChatGPT) de fora do Hub. Guarda só o hash (sha256) do token;
 * o valor puro só existe uma vez, na hora da criação.
 */
export const apiToken = pgTable('api_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  /** Primeiros caracteres do token, só pra reconhecimento visual na lista (não é segredo). */
  tokenPrefix: text('token_prefix').notNull(),
  /** 'read' só consulta (MCP); 'write' também pode lançar despesa/faturamento via API. */
  scope: text('scope').notNull().default('read'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
