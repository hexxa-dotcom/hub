import { pgTable, uuid, varchar, timestamp, numeric } from 'drizzle-orm/pg-core';
import { company } from './tenancy';

export const taxHistory = pgTable('tax_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => company.id).notNull(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(), // Format YYYY-MM
  rba12: numeric('rba12', { precision: 15, scale: 2 }).notNull(),
  effectiveRate: numeric('effective_rate', { precision: 5, scale: 2 }).notNull(),
  taxBracket: varchar('tax_bracket', { length: 50 }).notNull(), // e.g. "Anexo III"
  pdfUrl: varchar('pdf_url', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
