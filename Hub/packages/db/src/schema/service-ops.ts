import { pgTable, uuid, text, numeric, boolean, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { company } from './tenancy';
import { contractStatus, billingCycle, invoiceStatus, signatureStatus } from './_enums';

/**
 * OPERAÇÃO SERVICE — Módulo "Meu Negócio".
 * Populado apenas quando company.type = SERVICE.
 */

/**
 * Cadastro fiscal do Emissor Nacional (gov.br) + certificado A1 por tenant.
 * Espelha a migration 0002_nfse_config.sql — leituras/escritas reais hoje
 * passam por SQL cru em lib/server/fiscal.ts, então mantenha isto em sincronia
 * com a migration se ela mudar.
 */
export const nfseConfig = pgTable('nfse_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' })
    .unique(),
  ambiente: text('ambiente').notNull().default('homologacao'), // homologacao | producao
  cnpj: text('cnpj'),
  razaoSocial: text('razao_social'),
  nomeFantasia: text('nome_fantasia'),
  inscricaoMunicipal: text('inscricao_municipal'),
  codigoMunicipio: text('codigo_municipio'), // IBGE 7 dígitos
  optanteSimples: boolean('optante_simples').notNull().default(true),
  regimeEspecial: text('regime_especial'),
  regimeApuracao: text('regime_apuracao'),
  emitirExterior: boolean('emitir_exterior').notNull().default(false),
  cep: text('cep'),
  logradouro: text('logradouro'),
  numero: text('numero'),
  complemento: text('complemento'),
  bairro: text('bairro'),
  uf: text('uf'),
  emailContato: text('email_contato'),
  telefone: text('telefone'),
  itemListaServico: text('item_lista_servico'),
  codigoTributacaoMunicipio: text('codigo_tributacao_municipio'),
  cnae: text('cnae'),
  aliquotaIss: numeric('aliquota_iss', { precision: 5, scale: 2 }),
  serieDps: text('serie_dps').notNull().default('00001'),
  proxNumeroDps: integer('prox_numero_dps').notNull().default(1),
  certPfxB64: text('cert_pfx_b64'),
  certPassword: text('cert_password'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  /**
   * 'gov' = emitida de verdade no Emissor Nacional; 'mock' = modo de teste
   * (sem certificado A1 configurado) — a UI precisa deixar isso visível pro
   * usuário, nunca mostrar uma nota mock como se fosse uma emissão real.
   */
  providerMode: text('provider_mode'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Pedido de assinatura eletrônica (serve a CONTRACT, LEASE ou DOCUMENT avulso). */
export const signatureRequest = pgTable('signature_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  subjectType: text('subject_type').notNull(), // 'CONTRACT' | 'LEASE' | 'DOCUMENT'
  subjectId: uuid('subject_id').notNull(),
  status: signatureStatus('status').notNull().default('PENDING'),
  providerEnvelopeId: text('provider_envelope_id'), // ex.: submission_id do DocuSeal
  title: text('title'),
  signerName: text('signer_name'),
  signerEmail: text('signer_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
