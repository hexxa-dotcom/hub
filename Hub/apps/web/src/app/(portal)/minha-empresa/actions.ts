'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { definirFichaPublica } from '@/lib/server/ficha-publica';

/** Liga ou desliga o link público da ficha. A empresa vem sempre da sessão. */
export async function definirFichaPublicaAction(ativa: boolean) {
  const ctx = await getTenantContext();
  const r = await definirFichaPublica(ctx, ativa);
  revalidatePath('/minha-empresa');
  if (r.slug) revalidatePath(`/e/${r.slug}`);
  return r;
}
