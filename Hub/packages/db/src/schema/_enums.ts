import { pgEnum } from 'drizzle-orm/pg-core';

export const companyType = pgEnum('company_type', ['SERVICE', 'HOLDING']);
export const taxRegime = pgEnum('tax_regime', [
  'SIMPLES_NACIONAL',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
]);
export const userRole = pgEnum('user_role', [
  'OWNER',
  'ADMIN',
  'FINANCE',
  'STAFF',
  'ACCOUNTANT',
  'VIEWER',
]);
export const entryType = pgEnum('entry_type', ['PAYABLE', 'RECEIVABLE']);
export const entryStatus = pgEnum('entry_status', ['PENDING', 'PAID', 'OVERDUE', 'CANCELED']);
export const categoryKind = pgEnum('category_kind', ['INCOME', 'EXPENSE']);
export const reconciliationStatus = pgEnum('reconciliation_status', [
  'UNMATCHED',
  'MATCHED',
  'IGNORED',
]);
export const contractStatus = pgEnum('contract_status', [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'CANCELED',
  'FINISHED',
]);
export const billingCycle = pgEnum('billing_cycle', [
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
]);
export const invoiceStatus = pgEnum('invoice_status', [
  'DRAFT',
  'ISSUING',
  'ISSUED',
  'CANCELED',
  'ERROR',
]);
export const signatureStatus = pgEnum('signature_status', [
  'PENDING',
  'SENT',
  'SIGNED',
  'REFUSED',
  'EXPIRED',
]);
export const docStatus = pgEnum('doc_status', ['OPEN', 'PAID', 'OVERDUE']);
export const employeeStatus = pgEnum('employee_status', ['ACTIVE', 'ON_VACATION', 'TERMINATED']);
export const employmentEventType = pgEnum('employment_event_type', ['ADMISSION', 'TERMINATION']);
export const propertyKind = pgEnum('property_kind', [
  'APARTMENT',
  'HOUSE',
  'COMMERCIAL',
  'LAND',
  'VEHICLE',
  'MACHINERY',
  'FURNITURE',
  'IT_EQUIPMENT',
  'OTHER',
]);
export const propertyStatus = pgEnum('property_status', [
  'AVAILABLE',
  'RENTED',
  'MAINTENANCE',
  'SOLD',
]);
export const indexType = pgEnum('index_type', ['IPCA', 'IGPM']);
export const leaseStatus = pgEnum('lease_status', [
  'DRAFT',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'ENDED',
  'CANCELED',
]);
export const rentInvoiceStatus = pgEnum('rent_invoice_status', [
  'OPEN',
  'PAID',
  'OVERDUE',
  'CANCELED',
]);
export const ticketStatus = pgEnum('ticket_status', [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'RESOLVED',
  'CLOSED',
]);
export const ticketPriority = pgEnum('ticket_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const integrationKind = pgEnum('integration_kind', [
  'NFSE',
  'ELECTRONIC_SIGNATURE',
  'OPEN_FINANCE',
  'ERP',
  'GATEWAY',
  'REVENUE_SAAS',
]);
export const subscriptionStatus = pgEnum('subscription_status', [
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'TRIAL',
]);
export const notificationSeverity = pgEnum('notification_severity', ['INFO', 'WARNING', 'URGENT']);

/* ── Escrituração contábil (razão de partidas dobradas) ──────────────────── */

/** Grupo da conta no plano de contas (ITG 1000, Anexo 7). */
export const accountType = pgEnum('account_type', [
  'ATIVO',
  'PASSIVO',
  'PATRIMONIO_LIQUIDO',
  'RECEITA',
  'DESPESA',
]);

/**
 * Natureza do saldo da conta. Ativo e Despesa são devedoras; Passivo, PL e
 * Receita são credoras. É o que permite converter débito/crédito em saldo com
 * sinal, sem uma tabela de exceções espalhada pelo código.
 */
export const accountNature = pgEnum('account_nature', ['DEBIT', 'CREDIT']);

/** Lado da partida. Toda linha do razão é um dos dois, nunca um valor com sinal. */
export const ledgerDirection = pgEnum('ledger_direction', ['DEBIT', 'CREDIT']);

/**
 * DRAFT aceita partida desbalanceada (está sendo montada); POSTED exige
 * débito = crédito e é imutável; REVERSED foi estornado por outra partida.
 */
export const journalStatus = pgEnum('journal_status', ['DRAFT', 'POSTED', 'REVERSED']);

/** Documento de origem que deu causa à partida. */
export const journalSource = pgEnum('journal_source', [
  'FINANCIAL_ENTRY',
  'NFSE',
  'TAX_GUIDE',
  'PAYSLIP',
  'PROFIT_DISTRIBUTION',
  'BANK_TRANSACTION',
  'CLOSING',
  'OPENING',
  'MANUAL',
]);

/**
 * Fato contábil que a partida registra sobre o documento. O mesmo documento
 * gera partidas diferentes em momentos diferentes: a nota emitida reconhece
 * receita (ACCRUAL), o dinheiro entrando baixa o recebível (SETTLEMENT).
 * Junto com (source, sourceId) forma a chave de idempotência — é o que impede
 * um agente que repetiu a tentativa de lançar a mesma receita duas vezes.
 */
export const journalEvent = pgEnum('journal_event', [
  'ACCRUAL',
  'SETTLEMENT',
  'REVERSAL',
  'ADJUSTMENT',
]);

/* ── Trilha de agente ────────────────────────────────────────────────────── */

export const agentRunStatus = pgEnum('agent_run_status', [
  'RUNNING',
  'SUCCEEDED',
  /** Terminou, mas parte do trabalho falhou — não é sucesso nem fracasso. */
  'PARTIAL',
  'FAILED',
]);

/** O que disparou a execução. Importa na auditoria: cron não tem dono humano. */
export const agentTrigger = pgEnum('agent_trigger', ['CRON', 'USER', 'API', 'WEBHOOK']);

/**
 * Nível de autonomia da ação, decidido por VALOR e REVERSIBILIDADE — nunca
 * pela confiança do modelo. Classificar uma despesa de R$ 40 é reversível e
 * barato; emitir nota fiscal fala com a prefeitura e não volta atrás.
 */
export const agentAutonomy = pgEnum('agent_autonomy', [
  /** Aplica sozinho e registra. */
  'AUTO',
  /** Aplica sozinho, mas entra na fila de revisão posterior. */
  'REVIEW',
  /** Não aplica sem alguém aprovar. */
  'APPROVAL',
]);

export const agentActionStatus = pgEnum('agent_action_status', [
  'PROPOSED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'FAILED',
  /** Aplicada e depois desfeita — por estorno, no caso contábil. */
  'REVERTED',
]);
