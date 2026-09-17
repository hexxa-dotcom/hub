'use server';

import { revalidatePath } from 'next/cache';
import { escriturarNovos } from '@/lib/server/ledger';
import { getTenantContext } from './tenant';
import { withTenant, eq, and, sql } from '@hexxa/db';
import { profitDistribution, company, partner } from '@hexxa/db/schema';
import { ProfitDistributionService, type ProfitDistributionResult } from '@hexxa/core';
import { depreciacaoAnual } from '@/app/(portal)/patrimonial/lib';

/**
 * Motor real de distribuição de lucro — compartilhado entre Sócios (SERVICE:
 * lucro de serviços) e Patrimonial (HOLDING: lucro de aluguéis, com
 * depreciação de imóvel). A diferença entre os dois tipos de empresa fica
 * isolada aqui, em `getAvailableProfitAction()`; a validação legal
 * (`evaluatePartnerDistributionAction`) e o registro (`confirmDistributionAction`)
 * são únicos — Código Civil não distingue tipo de empresa.
 *
 * Substitui o antigo `minha-contabilidade/distribuicao-lucros/actions.ts`
 * (tela órfã, sem link de menu) e liga de verdade o `ProfitDistributionService`
 * (packages/core), que antes existia só no próprio teste, nunca era chamado.
 */

const service = new ProfitDistributionService();

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
  /** "Lucro de Serviços" (SERVICE) ou "Lucro de Aluguéis" (HOLDING) — pra rotular a tela certa. */
  profitLabel: string;
  /** Lucro histórico acumulado (todos os anos) ainda não distribuído — positivo. */
  accumulatedProfit: number;
  /** Prejuízo histórico acumulado ainda não coberto — positivo (0 se a empresa está no lucro). */
  accumulatedLosses: number;
};

function nextSuggestedDate(frequency: DistributionFrequency, today: Date): string {
  const year = today.getFullYear();
  const month = today.getMonth();
  let target: Date;
  if (frequency === 'MENSAL') target = new Date(year, month + 1, 0);
  else if (frequency === 'TRIMESTRAL') {
    const endMonth = Math.floor(month / 3) * 3 + 2;
    target = new Date(year, endMonth + 1, 0);
  } else if (frequency === 'SEMESTRAL') {
    const endMonth = month < 6 ? 5 : 11;
    target = new Date(year, endMonth + 1, 0);
  } else {
    target = new Date(year, 11, 31);
  }
  return target.toISOString().slice(0, 10);
}

/** Soma receita/despesa de financial_entry num intervalo (ou histórico completo, se sem filtro de ano). */
async function sumFinancialEntries(tx: any, companyId: string, year?: number) {
  const rows = await tx.execute(
    year
      ? sql`
          SELECT
            COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0) AS receita,
            COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0) AS despesa
          FROM financial_entry
          WHERE company_id = ${companyId} AND status != 'CANCELED' AND EXTRACT(YEAR FROM reference_month) = ${year}
        `
      : sql`
          SELECT
            COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0) AS receita,
            COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0) AS despesa
          FROM financial_entry
          WHERE company_id = ${companyId} AND status != 'CANCELED'
        `,
  );
  return { receita: Number(rows[0]?.receita ?? 0), despesa: Number(rows[0]?.despesa ?? 0) };
}

/** Depreciação anual total dos imóveis da empresa (só faz sentido pra HOLDING) — mesma fórmula de patrimonial/actions.ts. */
async function annualDepreciation(tx: any, companyId: string, refYear: number): Promise<number> {
  const rows = await tx.execute(sql`
    SELECT acquisition_value, depreciation_rate, acquisition_date
    FROM property
    WHERE company_id = ${companyId} AND acquisition_value IS NOT NULL AND depreciation_rate IS NOT NULL
  `);
  return rows.reduce((s: number, r: any) => {
    const acq = Number(r.acquisition_value);
    const rate = Number(r.depreciation_rate);
    const anos = r.acquisition_date ? refYear - new Date(r.acquisition_date).getFullYear() : 0;
    return s + depreciacaoAnual(acq, rate, anos);
  }, 0);
}

