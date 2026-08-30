'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { revalidatePath } from 'next/cache';
import { depreciacaoAnual } from './lib';
import { gerarLancamentosDoAluguel } from '@/lib/server/contract-financials';
import { makeContractSignatureService } from '@/lib/server/container';

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
  status: string;
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
        p.status,
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
    status: row.status,
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
  status: 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'ENDED' | 'CANCELED';
  hasPdf: boolean;
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
             l.index_type, l.adjustment_anchor, l.status, l.start_date, l.end_date, l.pdf_base64
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
    hasPdf: !!r.pdf_base64,
    startDate: r.start_date,
    endDate: r.end_date,
  }));
}

/** PDF do contrato de aluguel gerado pelo wizard (base64) — sob demanda. */
export async function getLeasePdfAction(leaseId: string): Promise<string | null> {
  const ctx = await getTenantContext();
  const [row] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`SELECT pdf_base64 FROM lease WHERE id = ${leaseId} AND company_id = ${ctx.companyId}`);
  });
  return (row as any)?.pdf_base64 ?? null;
}

export async function getRentPaymentsAction(leaseId: string): Promise<RentPaymentRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT id, description, amount, due_date, reference_month, status, paid_at, receipt_base64
      FROM financial_entry
      WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId} AND type = 'RECEIVABLE'
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
  const [current] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`SELECT property_id, status, signature_request_id FROM lease WHERE id = ${leaseId} AND company_id = ${ctx.companyId}`);
  });
  if (!current) return { ok: false, message: 'Contrato de aluguel não encontrado.' };

  const wasPending = (current as any).status === 'PENDING_SIGNATURE' || (current as any).status === 'DRAFT';
  const newStatus = wasPending ? 'CANCELED' : 'ENDED';

  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`UPDATE lease SET status = ${newStatus} WHERE id = ${leaseId} AND company_id = ${ctx.companyId}`);
    await tx.execute(sql`
      UPDATE financial_entry SET status = 'CANCELED'
      WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId} AND status = 'PENDING'
    `);
    await tx.execute(sql`UPDATE property SET status = 'AVAILABLE' WHERE id = ${(current as any).property_id}`);
  });

  const signatureRequestId = (current as any).signature_request_id as string | null;
  if (wasPending && signatureRequestId) {
    try {
      await makeContractSignatureService().cancel(ctx, signatureRequestId);
    } catch (err) {
      console.error('Erro ao cancelar pedido de assinatura do aluguel:', err);
    }
  }

  revalidatePath('/patrimonial');
  return {
    ok: true,
    message: wasPending
      ? 'Contrato de aluguel cancelado antes da assinatura.'
      : 'Contrato de aluguel encerrado. Lançamentos futuros pendentes foram cancelados.',
  };
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
        AND status != 'CANCELED'
        AND EXTRACT(YEAR FROM reference_month) = ${anoAtual}
    `);
    const historicoRes = await tx.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'RECEIVABLE' THEN amount ELSE 0 END), 0) AS receita,
        COALESCE(SUM(CASE WHEN type = 'PAYABLE' THEN amount ELSE 0 END), 0) AS despesa
      FROM financial_entry
      WHERE company_id = ${ctx.companyId} AND status != 'CANCELED'
    `);
    const distribuidoRes = await tx.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total FROM profit_distribution WHERE company_id = ${ctx.companyId}
    `);
    // Depreciação do ano — despesa contábil (NBC TG 27) que não passa pelo
    // financial_entry (não é saída de caixa), mas reduz o lucro apurável pra
    // distribuição igual reduziria no balanço de verdade.
    const propsRes = await tx.execute(sql`
      SELECT acquisition_value, depreciation_rate, acquisition_date
      FROM property
      WHERE company_id = ${ctx.companyId} AND acquisition_value IS NOT NULL AND depreciation_rate IS NOT NULL
    `);

    const lucroExercicio = Number(anoRes[0]?.receita ?? 0) - Number(anoRes[0]?.despesa ?? 0);
    const lucroHistorico = Number(historicoRes[0]?.receita ?? 0) - Number(historicoRes[0]?.despesa ?? 0);
    const distribuido = Number(distribuidoRes[0]?.total ?? 0);

    const depreciacaoAnualTotal = propsRes.reduce((s: number, r: any) => {
      const acq = Number(r.acquisition_value);
      const rate = Number(r.depreciation_rate);
      const anos = r.acquisition_date ? anoAtual - new Date(r.acquisition_date).getFullYear() : 0;
      return s + depreciacaoAnual(acq, rate, anos);
    }, 0);

    const lucroExercicioLiquido = lucroExercicio - depreciacaoAnualTotal;

    return {
      lucroExercicio: Math.max(0, lucroExercicioLiquido),
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
