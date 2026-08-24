'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { revalidatePath } from 'next/cache';

const KIND_LABEL_TO_DB: Record<string, string> = {
  'Imóvel': 'COMMERCIAL',
  'Veículo': 'VEHICLE',
  'Máquina ou Equipamento': 'MACHINERY',
  'Móveis e Utensílios': 'FURNITURE',
  'Equipamento de Informática': 'IT_EQUIPMENT',
  'Outro': 'OTHER',
};

const KIND_DB_TO_LABEL: Record<string, string> = {
  APARTMENT: 'Imóvel',
  HOUSE: 'Imóvel',
  COMMERCIAL: 'Imóvel',
  LAND: 'Imóvel',
  VEHICLE: 'Veículo',
  MACHINERY: 'Máquina ou Equipamento',
  FURNITURE: 'Móveis e Utensílios',
  IT_EQUIPMENT: 'Equipamento de Informática',
  OTHER: 'Outro',
};

export type PropertyRow = {
  id: string;
  name: string;
  kind: string;
  acq: number;
  year: number;
  rent: number;
  rate: number;
  ownerType: 'PJ' | 'PF';
  partnerId: string | null;
  partnerName: string | null;
  leaseId: string | null;
};

export async function getProperties(): Promise<PropertyRow[]> {
  const ctx = await getTenantContext();
  const data = await withTenant(ctx.companyId, async (tx) => {
    return await tx.execute(sql`
      SELECT
        p.id, p.label as name, p.kind, p.acquisition_value as acq,
        p.acquisition_date,
        p.depreciation_rate,
        p.owner_type,
        p.partner_id,
        pt.name as partner_name,
        l.id as lease_id,
        COALESCE(l.monthly_rent, 0) as rent
      FROM property p
      LEFT JOIN lease l ON l.property_id = p.id AND l.status = 'ACTIVE'
      LEFT JOIN partner pt ON pt.id = p.partner_id
      WHERE p.company_id = ${ctx.companyId}
      ORDER BY p.created_at DESC
    `);
  });

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    kind: KIND_DB_TO_LABEL[row.kind as string] ?? 'Outro',
    acq: Number(row.acq || 0),
    year: row.acquisition_date ? new Date(row.acquisition_date).getFullYear() : new Date().getFullYear(),
    rent: Number(row.rent || 0),
    rate: Number(row.depreciation_rate || 10),
    ownerType: (row.owner_type as 'PJ' | 'PF') ?? 'PJ',
    partnerId: row.partner_id ?? null,
    partnerName: row.partner_name ?? null,
    leaseId: row.lease_id ?? null,
  }));
}

// ── Contratos de Aluguel (lease) ────────────────────────────────────────────

export type LeaseRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  lesseeName: string;
  monthlyRent: number;
  indexType: 'IPCA' | 'IGPM';
  adjustmentAnchor: string;
  status: 'ACTIVE' | 'ENDED' | 'CANCELED';
  startDate: string | null;
  endDate: string | null;
};

export type RentPaymentRow = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  referenceMonth: string;
  status: string;
  paidAt: string | null;
  hasReceipt: boolean;
};

export async function listLeasesAction(): Promise<LeaseRow[]> {
  const ctx = await getTenantContext();
  const data = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT l.id, l.property_id, p.label as property_name, l.lessee_name, l.monthly_rent,
             l.index_type, l.adjustment_anchor, l.status, l.start_date, l.end_date
      FROM lease l
      JOIN property p ON p.id = l.property_id
      WHERE l.company_id = ${ctx.companyId}
      ORDER BY l.status = 'ACTIVE' DESC, l.start_date DESC NULLS LAST
    `);
  });
  return data.map((r: any) => ({
    id: r.id,
    propertyId: r.property_id,
    propertyName: r.property_name,
    lesseeName: r.lessee_name,
    monthlyRent: Number(r.monthly_rent),
    indexType: r.index_type,
    adjustmentAnchor: r.adjustment_anchor,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
  }));
}

export async function getRentPaymentsAction(leaseId: string): Promise<RentPaymentRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT id, description, amount, due_date, reference_month, status, paid_at, receipt_base64
      FROM financial_entry
      WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId}
      ORDER BY due_date DESC
    `);
  });
  return rows.map((r: any) => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    dueDate: r.due_date,
    referenceMonth: r.reference_month,
    status: r.status,
    paidAt: r.paid_at,
    hasReceipt: !!r.receipt_base64,
  }));
}