export async function getAvailableProfitAction(): Promise<YearlyProfitSummary> {
  const ctx = await getTenantContext();
  const year = new Date().getFullYear();
  const isHolding = ctx.companyType === 'HOLDING';

  const [yearTotals, allTimeTotals, distRows, companyRow] = await withTenant(ctx.companyId, async (tx) => {
    return Promise.all([
      sumFinancialEntries(tx, ctx.companyId, year),
      sumFinancialEntries(tx, ctx.companyId),
      tx
        .select({ amount: profitDistribution.amount, referenceYear: profitDistribution.referenceYear })
        .from(profitDistribution)
        .where(eq(profitDistribution.companyId, ctx.companyId)),
      tx.select({ frequency: company.profitDistributionFrequency }).from(company).where(eq(company.id, ctx.companyId)),
    ]);
  });

  const depreciationThisYear = isHolding ? await withTenant(ctx.companyId, (tx) => annualDepreciation(tx, ctx.companyId, year)) : 0;

  const revenue = yearTotals.receita;
  const expenses = yearTotals.despesa;
  const netProfit = revenue - expenses - depreciationThisYear;

  const distributedThisYear = distRows.filter((r) => r.referenceYear === year).reduce((s, r) => s + Number(r.amount), 0);
  const distributedAllTime = distRows.reduce((s, r) => s + Number(r.amount), 0);

  // Depreciação histórica: aproximação — aplica a mesma taxa anual a cada ano
  // já decorrido não é preciso ano a ano sem histórico de referenceMonth por
  // ano, então usamos a depreciação do ano corrente como proxy do "desconto
  // recorrente" também no acumulado. Simplificação honesta — documentada.
  const allTimeNet = allTimeTotals.receita - allTimeTotals.despesa - (isHolding ? depreciationThisYear : 0) - distributedAllTime;

  const frequency = (companyRow[0]?.frequency as DistributionFrequency) ?? 'MENSAL';

  return {
    year,
    revenue,
    expenses,
    netProfit,
    distributedThisYear,
    availableToDistribute: Math.max(0, netProfit - distributedThisYear),
    frequency,
    nextSuggestedDate: nextSuggestedDate(frequency, new Date()),
    profitLabel: isHolding ? 'Lucro de Aluguéis' : 'Lucro de Serviços',
    accumulatedProfit: Math.max(0, allTimeNet),
    accumulatedLosses: Math.max(0, -allTimeNet),
  };
}

export async function setDistributionFrequencyAction(frequency: DistributionFrequency): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.update(company).set({ profitDistributionFrequency: frequency }).where(eq(company.id, ctx.companyId));
  });
  revalidatePath('/minha-contabilidade/socios');
  revalidatePath('/patrimonial');
  return { ok: true };
}

export type DistributionRow = {
  id: string;
  partnerId: string | null;
  partnerName: string;
  amount: number;
  distributedAt: string;
  notes: string | null;
};

export async function listDistributionsAction(): Promise<DistributionRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(profitDistribution)
      .where(eq(profitDistribution.companyId, ctx.companyId))
      .orderBy(sql`${profitDistribution.distributedAt} desc`);
  });
  return rows.map((r) => ({
    id: r.id,
    partnerId: r.partnerId,
    partnerName: r.partnerName,
    amount: Number(r.amount),
    distributedAt: r.distributedAt,
    notes: r.notes,
  }));
}

/**
 * Avalia um pedido de distribuição contra as 6 travas legais reais
 * (ProfitDistributionService) — NÃO grava nada, só simula/valida.
 */
