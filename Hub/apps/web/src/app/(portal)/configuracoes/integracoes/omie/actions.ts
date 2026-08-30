'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { getDb } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function saveOmieKeys(appKey: string, appSecret: string) {
  try {
    const ctx = await getTenantContext();
    const db = getDb();

    const [existing] = await db
      .select({ id: integrationCredential.id })
      .from(integrationCredential)
      .where(
        and(
          eq(integrationCredential.companyId, ctx.companyId),
          eq(integrationCredential.provider, 'omie')
        )
      );

    const secretRef = { appKey, appSecret };

    if (existing) {
      await db
        .update(integrationCredential)
        .set({
          secretRef,
          active: true,
        })
        .where(eq(integrationCredential.id, existing.id));
    } else {
      await db.insert(integrationCredential).values({
        companyId: ctx.companyId,
        provider: 'omie',
        kind: 'ERP',
        secretRef,
        active: true,
      });
    }

    revalidatePath('/configuracoes/integracoes/omie');
    revalidatePath('/configuracoes/integracoes');
    
    return { success: true };
  } catch (err: any) {
    console.error('Error saving omie keys:', err);
    return { error: 'Ocorreu um erro ao salvar as credenciais da Omie.' };
  }
}

export async function disconnectOmie() {
  try {
    const ctx = await getTenantContext();
    const db = getDb();

    await db
      .update(integrationCredential)
      .set({
        active: false,
        secretRef: {},
      })
      .where(
        and(
          eq(integrationCredential.companyId, ctx.companyId),
          eq(integrationCredential.provider, 'omie')
        )
      );

    revalidatePath('/configuracoes/integracoes/omie');
    revalidatePath('/configuracoes/integracoes');
    
    return { success: true };
  } catch (err: any) {
    console.error('Error disconnecting omie:', err);
    return { error: 'Ocorreu um erro ao desconectar a Omie.' };
  }
}
