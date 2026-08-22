import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { company } from './tenancy';
import {
  propertyKind,
  propertyStatus,
  indexType,
  leaseStatus,
  rentInvoiceStatus,
} from './_enums';

/**
 * OPERAÇÃO HOLDING — Módulo "Gestão Patrimonial".
 * Populado apenas quando company.type = HOLDING.
 */

export const property = pgTable('property', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  kind: propertyKind('kind').notNull().default('OTHER'),
  status: propertyStatus('status').notNull().default('AVAILABLE'),
  address: text('address'),
  acquisitionValue: numeric('acquisition_value', { precision: 14, scale: 2 }),
  acquisitionDate: date('acquisition_date'),
  depreciationRate: numeric('depreciation_rate', { precision: 5, scale: 2 }), // Taxa anual (ex: 4.00, 10.00, 20.00)
  residualValue: numeric('residual_value', { precision: 14, scale: 2 }), // Valor residual (não deprecia)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Contrato de aluguel com automação de reajuste IPCA/IGP-M. */
export const lease = pgTable('lease', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => property.id, { onDelete: 'cascade' }),
  lesseeName: text('lessee_name').notNull(), // locatário
  monthlyRent: numeric('monthly_rent', { precision: 14, scale: 2 }).notNull(),
  indexType: indexType('index_type').notNull().default('IPCA'),
  /** mês-base do último reajuste (NUNCA "competência"). */
  adjustmentAnchor: date('adjustment_anchor').notNull(),
  status: leaseStatus('status').notNull().default('ACTIVE'),
  startDate: date('start_date'),
  endDate: date('end_date'),
});

/** Faturamento imobiliário (recibo/boleto) por mês. */
export const rentInvoice = pgTable('rent_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  leaseId: uuid('lease_id')
    .notNull()
    .references(() => lease.id, { onDelete: 'cascade' }),
  /** mês de referência (NUNCA "competência"). */
  referenceMonth: date('reference_month').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  status: rentInvoiceStatus('status').notNull().default('OPEN'),
  boletoUrl: text('boleto_url'),
  receiptUrl: text('receipt_url'),
});

export const partner = pgTable('partner', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ownershipPct: numeric('ownership_pct', { precision: 6, scale: 3 }).notNull(),
});

/** Painel de Rentabilidade do Sócio — lucro após impostos (Lucro Presumido), por mês. */
export const partnerDistribution = pgTable('partner_distribution', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => partner.id, { onDelete: 'cascade' }),
  /** mês de referência (NUNCA "competência"). */
  referenceMonth: date('reference_month').notNull(),
  grossProfit: numeric('gross_profit', { precision: 14, scale: 2 }).notNull(),
  taxes: numeric('taxes', { precision: 14, scale: 2 }).notNull(),
  netDistributed: numeric('net_distributed', { precision: 14, scale: 2 }).notNull(),
});
