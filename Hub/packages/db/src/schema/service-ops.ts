import { pgTable, uuid, text, numeric, boolean, integer, date, timestamp, bigint } from 'drizzle-orm/pg-core';
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
  companyId: uuid('company_id')
    .primaryKey()
    .references(() => company.id, { onDelete: 'cascade' }),
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
  ultNsuDistribuicao: bigint('ult_nsu_distribuicao', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Documentos (NFS-e emitidas/recebidas + eventos) sincronizados da
 * Distribuição de DF-e do Sistema Nacional NFS-e (ADN) — espelha a migration
 * 0048_nfse_distribuicao_dfe.sql. Leituras/escritas reais passam por SQL cru
 * em lib/server/nfse-dfe-sync.ts.
 */
export const nfseDistribuicaoDoc = pgTable('nfse_distribuicao_doc', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  nsu: bigint('nsu', { mode: 'number' }).notNull(),
  chaveAcesso: text('chave_acesso').notNull(),
  tipoDocumento: text('tipo_documento').notNull(),
  tipoEvento: text('tipo_evento'),
  direction: text('direction'), // EMITIDA | RECEBIDA
  numeroNfse: text('numero_nfse'),
  municipioEmissao: text('municipio_emissao'),
  dataEmissao: timestamp('data_emissao', { withTimezone: true }),
  valorServico: numeric('valor_servico', { precision: 14, scale: 2 }),
  valorLiquido: numeric('valor_liquido', { precision: 14, scale: 2 }),
  valorIss: numeric('valor_iss', { precision: 14, scale: 2 }),
  prestadorCnpj: text('prestador_cnpj'),
  prestadorNome: text('prestador_nome'),
  tomadorDocumento: text('tomador_documento'),
  tomadorNome: text('tomador_nome'),
  descricaoServico: text('descricao_servico'),
  itemListaServico: text('item_lista_servico'),
  cancelado: boolean('cancelado').notNull().default(false),
  dataHoraGeracao: timestamp('data_hora_geracao', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const nfseServiceProfile = pgTable('nfse_service_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  itemListaServico: text('item_lista_servico').notNull(),
  codigoTributacaoMunicipio: text('codigo_tributacao_municipio'),
  cnae: text('cnae'),
  aliquotaIss: numeric('aliquota_iss', { precision: 5, scale: 2 }),
  defaultDescription: text('default_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  endDate: date('end_date'),
  notes: text('notes'),
  /** Se true, o cron de cobrança emite a NFSe automaticamente a cada ciclo, em vez de só lançar o recebível. */
  autoEmitNfse: boolean('auto_emit_nfse').notNull().default(false),
  /** Descrição do serviço usada na NFSe emitida automaticamente. Obrigatória quando autoEmitNfse=true. */
  serviceDescription: text('service_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Contrato comercial do próprio tenant com clientes/fornecedores dele
 * (ENTRADA = ele presta o serviço → contas a receber; SAIDA = ele contrata
 * → contas a pagar). Quando a contraparte também é empresa na Hexxa
 * (achada pelo CNPJ), gera o contrato espelho do outro lado e liga os dois
 * via mirrorContractId. Não confundir com `contract` (cliente de assessoria
 * contábil) nem com `accountingContract` (contrato da Hexxa com o tenant).
 */
export const businessContract = pgTable('business_contract', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // ENTRADA | SAIDA
  title: text('title').notNull(),
  partyName: text('party_name').notNull(),
  partyCnpj: text('party_cnpj'),
  counterpartyCompanyId: uuid('counterparty_company_id').references(() => company.id),
  mirrorContractId: uuid('mirror_contract_id'),
  value: numeric('value', { precision: 14, scale: 2 }).notNull(),
  dueDay: integer('due_day').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  /** Data em que o contrato foi de fato assinado (pode ficar em aberto até a assinatura acontecer). */
  signingDate: date('signing_date'),
  /**
   * AGUARDANDO_ASSINATURA | ATIVO | CANCELADO | RECUSADO | EXPIRADO.
   * Nasce AGUARDANDO_ASSINATURA quando criado pelo wizard com assinatura
   * eletrônica (financial_entry só é gerado quando o webhook do DocuSeal
   * confirma SIGNED); nasce ATIVO direto no fluxo de "registro rápido"
   * (sem assinatura) ou quando o PDF já vem assinado fora do sistema.
   */
  status: text('status').notNull().default('ATIVO'),
  autoEmitNfse: boolean('auto_emit_nfse').notNull().default(false),
  lastNfseEmitted: boolean('last_nfse_emitted').notNull().default(false),
  nfseNumber: text('nfse_number'),
  /** PDF do contrato gerado (base64) — mesma convenção de financial_entry.receiptBase64, sem storage externo. */
  pdfBase64: text('pdf_base64'),
  /** Motivo informado quando status vira RECUSADO. */
  refusalReason: text('refusal_reason'),
  signatureRequestId: uuid('signature_request_id').references(() => signatureRequest.id),
  /** ID desse prestador (ex.: médico) no SaaS de faturamento do cliente — usado pelo webhook de repasse pra achar o contrato certo. Só relevante quando type='SAIDA'. */
  externalProviderId: text('external_provider_id'),
  /** % do faturamento atribuído a este prestador no SaaS externo que vira financial_entry PAYABLE automaticamente (ex.: 70.00 = 70%). */
  repassePercent: numeric('repasse_percent', { precision: 5, scale: 2 }),
  /** MENSAL | QUINZENAL — só afeta como o valor a pagar é agrupado/exibido (dias 1-15 / 16-fim), não muda quando o evento chega do webhook. */
  paymentFrequency: text('payment_frequency').notNull().default('MENSAL'),
  /** Ver 0073: modelo (CLIENTE | PJ | FORNECEDOR | PROPRIO), objeto, forma de pagamento. */
  model: text('model'),
  description: text('description'),
  paymentTerms: text('payment_terms'),
  /** IPCA | IGPM | NENHUM — e quando é o próximo reajuste. */
  adjustmentIndex: text('adjustment_index').notNull().default('IPCA'),
  nextAdjustmentDate: date('next_adjustment_date'),
  /** HUB | DOCUSEAL | FORA — como o contrato é assinado. */
  signatureMethod: text('signature_method'),
  /** SHA-256 do PDF assinado — o que cada assinatura no Hub confirma. */
  documentHash: text('document_hash'),
  /** Link para esta empresa assinar embutido (DocuSeal). */
  ownSignUrl: text('own_sign_url'),
  /** false no lado espelho: o contrato veio de outra empresa do Hub. */
  initiatedHere: boolean('initiated_here').notNull().default(true),
  partyEmail: text('party_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Assinatura feita dentro do Hub (quando as duas partes usam o sistema). Ver 0073. */
export const contractSignature = pgTable('contract_signature', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => businessContract.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),
  signerName: text('signer_name').notNull(),
  signerCpf: text('signer_cpf'),
  signerEmail: text('signer_email'),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  documentHash: text('document_hash').notNull(),
});

/**
 * Venda avulsa sem nota fiscal (produto físico, serviço abaixo do limite do
 * MEI, venda de balcão etc). Fonte de faturamento irmã da NFSe — sempre gera
 * um financial_entry (source='VENDA', sourceId=sale.id) na hora do registro.
 */
export const sale = pgTable('sale', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customer.id),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull().default('OUTRO'), // PIX | CARTAO | BOLETO | DINHEIRO | OUTRO
  saleDate: date('sale_date').notNull(),
  /** mês de referência (NUNCA "competência"). */
  referenceMonth: date('reference_month').notNull(),
  received: boolean('received').notNull().default(true),
  notes: text('notes'),
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
  /**
   * Perfil fiscal usado na emissão.
   *
   * Guardado porque é a origem do código LC 116/2003, exigido para mandar a
   * nota ao módulo fiscal do OneFlow. Antes era usado na montagem do XML e
   * descartado — e sem ele o envio teria de adivinhar o item da lista de
   * serviços, o que produziria ISS errado na apuração.
   */
  nfseServiceProfileId: uuid('nfse_service_profile_id').references(() => nfseServiceProfile.id),
  /** Imposto estimado desta nota (R$), calculado na emissão — ver TaxThermometerService. */
  taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }),
  /** Alíquota efetiva usada no cálculo acima (%), pra exibir junto do valor. */
  taxRate: numeric('tax_rate', { precision: 6, scale: 3 }),
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
