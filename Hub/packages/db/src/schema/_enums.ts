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
