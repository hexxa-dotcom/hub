import type { TenantContext } from '@hexxa/core';
import type { FinancialEntryRepository, NewFinancialEntry } from '@hexxa/core/ports';
import { withTenant } from '../client';
import { financialEntry } from '../schema/finance';
import { eq, and } from 'drizzle-orm';

export class DrizzleFinancialEntryRepository implements FinancialEntryRepository {
  async create(ctx: TenantContext, data: NewFinancialEntry): Promise<{ id: string }> {
    return withTenant(ctx.companyId, async (tx) => {
      const inserted = await tx
        .insert(financialEntry)
        .values({
          companyId: ctx.companyId,
          type: data.type,
          status: data.status,
          description: data.description,
          amount: String(data.amount),
          dueDate: data.dueDate,
          referenceMonth: `${data.referenceMonth}-01`,
          source: data.source,
          sourceId: data.sourceId,
        })
        .returning({ id: financialEntry.id });
      return { id: inserted[0]!.id };
    });
  }

  async cancelBySource(ctx: TenantContext, source: string, sourceId: string): Promise<void> {
    return withTenant(ctx.companyId, async (tx) => {
      await tx
        .update(financialEntry)
        .set({ status: 'CANCELED' })
        .where(
          and(
            eq(financialEntry.companyId, ctx.companyId),
            eq(financialEntry.source, source),
            eq(financialEntry.sourceId, sourceId)
          )
        );
    });
  }
}
