import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import type { TenantContext } from '@hexxa/core';
import { withTenant, type DbHandle } from '../client';
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
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
};

export type NewInstallmentPlan = {
  description: string; // ex.: "Parcelamento Simples Nacional"
  installmentCount: number;
  installmentAmount: number;
  firstDueDate: string; // YYYY-MM-DD, demais parcelas somam +1 mês
  pixCode?: string | null;
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

      return rows.map(mapRow);
    });
  }
}

function mapRow(r: typeof taxGuide.$inferSelect): TaxGuideRecord {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: r.id,
    taxName: r.taxName,
    referenceMonth: r.referenceMonth,
    amount: Number(r.amount),
    dueDate: r.dueDate,
    status: r.status === 'OPEN' && r.dueDate < today ? 'OVERDUE' : r.status,
    pixCode: r.pixCode,
    fileUrl: r.fileUrl,
    installmentGroupId: r.installmentGroupId,
    installmentNumber: r.installmentNumber,
    installmentCount: r.installmentCount,
  };
}

/**
 * Cadastro de guias/parcelamentos pelo CONTADOR (admin), fora do escopo de
 * tenant — mesmo padrão de acesso cross-tenant já usado em
 * contador/clientes/[id]/fiscal/actions.ts (getDb() direto + companyId
 * explícito no where).
 */
export class AdminTaxGuideRepository {
  async listByCompany(db: DbHandle, companyId: string): Promise<TaxGuideRecord[]> {
    const rows = await db.select().from(taxGuide).where(eq(taxGuide.companyId, companyId)).orderBy(desc(taxGuide.dueDate));
    return rows.map(mapRow);
  }

  async create(db: DbHandle, companyId: string, data: NewTaxGuide): Promise<{ id: string }> {
    const status: TaxGuideStatusValue = new Date(data.dueDate) < new Date() ? 'OVERDUE' : 'OPEN';
    const inserted = await db
      .insert(taxGuide)
      .values({
        companyId,
        taxName: data.taxName,
        referenceMonth: data.referenceMonth,
        amount: String(data.amount),
        dueDate: data.dueDate,
        pixCode: data.pixCode ?? null,
        status,
      })
      .returning({ id: taxGuide.id });
    return { id: inserted[0]!.id };
  }

  /** Gera N linhas de tax_guide (uma por parcela), todas com o mesmo installmentGroupId. */
  async createInstallmentPlan(db: DbHandle, companyId: string, data: NewInstallmentPlan): Promise<{ groupId: string }> {
    const groupId = randomUUID();
    const [firstY, firstM, firstD] = data.firstDueDate.split('-').map(Number) as [number, number, number];
    const today = new Date().toISOString().slice(0, 10);

    const rows = Array.from({ length: data.installmentCount }, (_, i) => {
      const n = i + 1;
      const due = new Date(firstY!, firstM! - 1 + i, firstD!);
      const dueDate = due.toISOString().slice(0, 10);
      const referenceMonth = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-01`;
      const status: TaxGuideStatusValue = dueDate < today ? 'OVERDUE' : 'OPEN';
      return {
        companyId,
        taxName: `Parcelamento — ${data.description} (${n}/${data.installmentCount})`,
        referenceMonth,
        amount: String(data.installmentAmount),
        dueDate,
        pixCode: data.pixCode ?? null,
        status,
        installmentGroupId: groupId,
        installmentNumber: n,
        installmentCount: data.installmentCount,
      };
    });

    await db.insert(taxGuide).values(rows);
    return { groupId };
  }
}
