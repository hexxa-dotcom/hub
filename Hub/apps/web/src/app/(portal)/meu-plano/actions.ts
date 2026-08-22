'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq } from '@hexxa/db';
import { subscription, plan } from '@hexxa/db/schema';
import { listSubscriptionPayments, type AsaasPayment } from '@/lib/asaas';

export type PlanoAtual = {
  planoNome: string;
  mensalidade: number;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL';
  periodoInicio: string | null;
  periodoFim: string | null;
  asaasSubscriptionId: string | null;
} | null;

export async function getPlanoAtualAction(): Promise<PlanoAtual> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        planoNome: plan.name,
        mensalidade: plan.monthlyValue,
        status: subscription.status,
        periodoInicio: subscription.currentPeriodStart,
        periodoFim: subscription.currentPeriodEnd,
        asaasSubscriptionId: subscription.asaasSubscriptionId,
      })
      .from(subscription)
      .innerJoin(plan, eq(subscription.planId, plan.id))
      .where(eq(subscription.companyId, ctx.companyId));
  });
  const row = rows[0];
  if (!row) return null;
  return {
    planoNome: row.planoNome,
    mensalidade: Number(row.mensalidade),
    status: row.status,
    periodoInicio: row.periodoInicio,
    periodoFim: row.periodoFim,
    asaasSubscriptionId: row.asaasSubscriptionId,
  };
}

/** Histórico real de cobranças via Asaas — não é fabricado localmente. */
export async function getHistoricoCobrancasAction(asaasSubscriptionId: string | null): Promise<AsaasPayment[]> {
  if (!asaasSubscriptionId) return [];
  try {
    const { data } = await listSubscriptionPayments(asaasSubscriptionId);
    return data;
  } catch {
    return [];
  }
}
