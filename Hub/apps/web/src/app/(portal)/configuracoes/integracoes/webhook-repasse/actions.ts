'use server';

import { randomBytes } from 'node:crypto';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';
import { encryptSecret } from '@/lib/server/secret-crypto';
import { revalidatePath } from 'next/cache';

const PROVIDER = 'webhook-repasse';

/**
 * Gera (ou rotaciona) o segredo do webhook de faturamento — diferente de
 * Asaas/Omie, aqui o Hub CRIA a credencial (não recebe uma colada de fora),
 * então o valor puro só existe uma vez, no retorno desta função, e fica
 * guardado criptografado (mesmo utilitário já usado pra senha do
 * certificado A1 / IMAP).
 */
export async function gerarWebhookSecretAction(): Promise<{ secret: string; webhookUrl: string }> {
  const ctx = await getTenantContext();
  const secret = randomBytes(32).toString('hex');

  await withTenant(ctx.companyId, async (tx) => {
    const [existing] = await tx
      .select({ id: integrationCredential.id })
      .from(integrationCredential)
      .where(and(eq(integrationCredential.companyId, ctx.companyId), eq(integrationCredential.provider, PROVIDER)));

    if (existing) {
      await tx
        .update(integrationCredential)
        .set({ secretRef: { webhook_secret_encrypted: encryptSecret(secret) }, active: true })
        .where(eq(integrationCredential.id, existing.id));
    } else {
      await tx.insert(integrationCredential).values({
        companyId: ctx.companyId,
        provider: PROVIDER,
        kind: 'REVENUE_SAAS',
        secretRef: { webhook_secret_encrypted: encryptSecret(secret) },
        active: true,
      });
    }
  });

  revalidatePath('/configuracoes/integracoes/webhook-repasse');
  return { secret, webhookUrl: `https://app.hexx.com.br/api/webhooks/revenue-saas/${ctx.companyId}` };
}

export async function desativarWebhookAction(): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(integrationCredential)
      .set({ active: false })
      .where(and(eq(integrationCredential.companyId, ctx.companyId), eq(integrationCredential.provider, PROVIDER)));
  });
  revalidatePath('/configuracoes/integracoes/webhook-repasse');
  return { ok: true };
}
