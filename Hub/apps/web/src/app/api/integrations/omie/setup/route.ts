import { NextResponse } from 'next/server';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { appKey, appSecret } = await request.json();

    if (!appKey || !appSecret) {
      return NextResponse.json({ error: 'App Key e App Secret são obrigatórios.' }, { status: 400 });
    }

    await withTenant(ctx.companyId, async (tx) => {
      // Verifica se já existe config para o omie
      const [existing] = await tx
        .select({ id: integrationCredential.id, secretRef: integrationCredential.secretRef })
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.companyId, ctx.companyId),
            eq(integrationCredential.provider, 'omie')
          )
        );

      const newSecretRef = {
        ...((existing?.secretRef as any) || {}),
        app_key: appKey,
        app_secret: appSecret,
      };

      if (existing) {
        await tx
          .update(integrationCredential)
          .set({ secretRef: newSecretRef, active: true })
          .where(eq(integrationCredential.id, existing.id));
      } else {
        await tx.insert(integrationCredential).values({
          companyId: ctx.companyId,
          kind: 'ERP',
          provider: 'omie',
          secretRef: newSecretRef,
          active: true, // Omie não precisa de OAuth redirect, então já fica ativo
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro no setup do omie:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar credenciais.' }, { status: 500 });
  }
}
