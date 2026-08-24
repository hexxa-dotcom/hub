'use server';

import { revalidatePath } from 'next/cache';
import { withTenant, eq, and, desc, sql, getDb } from '@hexxa/db';
import { profitDistribution, company } from '@hexxa/db/schema';
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
    revalidatePath('/minha-contabilidade/socios');
    return { ok: true, message: 'Distribuição lançada e enviada à contabilidade.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}

export type DistributionFrequency = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

export type YearlyProfitSummary = {
  year: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  distributedThisYear: number;
  availableToDistribute: number;
  frequency: DistributionFrequency;
  nextSuggestedDate: string;
};

function nextSuggestedDate(frequency: DistributionFrequency, today: Date): string {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  let target: Date;
  if (frequency === 'MENSAL') {
    target = new Date(year, month + 1, 0); // último dia do mês atual
  } else if (frequency === 'TRIMESTRAL') {
    const endMonth = Math.floor(month / 3) * 3 + 2; // último mês do trimestre atual (0-idx)
    target = new Date(year, endMonth + 1, 0);
  } else if (frequency === 'SEMESTRAL') {
    const endMonth = month < 6 ? 5 : 11;
    target = new Date(year, endMonth + 1, 0);
  } else {
    target = new Date(year, 11, 31);
  }
  return target.toISOString().slice(0, 10);
}

/**
 * Lucro acumulado do ano (accrual, mesma convenção do dashboard: soma por
 * reference_month, não por status) menos o que já foi distribuído nesse
 * mesmo ano — é o quanto ainda dá pra distribuir aos sócios.
 */
export async function getYearlyProfitSummaryAction(): Promise<YearlyProfitSummary> {
  const ctx = await getTenantContext();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [totals, distRows, companyRow] = await Promise.all([
    withTenant(ctx.companyId, async (tx) => {
      return tx.execute(sql`
        SELECT type, coalesce(sum(amount), 0) AS total
        FROM financial_entry
        WHERE company_id = ${ctx.companyId}
          AND reference_month >= ${yearStart} AND reference_month <= ${yearEnd}
        GROUP BY type
      `);
    }),
    withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({ amount: profitDistribution.amount })
        .from(profitDistribution)
        .where(and(eq(profitDistribution.companyId, ctx.companyId), eq(profitDistribution.referenceYear, year)));
    }),
    getDb()
      .select({ frequency: company.profitDistributionFrequency })
      .from(company)
      .where(eq(company.id, ctx.companyId)),
  ]);

  const revenue = Number(totals.find((r: any) => r.type === 'RECEIVABLE')?.total ?? 0);
  const expenses = Number(totals.find((r: any) => r.type === 'PAYABLE')?.total ?? 0);
  const netProfit = revenue - expenses;

  const distributedThisYear = distRows.reduce((s, r) => s + Number(r.amount), 0);

  const frequency = (companyRow[0]?.frequency as DistributionFrequency) ?? 'MENSAL';
  const availableToDistribute = Math.max(0, netProfit - distributedThisYear);

  return {
    year,
    revenue,
    expenses,
    netProfit,
    distributedThisYear,
    availableToDistribute,
    frequency,
    nextSuggestedDate: nextSuggestedDate(frequency, new Date()),
  };
}

export async function setDistributionFrequencyAction(frequency: DistributionFrequency): Promise<DistState> {
  const ctx = await getTenantContext();
  await getDb().update(company).set({ profitDistributionFrequency: frequency }).where(eq(company.id, ctx.companyId));
  revalidatePath('/minha-contabilidade/socios');
  return { ok: true, message: 'Periodicidade de distribuição atualizada.' };
}
