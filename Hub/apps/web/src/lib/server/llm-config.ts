import 'server-only';
import type { LlmConfig, LlmProvider } from '@hexxa/integrations';
import { BASE_URLS } from '@hexxa/integrations';

/**
 * RESOLUÇÃO DO MOTOR DE IA.
 *
 * Junta a credencial (provedor + chave, guardadas cifradas em
 * `ai_insight_config`) com o modelo a usar, e devolve a configuração pronta
 * para o gateway.
 *
 * Por que o modelo mora aqui e não mais no meio de cada função de rede: até
 * então cinco módulos tinham `'gemini-3.6-flash'` escrito dentro, e trocar de
 * modelo exigia achar os cinco. Agora é um lugar — e quando a configuração por
 * empresa existir, é aqui que ela entra, sem tocar em quem chama.
 */

/**
 * Modelo padrão por provedor.
 *
 * Gemini aponta para o Flash-Lite, e não para o Flash: é o mais barato da
 * geração atual (US$ 0,25/1,50 contra 0,75/3,75) e dá conta de escolher um
 * item numa lista, que é o trabalho real do classificador. O Flash ainda está
 * em preço promocional que dobra em 01/01/2027; o Flash-Lite não tem esse
 * aumento anunciado.
 */
export const MODELO_PADRAO: Record<LlmProvider, string> = {
  gemini: 'gemini-3.1-flash-lite',
  anthropic: 'claude-haiku-4-5-20251001',
  'openai-compat': 'deepseek-chat',
};

/**
 * Endpoint padrão quando o provedor é da família OpenAI.
 *
 * Sem `LLM_BASE_URL` no ambiente cai no DeepSeek, que é o endpoint dessa
 * família que faz sentido como padrão pelo preço. Trocar para Kimi, OpenRouter
 * ou Groq é mudar a variável — nenhum código muda, porque todos falam a mesma
 * API.
 */
function baseUrlPadrao(): string {
  return process.env.LLM_BASE_URL || BASE_URLS.deepseek;
}

export interface Credencial {
  provider: LlmProvider;
  apiKey: string;
}

/**
 * Monta a configuração do motor.
 *
 * `LLM_MODEL` no ambiente sobrepõe o padrão — é a válvula para testar um
 * modelo novo sem deploy. Quando a configuração por empresa entrar, ela passa
 * na frente dos dois.
 */
export async function resolverMotor(cred: Credencial): Promise<LlmConfig> {
  const model = process.env.LLM_MODEL || MODELO_PADRAO[cred.provider];

  return {
    provider: cred.provider,
    apiKey: cred.apiKey,
    model,
    ...(cred.provider === 'openai-compat' ? { baseUrl: baseUrlPadrao() } : {}),
  };
}

/**
 * Credencial a partir do ambiente, para os usos que NÃO passam pelo switch do
 * contador.
 *
 * A distinção é deliberada e vem do código anterior: a sugestão de texto num
 * campo de formulário é ferramenta de digitação, disparada pelo usuário no
 * momento em que ele quer. Desligá-la junto com as dicas proativas quebraria
 * um botão que a pessoa acabou de apertar, por uma configuração que trata de
 * outra coisa.
 */
export function credencialDoAmbiente(): Credencial | null {
  if (process.env.GEMINI_API_KEY) {
    return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.LLM_API_KEY) {
    return { provider: 'openai-compat', apiKey: process.env.LLM_API_KEY };
  }
  return null;
}
