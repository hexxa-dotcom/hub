import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { appUser } from './tenancy';

/**
 * Configuração de operação em três camadas, guardando SÓ as exceções.
 *
 * `scope` = 'SYSTEM' (chave nula) | 'PROFILE' ('SERVICE'|'HOLDING') |
 * 'COMPANY' (id da empresa). `settings` é uma sobrescrita parcial no formato
 * de `SettingsParcial` (@hexxa/core) — nunca a configuração inteira.
 *
 * O motivo de ser parcial está na migration 0053: cópia integral congelaria
 * cada empresa na versão do dia em que foi cadastrada.
 */
export const operationSetting = pgTable(
  'operation_setting',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    scopeKey: text('scope_key'),
    settings: jsonb('settings').notNull().default({}),
    updatedByUserId: uuid('updated_by_user_id').references(() => appUser.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_operation_setting_system').on(t.scope).where(sql`scope = 'SYSTEM'`),
    uniqueIndex('uq_operation_setting_scoped')
      .on(t.scope, t.scopeKey)
      .where(sql`scope_key IS NOT NULL`),
  ],
);
