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
  }));
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
