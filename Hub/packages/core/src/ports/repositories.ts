/**
 * Ports de repositório (persistência). O domínio depende destas interfaces;
 * a implementação concreta (Drizzle) vive em packages/db/src/repositories.
 * Inversão de Dependência: o service não conhece SQL.
 */
import type { TenantContext } from '../enums';

type InvoiceStatus = 'DRAFT' | 'ISSUING' | 'ISSUED' | 'CANCELED' | 'ERROR';

export interface EnsureCustomerInput {
  name: string;
  document: string;
  email?: string;
}

export interface CustomerRepository {
  /** Acha o cliente pelo documento (no tenant) ou cria um novo. */
  ensure(ctx: TenantContext, input: EnsureCustomerInput): Promise<{ id: string }>;
}

export interface NewServiceInvoice {
  customerId?: string;
  contractId?: string;
  amount: number;
  serviceDescription: string;
  /** mês de referência YYYY-MM (o MÊS, nunca "competência"). */
  referenceMonth: string;
  status: InvoiceStatus;
}

export interface ServiceInvoicePatch {
  status?: InvoiceStatus;
  providerProtocol?: string;
  nfseNumber?: string;
}

export interface ServiceInvoiceRecord {
  id: string;
  customerId: string | null;
  amount: number;
  serviceDescription: string;
  referenceMonth: string; // YYYY-MM
  status: string;
  nfseNumber: string | null;
  providerProtocol: string | null;
}

export interface ServiceInvoiceRepository {
  create(ctx: TenantContext, data: NewServiceInvoice): Promise<{ id: string }>;
  updateStatus(ctx: TenantContext, id: string, patch: ServiceInvoicePatch): Promise<void>;
  listRecent(ctx: TenantContext, limit?: number): Promise<ServiceInvoiceRecord[]>;
}

export interface NewFinancialEntry {
  type: 'PAYABLE' | 'RECEIVABLE';
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';
  description: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  referenceMonth: string; // YYYY-MM
  source: string; // NFSE | RENT | MANUAL | IMPORT
  sourceId: string;
}

export interface FinancialEntryRepository {
  create(ctx: TenantContext, data: NewFinancialEntry): Promise<{ id: string }>;
}
