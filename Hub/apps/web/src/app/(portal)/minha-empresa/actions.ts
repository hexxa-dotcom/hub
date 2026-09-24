'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { definirFichaPublica } from '@/lib/server/ficha-publica';
import { withTenant, company, eq } from '@hexxa/db';

/** Liga ou desliga o link público da ficha. A empresa vem sempre da sessão. */
export async function definirFichaPublicaAction(ativa: boolean) {
  const ctx = await getTenantContext();
  const r = await definirFichaPublica(ctx, ativa);
  revalidatePath('/minha-empresa');
  if (r.slug) revalidatePath(`/e/${r.slug}`);
  return r;
}

/** A atividade nas palavras da empresa. Vazio volta a usar o texto do CNAE. */
export async function salvarDescricaoDaAtividadeAction(texto: string) {
  const ctx = await getTenantContext();
  const descricao = texto.trim().replace(/\s+/g, ' ').slice(0, 120) || null;
  await withTenant(ctx.companyId, (tx) => tx.update(company).set({ activityDescription: descricao }).where(eq(company.id, ctx.companyId)));
  revalidatePath('/minha-empresa');
  return { descricao };
}
