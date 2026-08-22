'use server';

import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';
import { revalidatePath } from 'next/cache';

export async function saveAsaasToken(accessToken: string) {
  const ctx = await getTenantContext();

  try {
    await withTenant(ctx.companyId, async (tx) => {
      const [existing] = await tx
        .select({ id: integrationCredential.id })
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.companyId, ctx.companyId),
            eq(integrationCredential.provider, 'asaas')
          )
        );

      if (existing) {
        await tx
          .update(integrationCredential)
          .set({ secretRef: { access_token: accessToken }, active: true })
          .where(eq(integrationCredential.id, existing.id));
      } else {
        await tx.insert(integrationCredential).values({
          companyId: ctx.companyId,
          provider: 'asaas',
          kind: 'GATEWAY',
          secretRef: { access_token: accessToken },
          active: true,
        });
      }
    });
  } catch (error) {
    throw new Error('Falha ao salvar a integração');
  }

  revalidatePath('/configuracoes/integracoes/asaas');
  return { success: true };
}
