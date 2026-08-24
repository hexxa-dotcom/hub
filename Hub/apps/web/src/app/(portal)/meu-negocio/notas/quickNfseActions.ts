'use server';

import { withTenant, customer, serviceInvoice, eq, and, desc } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, estimateInvoiceTaxRate, listServiceProfiles } from '@/lib/server/fiscal';

export type QuickNfseCustomer = { id: string; name: string; document: string | null; email: string | null };
export type QuickNfseProfile = { id: string; nome: string; defaultDescription: string | null; aliquotaIss: number | null };

/** Dados pro painel de emissão rápida (aba lateral no dashboard): clientes + alíquota estimada atual. */
export async function getQuickNfseContext(): Promise<{
  customers: QuickNfseCustomer[];
  profiles: QuickNfseProfile[];
  taxRatePercent: number;
}> {
  const ctx = await getTenantContext();
  const [customers, cfg, profilesData] = await Promise.all([
    withTenant(ctx.companyId, (tx) =>
      tx
        .select({ id: customer.id, name: customer.name, document: customer.document, email: customer.email })
        .from(customer)
        .where(eq(customer.companyId, ctx.companyId))
    ),
    getNfseConfig(ctx),
    listServiceProfiles(ctx),
  ]);

  customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const taxRatePercent = cfg ? await estimateInvoiceTaxRate(ctx, cfg, profilesData[0]?.aliquotaIss) : 0;
  const profiles = profilesData.map((p: any) => ({
    id: p.id,
    nome: p.nome,
    defaultDescription: p.defaultDescription ?? null,
    aliquotaIss: p.aliquotaIss != null ? Number(p.aliquotaIss) : null,
  }));

  return { customers, profiles, taxRatePercent };
}

/**
 * Última nota ISSUED emitida pra este cliente — usada pra pré-preencher
 * descrição e valor no painel rápido (mesmo cliente, mesmo serviço = repetir).
 */
export async function getLastInvoiceForCustomer(
  customerId: string
): Promise<{ serviceDescription: string; amount: number } | null> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, (tx) =>
    tx
      .select({ serviceDescription: serviceInvoice.serviceDescription, amount: serviceInvoice.amount })
      .from(serviceInvoice)
      .where(
        and(
          eq(serviceInvoice.companyId, ctx.companyId),
          eq(serviceInvoice.customerId, customerId),
          eq(serviceInvoice.status, 'ISSUED')
        )
      )
      .orderBy(desc(serviceInvoice.createdAt))
      .limit(1)
  );

  const r = rows[0];
  return r ? { serviceDescription: r.serviceDescription, amount: Number(r.amount) } : null;
}
