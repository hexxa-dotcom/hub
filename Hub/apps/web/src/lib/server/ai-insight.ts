import { createHash } from 'node:crypto';
import { getDb, eq, and } from '@hexxa/db';
import { aiInsight, aiInsightConfig, aiInsightSection } from '@hexxa/db/schema';
import { decryptSecret } from './secret-crypto';

/**
 * Hexxa Insights — dica contextual por IA, com cache. Só chama o modelo
 * quando o `context` muda (dado relevante mudou de verdade) ou quando o
 * cache passa de 24h, pra não ficar "maçante" nem gerar custo à toa.
 *
 * Controlado pelo contador em /contador/configuracoes/ia-insights: switch
 * geral (liga/desliga a feature toda) + switch por seção (pageKey), provedor
 * (Anthropic ou Gemini) e a chave da API cifrada no banco.
 */

export type AiProvider = 'anthropic' | 'gemini';

const SYSTEM_PROMPT = `Você é um contador sênior brasileiro, especialista em Simples Nacional, NBC TG e gestão financeira de pequenas empresas de serviço e holdings patrimoniais.

Dado um resumo dos dados reais de uma tela do sistema, dê UMA dica curta (no máximo 3 frases, sem markdown, sem saudação, direto ao ponto) — só se houver algo genuinamente acionável ou relevante nesses dados. Se os dados estiverem todos ok e não houver nada de útil a dizer, responda exatamente: SEM_DICA

Regras:
- Nunca invente números — use só os que estiverem no contexto.
- Prefira alertar sobre risco (fiscal, prazo, conformidade) ou oportunidade concreta (economia de imposto, otimização) em vez de louvar o que já está bom.
- Tom direto, como um contador experiente comentando por cima do ombro — não robótico, não genérico.`;

function hashContext(pageKey: string, context: string) {
  return createHash('sha256').update(`${pageKey}::${context}`).digest('hex');
}

async function resolveCredentials(): Promise<{ apiKey: string; provider: AiProvider } | null> {
  const db = getDb();
  const [cfg] = await db.select().from(aiInsightConfig).limit(1);
  if (!cfg?.enabled) return null;
  const provider = (cfg.provider as AiProvider) || 'anthropic';
  const dbKey = decryptSecret(cfg.apiKeyEncrypted);
  const apiKey = dbKey || (provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY) || null;
  if (!apiKey) return null;
  return { apiKey, provider };
}

async function isSectionEnabled(pageKey: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select().from(aiInsightSection).where(eq(aiInsightSection.pageKey, pageKey));
  return row ? row.enabled : true; // sem registro = habilitado por padrão
}

async function callAnthropic(apiKey: string, context: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.content?.[0]?.text ?? '').trim();
}

async function callGemini(apiKey: string, context: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: context }] }],
        generationConfig: { maxOutputTokens: 200 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

export async function getContextualInsight(companyId: string, pageKey: string, context: string): Promise<string | null> {
  if (!context.trim()) return null;

  const [creds, sectionOn] = await Promise.all([resolveCredentials(), isSectionEnabled(pageKey)]);
  if (!creds || !sectionOn) return null;

  const contextHash = hashContext(pageKey, context);
  const db = getDb();

  const [cached] = await db
    .select()
    .from(aiInsight)
    .where(and(eq(aiInsight.companyId, companyId), eq(aiInsight.pageKey, pageKey)));

  const isFresh = cached && Date.now() - cached.createdAt.getTime() < 24 * 60 * 60 * 1000;
  if (cached && (cached.contextHash === contextHash || isFresh)) {
    return cached.content === 'SEM_DICA' ? null : cached.content;
  }

  let content: string;
  try {
    content = creds.provider === 'gemini' ? await callGemini(creds.apiKey, context) : await callAnthropic(creds.apiKey, context);
    if (!content) return null;
  } catch (err) {
    console.error('[ai-insight] erro ao gerar dica:', err);
    return cached && cached.content !== 'SEM_DICA' ? cached.content : null;
  }

  if (cached) {
    await db
      .update(aiInsight)
      .set({ content, contextHash, createdAt: new Date() })
      .where(eq(aiInsight.id, cached.id));
  } else {
    await db.insert(aiInsight).values({ companyId, pageKey, content, contextHash });
  }

  return content === 'SEM_DICA' ? null : content;
}
