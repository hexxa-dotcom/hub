'use server';

import { revalidatePath } from 'next/cache';
import { withTenant, eq, desc } from '@hexxa/db';
import { profitDistribution } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export type DistState = { ok: boolean; message: string };

export type DistributionRow = {
  id: string;
  partnerName: string;
  amount: number;
  distributedAt: string;
  notes: string | null;
};

/** Lista real das distribuições de lucro do tenant — usada por esta página e por Sócios. */
export async function listDistributionsAction(): Promise<DistributionRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(profitDistribution)
      .where(eq(profitDistribution.companyId, ctx.companyId))
      .orderBy(desc(profitDistribution.distributedAt));
  });
  return rows.map((r) => ({
    id: r.id,
    partnerName: r.partnerName,
    amount: Number(r.amount),
    distributedAt: r.distributedAt,
    notes: r.notes,
  }));
}

/** Lança uma distribuição de lucro — grava no banco (chega à contabilidade). */
export async function addDistribution(_prev: DistState, formData: FormData): Promise<DistState> {
  try {
    const partner = String(formData.get('partner') ?? '').trim();
    const amount = Number(String(formData.get('amount') ?? '').replace(/\./g, '').replace(',', '.'));
    const date = String(formData.get('date') ?? '');
    const notes = String(formData.get('notes') ?? '').trim() || null;

    if (!partner || !(amount > 0) || !date) {
      return { ok: false, message: 'Preencha sócio, valor e data.' };
    }

    const ctx = await getTenantContext();

    await withTenant(ctx.companyId, async (tx) => {
      return tx.insert(profitDistribution).values({
        companyId: ctx.companyId,
        partnerName: partner,
        amount: String(amount),
        distributedAt: date,
        referenceYear: Number(date.slice(0, 4)),
        notes,
      });
    });

    revalidatePath('/minha-contabilidade/distribuicao-lucros');
    return { ok: true, message: 'Distribuição lançada e enviada à contabilidade.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}
