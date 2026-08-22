import { NextResponse } from 'next/server';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Client ID e Secret são obrigatórios.' }, { status: 400 });
    }

    await withTenant(ctx.companyId, async (tx) => {
      // Verifica se já existe config para o conta azul
      const [existing] = await tx
        .select({ id: integrationCredential.id, secretRef: integrationCredential.secretRef })
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.companyId, ctx.companyId),
            eq(integrationCredential.provider, 'contaazul')
          )
        );

      const newSecretRef = {
        ...((existing?.secretRef as any) || {}),
        client_id: clientId,
        client_secret: clientSecret,
      };

      if (existing) {
        await tx
          .update(integrationCredential)
          .set({ secretRef: newSecretRef })
          .where(eq(integrationCredential.id, existing.id));
      } else {
        await tx.insert(integrationCredential).values({
          companyId: ctx.companyId,
          kind: 'ERP',
          provider: 'contaazul',
          secretRef: newSecretRef,
          active: false, // Ativa apenas após o callback de auth
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro no setup da Conta Azul:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar credenciais.' }, { status: 500 });
  }
}
