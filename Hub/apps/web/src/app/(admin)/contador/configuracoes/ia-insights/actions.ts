'use server';

import { revalidatePath } from 'next/cache';
import { getDb, eq, withDbTimeout } from '@hexxa/db';
import { aiInsightConfig, aiInsightSection } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { encryptSecret } from '@/lib/server/secret-crypto';
import { AI_INSIGHT_PAGES } from '@/lib/ai-insight-pages';

export type AiInsightSettings = {
  enabled: boolean;
  hasApiKey: boolean;
  provider: 'anthropic' | 'gemini';
  sections: { key: string; label: string; enabled: boolean }[];
};

export async function getAiInsightSettingsAction(): Promise<AiInsightSettings> {
  await requireAdmin();
  const db = getDb();
  const [[cfg], sectionRows] = await withDbTimeout(
    Promise.all([db.select().from(aiInsightConfig).limit(1), db.select().from(aiInsightSection)]),
    8000,
  );
  const byKey = new Map(sectionRows.map((r) => [r.pageKey, r.enabled]));

  return {
    enabled: cfg?.enabled ?? false,
    hasApiKey: !!cfg?.apiKeyEncrypted,
    provider: (cfg?.provider as 'anthropic' | 'gemini') ?? 'anthropic',
    sections: AI_INSIGHT_PAGES.map((p) => ({ key: p.key, label: p.label, enabled: byKey.get(p.key) ?? true })),
  };
}

export async function setAiInsightEnabledAction(enabled: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  const db = getDb();
  const [cfg] = await withDbTimeout(db.select().from(aiInsightConfig).limit(1), 8000);
  if (cfg) {
    await withDbTimeout(db.update(aiInsightConfig).set({ enabled, updatedAt: new Date() }).where(eq(aiInsightConfig.id, cfg.id)), 8000);
  } else {
    await withDbTimeout(db.insert(aiInsightConfig).values({ enabled }), 8000);
  }
  revalidatePath('/contador/configuracoes/ia-insights');
  return { ok: true };
}

export async function saveAiInsightApiKeyAction(rawKey: string, provider: 'anthropic' | 'gemini'): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const key = rawKey.trim();
  if (!key) return { ok: false, message: 'Cole uma chave válida.' };
  if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
    return { ok: false, message: 'Isso não parece uma chave da Anthropic (deve começar com "sk-ant-").' };
  }
  if (provider === 'gemini' && key.length < 20) {
    return { ok: false, message: 'Isso não parece uma chave do Gemini válida.' };
  }

  const db = getDb();
  const encrypted = encryptSecret(key);
  const [cfg] = await withDbTimeout(db.select().from(aiInsightConfig).limit(1), 8000);
  if (cfg) {
    await withDbTimeout(db.update(aiInsightConfig).set({ apiKeyEncrypted: encrypted, provider, updatedAt: new Date() }).where(eq(aiInsightConfig.id, cfg.id)), 8000);
  } else {
    await withDbTimeout(db.insert(aiInsightConfig).values({ apiKeyEncrypted: encrypted, provider, enabled: false }), 8000);
  }
  revalidatePath('/contador/configuracoes/ia-insights');
  return { ok: true, message: `Chave do ${provider === 'gemini' ? 'Gemini' : 'Anthropic'} salva com segurança (cifrada no banco).` };
}

export async function removeAiInsightApiKeyAction(): Promise<{ ok: boolean }> {
  await requireAdmin();
  const db = getDb();
  const [cfg] = await withDbTimeout(db.select().from(aiInsightConfig).limit(1), 8000);
  if (cfg) {
    await withDbTimeout(db.update(aiInsightConfig).set({ apiKeyEncrypted: null, enabled: false, updatedAt: new Date() }).where(eq(aiInsightConfig.id, cfg.id)), 8000);
  }
  revalidatePath('/contador/configuracoes/ia-insights');
  return { ok: true };
}

export async function setAiInsightSectionAction(pageKey: string, enabled: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  const db = getDb();
  const [row] = await withDbTimeout(db.select().from(aiInsightSection).where(eq(aiInsightSection.pageKey, pageKey)), 8000);
  if (row) {
    await withDbTimeout(db.update(aiInsightSection).set({ enabled, updatedAt: new Date() }).where(eq(aiInsightSection.pageKey, pageKey)), 8000);
  } else {
    await withDbTimeout(db.insert(aiInsightSection).values({ pageKey, enabled }), 8000);
  }
  revalidatePath('/contador/configuracoes/ia-insights');
  return { ok: true };
}
