import { pgTable, uuid, text, jsonb, boolean, timestamp, date, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { company,appUser } from './tenancy';
import { financialEntry } from './finance';
import { lease } from './patrimonial';

export const paymentReceipt = pgTable('payment_receipt', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => company.id),
  financialEntryId: uuid('financial_entry_id').notNull().references(() => financialEntry.id),
  number: text('number').notNull(),
  verificationHash: text('verification_hash').unique(),
  data: jsonb('data').notNull(),
  pdfHash: text('pdf_hash'),
  snapshotHash:text('snapshot_hash'),
  pdfBase64: text('pdf_base64').notNull(),
  fiscalEligible: boolean('fiscal_eligible').notNull().default(false),
  oneflowStatus: text('oneflow_status').notNull().default('NAO_APLICAVEL'),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('payment_receipt_company_entry').on(t.companyId, t.financialEntryId), uniqueIndex('payment_receipt_company_number').on(t.companyId, t.number)]);

export const receiptSchedule = pgTable('receipt_schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => company.id),
  financialEntryId: uuid('financial_entry_id').references(() => financialEntry.id),
  leaseId: uuid('lease_id').references(() => lease.id),
  nextDate: date('next_date').notNull(),
  dayOfMonth: integer('day_of_month'),
  active: boolean('active').notNull().default(true),
  sendEmail: boolean('send_email').notNull().default(false),
  lastError: text('last_error'), lastRun: date('last_run'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('receipt_schedule_active_entry').on(t.companyId,t.financialEntryId).where(sql`${t.active} AND ${t.financialEntryId} IS NOT NULL`),
  uniqueIndex('receipt_schedule_active_lease').on(t.companyId,t.leaseId).where(sql`${t.active} AND ${t.leaseId} IS NOT NULL`),
]);

export const receiptShare = pgTable('receipt_share', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => company.id),
  receiptId: uuid('receipt_id').notNull().references(() => paymentReceipt.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const receiptDelivery = pgTable('receipt_delivery', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => company.id),
  receiptId: uuid('receipt_id').notNull().references(() => paymentReceipt.id),
  recipient: text('recipient').notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  status: text('status').notNull(), error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const receiptSignatureAuthorization=pgTable('receipt_signature_authorization',{
 id:uuid('id').primaryKey().defaultRandom(),companyId:uuid('company_id').notNull().references(()=>company.id),
 userId:uuid('user_id').notNull().references(()=>appUser.id),signerName:text('signer_name').notNull(),
 signerCpf:text('signer_cpf').notNull(),signerEmail:text('signer_email').notNull(),consentText:text('consent_text').notNull(),
 authorizedAt:timestamp('authorized_at',{withTimezone:true}).notNull().defaultNow(),ip:text('ip'),userAgent:text('user_agent'),
 revokedAt:timestamp('revoked_at',{withTimezone:true}),revokedBy:uuid('revoked_by').references(()=>appUser.id),
},t=>[uniqueIndex('receipt_signature_authorization_active').on(t.companyId).where(sql`${t.revokedAt} IS NULL`)]);
