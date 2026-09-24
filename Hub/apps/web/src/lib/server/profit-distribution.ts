'use server';

import { revalidatePath } from 'next/cache';
import { escriturarNovos } from '@/lib/server/ledger';
import { getTenantContext } from './tenant';
import { withTenant, eq, and, sql, resultadoOficial } from '@hexxa/db';
import { profitDistribution, company, partner } from '@hexxa/db/schema';
import { ProfitDistributionService, type ProfitDistributionResult } from '@hexxa/core';

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
  /**
   * De onde veio o lucro. 'OFICIAL' = balancete do OneFlow, de um mês
   * liberado e enviado. 'INDISPONIVEL' = não há lucro oficial, e nenhum valor
   * é oferecido para distribuição.
   */
  fonte: 'OFICIAL' | 'INDISPONIVEL';
  /** Competência do balancete usado, 'AAAA-MM'. */
  mesOficial: string | null;
  /** Por que não há número — em palavras que o cliente entende. */
  motivoIndisponivel: string | null;
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

/**
 * Lucro disponível para distribuir — o da CONTABILIDADE OFICIAL, ou nenhum.
 *
 * ── O que esta função fazia ─────────────────────────────────────────────
 *
 * Somava receitas e despesas do módulo financeiro. Errava para cima, e sem
 * aviso: o DAS e a folha que vêm do OneFlow não passam pelo financeiro, então
 * não eram descontados; e o ano inteiro entrava, inclusive parcelas de meses
 * que ainda não aconteceram. Para empresas cuja receita está toda no OneFlow,
 * errava para zero. Um lucro superestimado vira distribuição acima do
 * permitido — dividendo que perde a isenção, ou que descapitaliza a empresa.
 *
 * ── O que faz agora ────────────────────────────────────────────────────
 *
 * Lê o resultado acumulado no exercício do balancete do OneFlow, do último
 * mês que o contador liberou e que chegou inteiro lá (`resultadoOficial`).
 * Não havendo, devolve zero disponível e DIZ POR QUÊ. Nunca troca por outra
 * conta: um lucro inventado é pior que nenhum.
 *
 * O acumulado considera só o exercício corrente. Reservas de anos anteriores
 * existem, mas contá-las exige o PL oficial conciliado com as distribuições
 * já feitas; até lá, o número pode sair menor que o real — nunca maior.
 */
export async function getAvailableProfitAction(): Promise<YearlyProfitSummary> {
  const ctx = await getTenantContext();
  const year = new Date().getFullYear();
  const isHolding = ctx.companyType === 'HOLDING';

  const [oficial, distRows, companyRow] = await withTenant(ctx.companyId, async (tx) => {
    return Promise.all([
      resultadoOficial(tx, ctx.companyId),
      tx
        .select({ amount: profitDistribution.amount, referenceYear: profitDistribution.referenceYear })
        .from(profitDistribution)
        .where(eq(profitDistribution.companyId, ctx.companyId)),
      tx.select({ frequency: company.profitDistributionFrequency }).from(company).where(eq(company.id, ctx.companyId)),
    ]);
  });

  const frequency = (companyRow[0]?.frequency as DistributionFrequency) ?? 'MENSAL';
  const distributedThisYear = distRows.filter((r) => r.referenceYear === year).reduce((s, r) => s + Number(r.amount), 0);

  const base = {
    year,
    distributedThisYear,
    frequency,
    nextSuggestedDate: nextSuggestedDate(frequency, new Date()),
    profitLabel: isHolding ? 'Lucro de Aluguéis' : 'Lucro de Serviços',
  };

  const motivo = !oficial
    ? `O lucro distribuível vem da contabilidade oficial e aparece depois que o primeiro mês de ${year} ` +
      'for fechado e liberado pelo seu contador. Até lá, nenhum valor é oferecido — distribuir sobre um ' +
      'lucro não conferido pode tirar a isenção do dividendo.'
    : oficial.contabilImplantado && oficial.motivo
      ? `O balancete oficial não passou na conferência da Hexx (${oficial.motivo}). Até o seu ` +
        'contador verificar, nenhum valor é oferecido para distribuição.'
    : !oficial.contabilImplantado || oficial.resultado === null
      ? 'A contabilidade desta empresa ainda não está implantada no sistema contábil. Sem lucro ' +
        'escriturado, não há base segura para distribuir — fale com o seu contador.'
      : Number(oficial.referenceMonth.slice(0, 4)) !== year
        ? `O último mês liberado é de ${oficial.referenceMonth.slice(0, 4)}. O lucro de ${year} aparece ` +
          'quando o primeiro mês deste ano for fechado e liberado.'
        : null;

  if (motivo || !oficial || oficial.resultado === null) {
    return {
      ...base,
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      availableToDistribute: 0,
      accumulatedProfit: 0,
      accumulatedLosses: 0,
      fonte: 'INDISPONIVEL',
      mesOficial: oficial?.referenceMonth.slice(0, 7) ?? null,
      motivoIndisponivel: motivo ?? 'Lucro oficial indisponível.',
    };
  }

  const netProfit = oficial.resultado;
  const disponivel = Math.max(0, Number((netProfit - distributedThisYear).toFixed(2)));

  return {
    ...base,
    revenue: oficial.receitas ?? 0,
    expenses: oficial.custosDespesas ?? 0,
    netProfit,
    availableToDistribute: disponivel,
    accumulatedProfit: disponivel,
    accumulatedLosses: Math.max(0, -netProfit),
    fonte: 'OFICIAL',
    mesOficial: oficial.referenceMonth.slice(0, 7),
    motivoIndisponivel: null,
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
      // BRUTO das distribuições do ano: o serviço já desconta o que cada
      // sócio recebeu. Passar o líquido descontaria a mesma distribuição
      // duas vezes e bloquearia saque legítimo. Sem lucro oficial, zero —
      // e o serviço bloqueia com a mensagem dele.
      accumulatedProfit: profit.fonte === 'OFICIAL' ? Math.max(0, profit.netProfit) : 0,
      accumulatedLosses: profit.accumulatedLosses,
      totalProfitDistributedThisYearToPartner,
      totalProfitDistributedThisYearGlobally,
    },
  });

  return result;
}

/** Grava a distribuição — reavaliando antes; ver o comentário no corpo. */
export async function confirmDistributionAction(input: {
  partnerId: string;
  amount: number;
  notes?: string;
}): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  if (!(input.amount > 0)) return { ok: false, message: 'Valor inválido.' };

  /**
   * Reavalia AQUI, no servidor, antes de gravar.
   *
   * O comentário acima dizia "chamar só depois de aprovar", mas nada
   * garantia: uma server action é um endpoint, e chamá-la direto com
   * qualquer valor gravava a distribuição e a escriturava. A regra que
   * protege a isenção do dividendo não pode depender da tela ter sido usada
   * na ordem certa.
   */
  const parecer = await evaluatePartnerDistributionAction(input.partnerId, input.amount);
  if ('error' in parecer) return { ok: false, message: parecer.error };
  if (!parecer.isApproved || input.amount > parecer.approvedAmount + 0.005) {
    const motivo = Object.values(parecer.locks).find((l) => !l.passed)?.message;
    return {
      ok: false,
      message: motivo ?? 'Distribuição acima do permitido pela contabilidade oficial.',
    };
  }

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
