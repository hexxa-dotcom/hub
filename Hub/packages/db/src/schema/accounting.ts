import { pgTable, uuid, text, numeric, date, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { company } from './tenancy';
import { docStatus, employeeStatus, employmentEventType } from './_enums';

/**
 * MÓDULO "Minha Contabilidade" — guias de impostos, Departamento Pessoal,
 * honorários. Comum a SERVICE e HOLDING.
 */

/** Guia de imposto organizada por mês, com Copiar Pix. */
export const taxGuide = pgTable('tax_guide', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  taxName: text('tax_name').notNull(), // DAS, INSS, ISS...
  /** mês de referência (NUNCA "competência"). */
  referenceMonth: date('reference_month').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  pixCode: text('pix_code'), // copia-e-cola do botão "Copiar Pix"
  fileUrl: text('file_url'),
  status: docStatus('status').notNull().default('OPEN'),
});

/** Fatura de honorários contábeis. `value` = valor (NUNCA "investimento"). */
export const accountingInvoice = pgTable('accounting_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  value: numeric('value', { precision: 14, scale: 2 }).notNull(),
  /** mês de referência (NUNCA "competência"). */
  referenceMonth: date('reference_month').notNull(),
  dueDate: date('due_date').notNull(),
  pixCode: text('pix_code'),
  status: docStatus('status').notNull().default('OPEN'),
});

/**
 * Contrato de prestação de serviço da Hexxa com o CLIENTE (empresa), gerado
 * em /contador/contratos. Não confundir com `contract` (contrato do tenant
 * com OS CLIENTES dele).
 */
export const accountingContract = pgTable('accounting_contract', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  plano: text('plano').notNull(),
  valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
  inicio: date('inicio').notNull(),
  vigenciaMeses: integer('vigencia_meses'), // null = indeterminado
  servicos: jsonb('servicos').notNull().default([]),
  observacao: text('observacao'),
  status: text('status').notNull().default('ativo'), // ativo | cancelado
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Documentos institucionais (alvará, CND, contrato social...) — "Arquivos Permanentes". */
export const companyDocument = pgTable('company_document', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // ALVARA | CONTRATO | CND | OUTRO
  name: text('name').notNull(),
  issuedAt: date('issued_at'),
  expiresAt: date('expires_at'),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const employee = pgTable('employee', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cpf: text('cpf'),
  roleTitle: text('role_title'),
  salary: numeric('salary', { precision: 14, scale: 2 }),
  status: employeeStatus('status').notNull().default('ACTIVE'),
  admissionDate: date('admission_date'),
  /** CLT | PJ | Socio | Estagiario — só CLT/Socio entram na folha do Fator R. */
  vinculo: text('vinculo').notNull().default('CLT'),
  departamento: text('departamento'),
  email: text('email'),
});

export const payslip = pgTable('payslip', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employee.id, { onDelete: 'cascade' }),
  /** mês de referência (NUNCA "competência"). */
  referenceMonth: date('reference_month').notNull(),
  netAmount: numeric('net_amount', { precision: 14, scale: 2 }).notNull(),
  fileUrl: text('file_url'),
});

export const vacationPeriod = pgTable('vacation_period', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employee.id, { onDelete: 'cascade' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
});

/** Formulários de Admissão/Demissão (form_data flexível em JSON). */
export const employmentEvent = pgTable('employment_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employee.id, { onDelete: 'cascade' }),
  type: employmentEventType('type').notNull(),
  eventDate: date('event_date').notNull(),
  formData: jsonb('form_data'),
});

/**
 * Distribuição de lucros/dividendos. O cliente lança cada distribuição;
 * o total do ano fica visível para ele e para a contabilidade (mesmo tenant).
 */
export const profitDistribution = pgTable('profit_distribution', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  partnerName: text('partner_name').notNull(), // sócio/beneficiário
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  distributedAt: date('distributed_at').notNull(),
  referenceYear: integer('reference_year').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Arquivos permanentes que a contabilidade disponibiliza ao empresário:
 * Alvarás, Contrato Social, CNDs e demais documentos sempre necessários.
 * `expiresAt` é usado nas CNDs para sinalizar validade.
 */
export const permanentFile = pgTable('permanent_file', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // ALVARA | CONTRATO | CND | OUTRO
  name: text('name').notNull(),
  fileUrl: text('file_url'),
  issuedAt: date('issued_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Fechamento Automático do Mês.
 * Gerado automaticamente no dia 1º, consolidando receitas, despesas, e novos contratos.
 */
export const monthlyClosure = pgTable('monthly_closure', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  /** Mês de referência, ex: '2026-06-01' para o fechamento de Junho/2026 */
  referenceMonth: date('reference_month').notNull(),
  totalRevenue: numeric('total_revenue', { precision: 14, scale: 2 }).notNull().default('0'),
  totalExpenses: numeric('total_expenses', { precision: 14, scale: 2 }).notNull().default('0'),
  newContractsCount: integer('new_contracts_count').notNull().default(0),
  defaultsCount: integer('defaults_count').notNull().default(0),
  status: text('status').notNull().default('CLOSED'), // CLOSED, APURADO
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
