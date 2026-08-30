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
  /** Imposto estimado desta nota (R$), pra exibir pro cliente na emissão/lista. */
  taxAmount?: number;
  /** Alíquota efetiva usada no cálculo acima (%). */
  taxRate?: number;
}

export interface ServiceInvoicePatch {
  status?: InvoiceStatus;
  providerProtocol?: string;
  nfseNumber?: string;
  /** 'gov' = emissão real; 'mock' = modo de teste (ver NfseIssueResult.isMock). */
  providerMode?: 'gov' | 'mock';
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
  providerMode: string | null;
  taxAmount: number | null;
  taxRate: number | null;
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
  cancelBySource(ctx: TenantContext, source: string, sourceId: string): Promise<void>;
}

export interface NewSignatureRequest {
  title: string;
  signerName: string;
  signerEmail: string;
  subjectType: 'CONTRACT' | 'LEASE' | 'DOCUMENT';
  subjectId: string;
}

export interface SignatureRequestPatch {
  status?: 'PENDING' | 'SENT' | 'SIGNED' | 'REFUSED' | 'EXPIRED';
  providerEnvelopeId?: string;
}

export interface SignatureRequestRecord {
  id: string;
  title: string | null;
  signerName: string | null;
  signerEmail: string | null;
  status: string;
  providerEnvelopeId: string | null;
  createdAt: string;
}

export interface SignatureRequestRepository {
  create(ctx: TenantContext, data: NewSignatureRequest): Promise<{ id: string }>;
  updateStatus(ctx: TenantContext, id: string, patch: SignatureRequestPatch): Promise<void>;
  listRecent(ctx: TenantContext, limit?: number): Promise<SignatureRequestRecord[]>;
  findById(ctx: TenantContext, id: string): Promise<SignatureRequestRecord | null>;
}
