import { NextResponse } from 'next/server';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { apiToken } = await request.json();

    if (!apiToken) {
      return NextResponse.json({ error: 'O Token de API é obrigatório.' }, { status: 400 });
    }

    await withTenant(ctx.companyId, async (tx) => {
      // Verifica se já existe config para o nibo
      const [existing] = await tx
        .select({ id: integrationCredential.id, secretRef: integrationCredential.secretRef })
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.companyId, ctx.companyId),
            eq(integrationCredential.provider, 'nibo')
          )
        );

      const newSecretRef = {
        ...((existing?.secretRef as any) || {}),
        api_token: apiToken,
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
          provider: 'nibo',
          secretRef: newSecretRef,
          active: true, // Nibo usa token direto, já fica ativo
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro no setup do Nibo:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar credenciais.' }, { status: 500 });
  }
}
