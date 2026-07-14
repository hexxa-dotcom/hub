import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { company } from './tenancy';
import { contractStatus, billingCycle, invoiceStatus, signatureStatus } from './_enums';

/**
 * OPERAÇÃO SERVICE — Módulo "Meu Negócio".
 * Populado apenas quando company.type = SERVICE.
 */

export const nfseConfig = pgTable('nfse_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' })
    .unique(),
  certificateType: text('certificate_type'), // A1, A3
  certificateOwner: text('certificate_owner'),
  certificateExpiry: date('certificate_expiry'),
  defaultCnae: text('default_cnae'),
  defaultMunicipalCode: text('default_municipal_code'),
  focusNfeEnv: text('focus_nfe_env').default('homologacao'),
  focusNfeToken: text('focus_nfe_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const nfseServiceProfile = pgTable('nfse_service_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cnae: text('cnae'),
  municipalServiceCode: text('municipal_service_code'),
  defaultIssRate: numeric('default_iss_rate', { precision: 5, scale: 2 }),
  isDefault: text('is_default').default('false'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customer = pgTable('customer', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  document: text('document'), // CPF/CNPJ
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  type: text('type').default('PF'), // PF | PJ
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Contrato de recorrência. `value` = valor (NUNCA "investimento"). */
export const contract = pgTable('contract', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id),
  title: text('title').notNull(),
  value: numeric('value', { precision: 14, scale: 2 }).notNull(),
  billingCycle: billingCycle('billing_cycle').notNull().default('MONTHLY'),
  status: contractStatus('status').notNull().default('DRAFT'),
  nextBillingDate: date('next_billing_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** NFSe emitida via API. */
export const serviceInvoice = pgTable('service_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customer.id),
  contractId: uuid('contract_id').references(() => contract.id),
  nfseNumber: text('nfse_number'),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  serviceDescription: text('service_description').notNull(),
  /** mês de referência (NUNCA "competência"). */
  referenceMonth: date('reference_month').notNull(),
  status: invoiceStatus('status').notNull().default('DRAFT'),
  providerProtocol: text('provider_protocol'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Pedido de assinatura eletrônica (serve a CONTRACT e a LEASE). */
export const signatureRequest = pgTable('signature_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  subjectType: text('subject_type').notNull(), // 'CONTRACT' | 'LEASE'
  subjectId: uuid('subject_id').notNull(),
  status: signatureStatus('status').notNull().default('PENDING'),
  providerEnvelopeId: text('provider_envelope_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
