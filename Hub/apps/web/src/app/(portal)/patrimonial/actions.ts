'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { revalidatePath } from 'next/cache';

export async function getProperties() {
  const ctx = await getTenantContext();
  const data = await withTenant(ctx.companyId, async (tx) => {
    return await tx.execute(sql`
      SELECT 
        p.id, p.label as name, p.kind, p.acquisition_value as acq, 
        EXTRACT(YEAR FROM p.created_at) as year, 
        p.acquisition_date,
        p.depreciation_rate,
        COALESCE(l.monthly_rent, 0) as rent
      FROM property p
      LEFT JOIN lease l ON l.property_id = p.id AND l.status = 'ACTIVE'
      WHERE p.company_id = ${ctx.companyId}
    `);
  });

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    kind: row.kind === 'REAL_ESTATE' ? 'Imóvel' : row.kind === 'VEHICLE' ? 'Veículo' : 'Outro',
    acq: Number(row.acq || 0),
    year: row.acquisition_date ? new Date(row.acquisition_date).getFullYear() : Number(row.year),
    rent: Number(row.rent || 0),
    rate: Number(row.depreciation_rate || (row.kind === 'REAL_ESTATE' ? 4 : row.kind === 'VEHICLE' ? 20 : 10))
  }));
}

export async function createProperty(data: { name: string; kind: 'Imóvel' | 'Veículo' | 'Outro'; acq: number; rate: number; year: number }) {
  const ctx = await getTenantContext();
  const kindStr = data.kind === 'Imóvel' ? 'REAL_ESTATE' : data.kind === 'Veículo' ? 'VEHICLE' : 'OTHER';
  const acqDate = `${data.year}-01-01`;

  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      INSERT INTO property (company_id, label, kind, acquisition_value, status, acquisition_date, depreciation_rate)
      VALUES (${ctx.companyId}, ${data.name}, ${kindStr}, ${data.acq}, 'AVAILABLE', ${acqDate}, ${data.rate})
    `);
  });
  revalidatePath('/patrimonial');
}
