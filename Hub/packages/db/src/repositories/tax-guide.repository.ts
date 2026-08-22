import { desc, eq } from 'drizzle-orm';
import type { TenantContext } from '@hexxa/core';
import { withTenant } from '../client';
import { taxGuide } from '../schema/accounting';

export type TaxGuideStatusValue = 'OPEN' | 'PAID' | 'OVERDUE';

export type NewTaxGuide = {
  taxName: string;
  referenceMonth: string; // YYYY-MM-DD (usar o dia 1º do mês de competência)
  amount: number;
  dueDate: string; // YYYY-MM-DD
  pixCode?: string | null;
};

export type TaxGuideRecord = {
  id: string;
  taxName: string;
  referenceMonth: string;
  amount: number;
  dueDate: string;
  status: TaxGuideStatusValue;
  pixCode: string | null;
  fileUrl: string | null;
};

export class DrizzleTaxGuideRepository {
  async create(ctx: TenantContext, data: NewTaxGuide): Promise<{ id: string }> {
    return withTenant(ctx.companyId, async (tx) => {
      const status: TaxGuideStatusValue = new Date(data.dueDate) < new Date() ? 'OVERDUE' : 'OPEN';
      const inserted = await tx
        .insert(taxGuide)
        .values({
          companyId: ctx.companyId,
          taxName: data.taxName,
          referenceMonth: data.referenceMonth,
          amount: String(data.amount),
          dueDate: data.dueDate,
          pixCode: data.pixCode ?? null,
          status,
        })
        .returning({ id: taxGuide.id });
      return { id: inserted[0]!.id };
    });
  }

  async markPaid(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx.companyId, async (tx) => {
      await tx.update(taxGuide).set({ status: 'PAID' }).where(eq(taxGuide.id, id));
    });
  }

  async listAll(ctx: TenantContext): Promise<TaxGuideRecord[]> {
    return withTenant(ctx.companyId, async (tx) => {
      const rows = await tx
        .select()
        .from(taxGuide)
        .where(eq(taxGuide.companyId, ctx.companyId))
        .orderBy(desc(taxGuide.dueDate));

      const today = new Date().toISOString().slice(0, 10);
      return rows.map((r) => ({
        id: r.id,
        taxName: r.taxName,
        referenceMonth: r.referenceMonth,
        amount: Number(r.amount),
        dueDate: r.dueDate,
        status: r.status === 'OPEN' && r.dueDate < today ? 'OVERDUE' : r.status,
        pixCode: r.pixCode,
        fileUrl: r.fileUrl,
      }));
    });
  }
}
