'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';

/** Descarta uma tentativa de emissão que deu erro (nunca virou nota). */
export async function descartarTentativaAction(id: string) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`DELETE FROM financial_entry WHERE company_id = ${ctx.companyId} AND source = 'NFSE' AND source_id = ${id}::uuid`);
    await tx.execute(sql`DELETE FROM service_invoice WHERE id = ${id}::uuid AND company_id = ${ctx.companyId} AND status = 'ERROR'`);
  });
  revalidatePath('/meu-negocio/notas');
  return { ok: true };
}
