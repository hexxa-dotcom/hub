import { boolean, pgTable, uuid, varchar, timestamp, numeric } from 'drizzle-orm/pg-core';
import { company } from './tenancy';

export const taxHistory = pgTable('tax_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => company.id).notNull(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(), // Format YYYY-MM
  rba12: numeric('rba12', { precision: 15, scale: 2 }).notNull(),
  effectiveRate: numeric('effective_rate', { precision: 5, scale: 2 }).notNull(),
  taxBracket: varchar('tax_bracket', { length: 50 }).notNull(), // e.g. "Anexo III"
  /**
   * 'ONEFLOW' = alíquota EFETIVA de uma apuração real importada.
   * 'ESTIMATE' = cálculo interno, pela faixa.
   *
   * Só a primeira alimenta o imposto aproximado. Sem esta distinção as duas
   * ficavam indistinguíveis, e a estimativa pela nominal acabava sendo lida
   * como se fosse a apuração — superestimando o imposto do cliente.
   */
  source: varchar('source', { length: 16 }).notNull().default('ESTIMATE'),
  /** Do OneFlow: a atividade se sujeita ao Fator R? Nulo = desconhecido. */
  /** Fator R oficial da competência (0.46 = 46%), do OneFlow. */
  fatorR: numeric('fator_r', { precision: 6, scale: 4 }),
  /** Deduzido do anexo apurado + fator. Nulo = não se sabe. */
  fatorRSujeito: boolean('fator_r_sujeito'),
  pdfUrl: varchar('pdf_url', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