/** Gera até 24 meses de lançamentos (financial_entry, RECEIVABLE) a partir da vigência do contrato. */
async function gerarLancamentosDoAluguel(params: {
  companyId: string;
  leaseId: string;
  descricao: string;
  valor: number;
  startDate: string;
  endDate: string | null;
}) {
  const { companyId, leaseId, descricao, valor, startDate, endDate } = params;
  const start = new Date(startDate + 'T12:00:00');
  const end = endDate ? new Date(endDate + 'T12:00:00') : new Date(start.getFullYear() + 2, start.getMonth(), start.getDate());
  const months = Math.max(
    1,
    Math.min(24, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1),
  );

  await withTenant(companyId, async (tx) => {
    for (let i = 0; i < months; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      const dueDateStr = due.toISOString().split('T')[0]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';
      await tx.execute(sql`
        INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source, source_id)
        VALUES (${companyId}, 'RECEIVABLE', ${months > 1 ? `${descricao} (${i + 1}/${months})` : descricao}, ${valor}, ${dueDateStr}, ${refMonth}, 'PENDING', 'RENT', ${leaseId})
      `);
    }
  });
}

export async function createLeaseAction(input: {
  propertyId: string;
  lesseeName: string;
  monthlyRent: number;
  indexType: 'IPCA' | 'IGPM';
  startDate: string;
  endDate?: string;
}): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  if (!input.lesseeName.trim()) return { ok: false, message: 'Informe o nome do locatário.' };
  if (!input.monthlyRent || input.monthlyRent <= 0) return { ok: false, message: 'Informe um valor de aluguel válido.' };
  if (!input.startDate) return { ok: false, message: 'Informe a data de início.' };

  const [lease] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      INSERT INTO lease (company_id, property_id, lessee_name, monthly_rent, index_type, adjustment_anchor, status, start_date, end_date)
      VALUES (${ctx.companyId}, ${input.propertyId}, ${input.lesseeName}, ${input.monthlyRent}, ${input.indexType}::index_type, ${input.startDate}, 'ACTIVE', ${input.startDate}, ${input.endDate || null})
      RETURNING id
    `);
  });
  if (!lease) return { ok: false, message: 'Erro ao salvar o contrato.' };

  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`UPDATE property SET status = 'RENTED' WHERE id = ${input.propertyId}`);
  });

  await gerarLancamentosDoAluguel({
    companyId: ctx.companyId,
    leaseId: (lease as any).id,
    descricao: `[Aluguel] ${input.lesseeName}`,
    valor: input.monthlyRent,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
  });

  revalidatePath('/patrimonial');
  return { ok: true, message: 'Contrato de aluguel registrado e lançamentos financeiros gerados.' };
}

export async function reajustarLeaseAction(leaseId: string, percentual: number): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const [current] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`SELECT * FROM lease WHERE id = ${leaseId} AND company_id = ${ctx.companyId}`);
  });
  if (!current) return { ok: false, message: 'Contrato não encontrado.' };

  const novoValor = Number((current as any).monthly_rent) * (1 + percentual / 100);
  const hoje = new Date().toISOString().split('T')[0]!;

  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      UPDATE lease SET monthly_rent = ${novoValor}, adjustment_anchor = ${hoje} WHERE id = ${leaseId}
    `);
    // cancela lançamentos futuros ainda pendentes com o valor antigo
    await tx.execute(sql`
      UPDATE financial_entry SET status = 'CANCELED'
      WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId}
        AND status = 'PENDING' AND due_date >= ${hoje}
    `);
  });

  await gerarLancamentosDoAluguel({
    companyId: ctx.companyId,
    leaseId,
    descricao: `[Aluguel reajustado] ${(current as any).lessee_name}`,
    valor: novoValor,
    startDate: hoje,
    endDate: (current as any).end_date,
  });

  revalidatePath('/patrimonial');
  return { ok: true, message: `Reajuste aplicado — novo valor ${novoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês.` };
}