export async function evaluatePartnerDistributionAction(
  partnerId: string,
  requestedAmount: number,
): Promise<ProfitDistributionResult | { error: string }> {
  const ctx = await getTenantContext();
  if (!(requestedAmount > 0)) return { error: 'Informe um valor maior que zero.' };

  const year = new Date().getFullYear();

  const [companyRow, partnerRow, overdueRows, distRows] = await withTenant(ctx.companyId, async (tx) => {
    return Promise.all([
      tx
        .select({ unpaidShareCapital: company.unpaidShareCapital, allowsDisproportionateDistribution: company.allowsDisproportionateDistribution })
        .from(company)
        .where(eq(company.id, ctx.companyId)),
      tx.select().from(partner).where(and(eq(partner.id, partnerId), eq(partner.companyId, ctx.companyId))),
      // Guia vencida: status já gravado como OVERDUE, ou OPEN com due_date no passado (mesma lógica de tax-guide.repository.ts).
      tx.execute(sql`
        SELECT 1 FROM tax_guide
        WHERE company_id = ${ctx.companyId}
          AND (status = 'OVERDUE' OR (status = 'OPEN' AND due_date < CURRENT_DATE))
        LIMIT 1
      `),
      tx
        .select({ amount: profitDistribution.amount, partnerId: profitDistribution.partnerId, referenceYear: profitDistribution.referenceYear })
        .from(profitDistribution)
        .where(eq(profitDistribution.companyId, ctx.companyId)),
    ]);
  });

  const partnerRecord = partnerRow[0];
  if (!partnerRecord) return { error: 'Sócio não encontrado.' };

  const profit = await getAvailableProfitAction();

  const totalProfitDistributedThisYearToPartner = distRows
    .filter((r) => r.referenceYear === year && r.partnerId === partnerId)
    .reduce((s, r) => s + Number(r.amount), 0);
  const totalProfitDistributedThisYearGlobally = distRows
    .filter((r) => r.referenceYear === year)
    .reduce((s, r) => s + Number(r.amount), 0);

  const result = service.evaluateDistribution({
    companyId: ctx.companyId,
    partnerId,
    requestedAmount,
    companyContext: {
      hasOverdueTaxes: overdueRows.length > 0,
      unpaidShareCapital: Number(companyRow[0]?.unpaidShareCapital ?? 0),
      allowsDisproportionateDistribution: companyRow[0]?.allowsDisproportionateDistribution ?? false,
    },
    partnerContext: {
      sharePercentage: Number(partnerRecord.ownershipPct),
      activeMutualContractsBalance: Number(partnerRecord.mutualLoanBalance),
    },
    accountingContext: {
      accumulatedProfit: profit.accumulatedProfit,
      accumulatedLosses: profit.accumulatedLosses,
      totalProfitDistributedThisYearToPartner,
      totalProfitDistributedThisYearGlobally,
    },
  });

  return result;
}

/** Grava a distribuição já aprovada (chamar só depois de evaluatePartnerDistributionAction aprovar). */
export async function confirmDistributionAction(input: {
  partnerId: string;
  amount: number;
  notes?: string;
}): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  if (!(input.amount > 0)) return { ok: false, message: 'Valor inválido.' };

  const today = new Date().toISOString().slice(0, 10);

  const result = await withTenant(ctx.companyId, async (tx) => {
    const [partnerRow] = await tx.select().from(partner).where(and(eq(partner.id, input.partnerId), eq(partner.companyId, ctx.companyId)));
    if (!partnerRow) return { ok: false as const, message: 'Sócio não encontrado.' };

    await tx.insert(profitDistribution).values({
      companyId: ctx.companyId,
      partnerId: input.partnerId,
      partnerName: partnerRow.name,
      amount: String(input.amount),
      distributedAt: today,
      referenceYear: new Date().getFullYear(),
      notes: input.notes ?? null,
    });
    return { ok: true as const, message: 'Distribuição registrada.' };
  });

  if (result.ok) {
    // Reduz o PL contra a obrigação com o sócio, e baixa a obrigação contra o
    // banco. O insert não devolve o id, então a varredura direcionada resolve.
    await escriturarNovos(ctx.companyId, ctx.userId);
    revalidatePath('/minha-contabilidade/socios');
    revalidatePath('/patrimonial');
  }
  return result;
}
