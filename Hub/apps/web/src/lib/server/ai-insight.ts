import { createHash } from 'node:crypto';
import { getDb, eq, and, withDbTimeout, agenteLigado } from '@hexxa/db';
import { aiInsight, aiInsightConfig, aiInsightSection } from '@hexxa/db/schema';
import { decryptSecret } from './secret-crypto';
import { callLlm, type LlmProvider } from '@hexxa/integrations';
import { resolverMotor } from './llm-config';

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

/**
 * Credenciais de IA da plataforma. Exportada porque o agente classificador usa
 * a MESMA configuração — provedor, chave e liga/desliga ficam num lugar só, e
 * desligar a IA em /contador/configuracoes/ia-insights desliga tudo, não só as
 * dicas de tela.
 */
export async function resolveCredentials(): Promise<{ apiKey: string; provider: AiProvider } | null> {
  const db = getDb();
  const [cfg] = await withDbTimeout(db.select().from(aiInsightConfig).limit(1), 8000);
  if (!cfg?.enabled) return null;
  const provider = (cfg.provider as AiProvider) || 'anthropic';
  const dbKey = decryptSecret(cfg.apiKeyEncrypted);
  const apiKey = dbKey || (provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY) || null;
  if (!apiKey) return null;
  return { apiKey, provider };
}

async function isSectionEnabled(pageKey: string): Promise<boolean> {
  const db = getDb();
  const [row] = await withDbTimeout(db.select().from(aiInsightSection).where(eq(aiInsightSection.pageKey, pageKey)), 8000);
  return row ? row.enabled : true; // sem registro = habilitado por padrão
}

export async function getContextualInsight(companyId: string, pageKey: string, context: string): Promise<string | null> {
  if (!context.trim()) return null;

  const [creds, sectionOn, ligado] = await Promise.all([
    resolveCredentials(),
    isSectionEnabled(pageKey),
    // A chave por empresa, da ficha do cliente. O switch por seção
    // (`isSectionEnabled`) é global e continua valendo — os dois precisam
    // estar ligados, e o mais restritivo ganha.
    agenteLigado(getDb(), companyId, 'insights').catch(() => true),
  ]);
  if (!creds || !sectionOn || !ligado) return null;

  const contextHash = hashContext(pageKey, context);
  const db = getDb();

  const [cached] = await withDbTimeout(
    db.select().from(aiInsight).where(and(eq(aiInsight.companyId, companyId), eq(aiInsight.pageKey, pageKey))),
    8000,
  );

  // Serve o cache só quando o contexto NÃO mudou E ainda não passou de 24h —
  // era "||" antes, o que servia dica desatualizada sempre que o cache
  // estava fresco, mesmo com o contextHash já divergente (dado real mudou).
  const isFresh = cached && Date.now() - cached.createdAt.getTime() < 24 * 60 * 60 * 1000;
  if (cached && cached.contextHash === contextHash && isFresh) {
    return cached.content === 'SEM_DICA' ? null : cached.content;
  }

  let content: string;
  try {
    // Uma porta só, qualquer motor. O nome do modelo vem da configuração —
    // nunca mais fixo no meio de uma função de rede.
    const motor = await resolverMotor(creds);
    const r = await callLlm(motor, { system: SYSTEM_PROMPT, user: context, maxTokens: 200 });
    content = r.text;
    if (!content) return null;
  } catch (err) {
    console.error('[ai-insight] erro ao gerar dica:', err);
    return cached && cached.content !== 'SEM_DICA' ? cached.content : null;
  }

  if (cached) {
    await withDbTimeout(
      db.update(aiInsight).set({ content, contextHash, createdAt: new Date() }).where(eq(aiInsight.id, cached.id)),
      8000,
    );
  } else {
    await withDbTimeout(db.insert(aiInsight).values({ companyId, pageKey, content, contextHash }), 8000);
  }

  return content === 'SEM_DICA' ? null : content;
}
