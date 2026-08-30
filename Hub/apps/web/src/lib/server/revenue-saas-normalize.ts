import 'server-only';

export interface NormalizedRevenueEvent {
  /** ID único do evento/transação no SaaS — usado como guarda de idempotência. */
  externalId: string;
  amount: number;
  /** YYYY-MM-DD */
  occurredAt: string;
  description: string;
  /** ID do médico/prestador no SaaS, se a transação for atribuível a um. */
  providerId: string | null;
}

/**
 * ÚNICO ponto que sabe o formato do payload de um SaaS de faturamento
 * parceiro — ajuste esta função (só ela) quando tivermos a documentação/
 * payload real do provider específico. Hoje assume um formato genérico
 * razoável (aceita variações comuns de nome de campo) porque ainda não
 * temos a doc confirmada.
 */
export function normalizeRevenueSaasPayload(body: unknown): NormalizedRevenueEvent | null {
  const b = body as Record<string, any> | null;
  if (!b) return null;

  const externalId = b.id ?? b.transaction_id ?? b.event_id;
  const amount = Number(b.amount ?? b.value ?? b.valor);
  if (!externalId || !Number.isFinite(amount) || amount <= 0) return null;

  const occurredAtRaw = b.date ?? b.occurred_at ?? b.data;
  const occurredAt = typeof occurredAtRaw === 'string' ? occurredAtRaw.slice(0, 10) : new Date().toISOString().slice(0, 10);

  return {
    externalId: String(externalId),
    amount,
    occurredAt,
    description: b.description ?? b.descricao ?? 'Faturamento via integração',
    providerId: b.provider_id ?? b.doctor_id ?? b.professional_id ?? b.medico_id ?? null,
  };
}
