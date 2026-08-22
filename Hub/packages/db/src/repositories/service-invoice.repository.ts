import { and, desc, eq } from 'drizzle-orm';
import type { TenantContext } from '@hexxa/core';
import type {
  ServiceInvoiceRepository,
  NewServiceInvoice,
  ServiceInvoicePatch,
  ServiceInvoiceRecord,
} from '@hexxa/core/ports';
import { withTenant } from '../client';
import { serviceInvoice } from '../schema/service-ops';

const toDate = (month: string) => `${month}-01`; // YYYY-MM -> primeiro dia
const toMonth = (date: string) => date.slice(0, 7); // YYYY-MM-DD -> YYYY-MM

export class DrizzleServiceInvoiceRepository implements ServiceInvoiceRepository {
  async create(ctx: TenantContext, data: NewServiceInvoice): Promise<{ id: string }> {
    return withTenant(ctx.companyId, async (tx) => {
      const inserted = await tx
        .insert(serviceInvoice)
        .values({
          companyId: ctx.companyId,
          customerId: data.customerId,
          contractId: data.contractId,
          amount: String(data.amount),
          serviceDescription: data.serviceDescription,
          referenceMonth: toDate(data.referenceMonth),
          status: data.status,
        })
        .returning({ id: serviceInvoice.id });
      return { id: inserted[0]!.id };
    });
  }

  async updateStatus(ctx: TenantContext, id: string, patch: ServiceInvoicePatch): Promise<void> {
    const set: Partial<typeof serviceInvoice.$inferInsert> = {};
    if (patch.status) set.status = patch.status;
    if (patch.providerProtocol !== undefined) set.providerProtocol = patch.providerProtocol;
    if (patch.nfseNumber !== undefined) set.nfseNumber = patch.nfseNumber;
    if (patch.providerMode !== undefined) set.providerMode = patch.providerMode;

    await withTenant(ctx.companyId, async (tx) => {
      await tx
        .update(serviceInvoice)
        .set(set)
        .where(and(eq(serviceInvoice.id, id), eq(serviceInvoice.companyId, ctx.companyId)));
    });
  }

  async listRecent(ctx: TenantContext, limit = 10): Promise<ServiceInvoiceRecord[]> {
    return withTenant(ctx.companyId, async (tx) => {
      const rows = await tx
        .select()
        .from(serviceInvoice)
        .where(eq(serviceInvoice.companyId, ctx.companyId))
        .orderBy(desc(serviceInvoice.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        amount: Number(r.amount),
        serviceDescription: r.serviceDescription,
        referenceMonth: toMonth(r.referenceMonth),
        status: r.status,
        nfseNumber: r.nfseNumber,
        providerProtocol: r.providerProtocol,
        providerMode: r.providerMode,
      }));
    });
  }
}