export async function encerrarLeaseAction(leaseId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    const [current] = await tx.execute(sql`SELECT property_id FROM lease WHERE id = ${leaseId} AND company_id = ${ctx.companyId}`);
    await tx.execute(sql`UPDATE lease SET status = 'ENDED' WHERE id = ${leaseId} AND company_id = ${ctx.companyId}`);
    await tx.execute(sql`
      UPDATE financial_entry SET status = 'CANCELED'
      WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId} AND status = 'PENDING'
    `);
    if (current) {
      await tx.execute(sql`UPDATE property SET status = 'AVAILABLE' WHERE id = ${(current as any).property_id}`);
    }
  });
  revalidatePath('/patrimonial');
  return { ok: true, message: 'Contrato de aluguel encerrado. Lançamentos futuros pendentes foram cancelados.' };
}

export async function marcarAluguelPagoAction(entryId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const hoje = new Date().toISOString().split('T')[0]!;
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      UPDATE financial_entry SET status = 'PAID', paid_at = ${hoje}
      WHERE id = ${entryId} AND company_id = ${ctx.companyId} AND source = 'RENT'
    `);
  });
  revalidatePath('/patrimonial');
  revalidatePath('/meu-negocio/hub-financeiro');
  return { ok: true, message: 'Aluguel marcado como recebido.' };
}

export async function createProperty(data: {
  name: string;
  kind: 'Imóvel' | 'Veículo' | 'Máquina ou Equipamento' | 'Móveis e Utensílios' | 'Equipamento de Informática' | 'Outro';
  acq: number;
  rate: number;
  year: number;
  ownerType: 'PJ' | 'PF';
  partnerId?: string | null;
}) {
  const ctx = await getTenantContext();
  const kindStr = KIND_LABEL_TO_DB[data.kind] ?? 'OTHER';
  const acqDate = `${data.year}-01-01`;
  const partnerId = data.ownerType === 'PF' ? data.partnerId || null : null;

  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      INSERT INTO property (company_id, label, kind, acquisition_value, status, acquisition_date, depreciation_rate, owner_type, partner_id)
      VALUES (${ctx.companyId}, ${data.name}, ${kindStr}::property_kind, ${data.acq}, 'AVAILABLE', ${acqDate}, ${data.rate}, ${data.ownerType}, ${partnerId})
    `);
  });
  revalidatePath('/patrimonial');
}

/** Lucro do ano corrente e lucro histórico acumulado não distribuído (base real p/ o simulador de dividendos). */
export async function getResumoFinanceiroAction(): Promise<{ lucroExercicio: number; lucroAcumuladoNaoDistribuido: number }> {
  const ctx = await getTenantContext();
  const anoAtual = new Date().getFullYear();

  return withTenant(ctx.companyId, async (tx) => {
    const anoRes = await tx.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0) AS receita,
        COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0) AS despesa
      FROM financial_entry
      WHERE company_id = ${ctx.companyId}
        AND EXTRACT(YEAR FROM reference_month) = ${anoAtual}
    `);
    const historicoRes = await tx.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0) AS receita,
        COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0) AS despesa
      FROM financial_entry
      WHERE company_id = ${ctx.companyId}
    `);
    const distribuidoRes = await tx.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total FROM profit_distribution WHERE company_id = ${ctx.companyId}
    `);

    const lucroExercicio = Number(anoRes[0]?.receita ?? 0) - Number(anoRes[0]?.despesa ?? 0);
    const lucroHistorico = Number(historicoRes[0]?.receita ?? 0) - Number(historicoRes[0]?.despesa ?? 0);
    const distribuido = Number(distribuidoRes[0]?.total ?? 0);

    return {
      lucroExercicio: Math.max(0, lucroExercicio),
      lucroAcumuladoNaoDistribuido: Math.max(0, lucroHistorico - distribuido - lucroExercicio),
    };
  });
}

export async function deleteProperty(id: string) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`DELETE FROM property WHERE id = ${id} AND company_id = ${ctx.companyId}`);
  });
  revalidatePath('/patrimonial');
}
