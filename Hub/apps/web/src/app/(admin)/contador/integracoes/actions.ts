'use server';

import { revalidatePath } from 'next/cache';
import { getDb, eq, withDbTimeout } from '@hexxa/db';
import { platformAsaasConfig } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { encryptSecret } from '@/lib/server/secret-crypto';

export type AsaasPlatformStatus = {
  env: 'sandbox' | 'production';
  hasApiKey: boolean;
  hasWebhookToken: boolean;
};

export async function getAsaasPlatformStatusAction(): Promise<AsaasPlatformStatus> {
  await requireAdmin();
  const db = getDb();
  const [cfg] = await withDbTimeout(db.select().from(platformAsaasConfig).limit(1), 8000);
  return {
    env: (cfg?.env as 'sandbox' | 'production') ?? 'sandbox',
    hasApiKey: !!cfg?.apiKeyEncrypted,
    hasWebhookToken: !!cfg?.webhookTokenEncrypted,
  };
}

export async function saveAsaasPlatformConfigAction(input: {
  env: 'sandbox' | 'production';
  apiKey?: string;
  webhookToken?: string;
}): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const db = getDb();
  const [cfg] = await withDbTimeout(db.select().from(platformAsaasConfig).limit(1), 8000);

  const values: Partial<typeof platformAsaasConfig.$inferInsert> = {
    env: input.env,
    updatedAt: new Date(),
  };
  if (input.apiKey?.trim()) values.apiKeyEncrypted = encryptSecret(input.apiKey.trim());
  if (input.webhookToken?.trim()) values.webhookTokenEncrypted = encryptSecret(input.webhookToken.trim());

  if (cfg) {
    await withDbTimeout(db.update(platformAsaasConfig).set(values).where(eq(platformAsaasConfig.id, cfg.id)), 8000);
  } else {
    await withDbTimeout(db.insert(platformAsaasConfig).values(values), 8000);
  }

  revalidatePath('/contador/integracoes');
  return { ok: true, message: 'Configuração salva com segurança (cifrada no banco).' };
}
