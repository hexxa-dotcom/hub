import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { company } from './tenancy';

/**
 * Config global da Hexxa Insights (feature de dicas contextuais por IA) —
 * plataforma inteira, não por empresa cliente. Uma única linha ("singleton").
 * A chave da API fica cifrada (ver secret-crypto.ts), nunca em texto puro.
 */
export const aiInsightConfig = pgTable('ai_insight_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  enabled: boolean('enabled').notNull().default(false),
  /** 'anthropic' | 'gemini' — qual API a chave abaixo pertence. */
  provider: text('provider').notNull().default('anthropic'),
  apiKeyEncrypted: text('api_key_encrypted'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Liga/desliga a Hexxa Insights por seção específica do sistema (pageKey). */
export const aiInsightSection = pgTable('ai_insight_section', {
  pageKey: text('page_key').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cache de dicas contextuais geradas por IA (uma por empresa+página).
 * Evita chamar o modelo a cada carregamento — só regenera quando o
 * `contextHash` muda (dado relevante mudou) ou o cache expira.
 */
export const aiInsight = pgTable('ai_insight', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  pageKey: text('page_key').notNull(),
  content: text('content').notNull(),
  contextHash: text('context_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
