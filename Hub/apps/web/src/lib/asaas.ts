/**
 * Cliente Asaas — wraps a API v3.
 * Usa sandbox quando o ambiente configurado !== 'production'.
 *
 * Credencial: config global (singleton) em `platform_asaas_config`,
 * editável pelo painel do contador (contador/integracoes) — cai pra env var
 * (ASAAS_API_KEY/ASAAS_ENV/ASAAS_WEBHOOK_TOKEN) se a linha não existir, pra
 * não quebrar quem já configurava só por variável de ambiente.
 */
import 'server-only';
import { normalizeDocument } from '@hexxa/core/document-br';
import { getDb, withDbTimeout } from '@hexxa/db';
import { platformAsaasConfig } from '@hexxa/db/schema';
import { decryptSecret } from './server/secret-crypto';

async function resolveConfig(): Promise<{ env: string; apiKey: string | null }> {
  const db = getDb();
  const [row] = await withDbTimeout(db.select().from(platformAsaasConfig).limit(1), 8000);
  const dbKey = decryptSecret(row?.apiKeyEncrypted);
  return {
    env: row?.env ?? process.env.ASAAS_ENV ?? 'sandbox',
    apiKey: dbKey || process.env.ASAAS_API_KEY || null,
  };
}

async function baseUrl(): Promise<string> {
  const { env } = await resolveConfig();
  return env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
}

async function apiKey(): Promise<string> {
  const { apiKey: k } = await resolveConfig();
  if (!k) throw new Error('Asaas não configurado — configure em Contador > Integrações ou defina ASAAS_API_KEY.');
  return k;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const [base, key] = await Promise.all([baseUrl(), apiKey()]);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'access_token': key,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new AsaasError(res.status, data);
  return data as T;
}

export class AsaasError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Asaas ${status}`);
  }
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type BillingType = 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
export type SubscriptionCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export type AsaasCustomer = {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: BillingType;
  value: number;
  nextDueDate: string;
  cycle: SubscriptionCycle;
  status: SubscriptionStatus;
  description: string;
  externalReference?: string;
  deleted: boolean;
};

export type AsaasPayment = {
  id: string;
  subscription: string;
  customer: string;
  value: number;
  netValue: number;
  status: string;
  dueDate: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  nossoNumero: string | null;
};

// ── Customers ─────────────────────────────────────────────────────────────────

export async function createCustomer(data: {
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return request('POST', '/customers', data);
}

export async function getCustomer(id: string): Promise<AsaasCustomer> {
  return request('GET', `/customers/${id}`);
}

export async function findCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const res = await request<{ data: AsaasCustomer[] }>('GET', `/customers?cpfCnpj=${normalizeDocument(cpfCnpj)}`);
  return res.data[0] ?? null;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function createSubscription(data: {
  customer: string;
  billingType: BillingType;
  value: number;
  nextDueDate: string;
  cycle?: SubscriptionCycle;
  description: string;
  externalReference?: string;
}): Promise<AsaasSubscription> {
  return request('POST', '/subscriptions', { cycle: 'MONTHLY', ...data });
}

export async function getSubscription(id: string): Promise<AsaasSubscription> {
  return request('GET', `/subscriptions/${id}`);
}

export async function updateSubscription(id: string, data: {
  value?: number;
  billingType?: BillingType;
  description?: string;
  nextDueDate?: string;
}): Promise<AsaasSubscription> {
  return request('PUT', `/subscriptions/${id}`, data);
}

export async function cancelSubscription(id: string): Promise<{ deleted: boolean }> {
  return request('DELETE', `/subscriptions/${id}`);
}

export async function listSubscriptionPayments(id: string): Promise<{ data: AsaasPayment[] }> {
  return request('GET', `/subscriptions/${id}/payments`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Próximo vencimento: dia 5 do mês seguinte */
export function nextDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 5);
  return d.toISOString().slice(0, 10);
}

export const PLANO_VALOR: Record<string, number> = {
  'Início': 149.90,
  'Crescimento': 299.90,
  'Escala': 499.90,
};
