'use server';

import { revalidatePath } from 'next/cache';
import { getDb, eq, sql, withDbTimeout } from '@hexxa/db';
import { platformAsaasConfig } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { encryptSecret } from '@/lib/server/secret-crypto';
import { esquecerChaveDoJev } from '@/lib/server/jev';

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

/** Jev (TypeSafe): de onde vem a chave em uso — da tela, do ambiente ou nenhuma. */
export async function getJevStatusAction(): Promise<{ origem: 'TELA' | 'AMBIENTE' | null }> {
  await requireAdmin();
  const [r] = (await getDb()
    .execute(sql`SELECT 1 AS ok FROM segredo_da_plataforma WHERE nome = 'TYPESAFE_API_KEY'`)
    .catch(() => [])) as unknown as { ok: number }[];
  return { origem: r ? 'TELA' : process.env.TYPESAFE_API_KEY ? 'AMBIENTE' : null };
}

/** Troca a chave do Jev. Confere na TypeSafe antes de salvar: chave errada não entra. */
export async function saveJevKeyAction(chave: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const k = chave.trim();
  if (!k) return { ok: false, message: 'Cole a chave.' };
  const teste = await fetch('https://api.typesafe.ai/v1/models', { headers: { Authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!teste?.ok) return { ok: false, message: 'A TypeSafe recusou esta chave — confira e cole de novo.' };
  await getDb().execute(sql`
    INSERT INTO segredo_da_plataforma (nome, valor_cifrado) VALUES ('TYPESAFE_API_KEY', ${encryptSecret(k)})
    ON CONFLICT (nome) DO UPDATE SET valor_cifrado = EXCLUDED.valor_cifrado, atualizado_em = now()
  `);
  esquecerChaveDoJev();
  revalidatePath('/contador/integracoes');
  return { ok: true, message: 'Chave conferida e salva (cifrada no banco).' };
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
