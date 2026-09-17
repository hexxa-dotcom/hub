/**
 * GATEWAY DE LLM — uma porta para qualquer motor.
 *
 * Antes disto, o código de chamada estava copiado em cinco módulos
 * (`ai-insight`, `ai-draft`, `ai-onboarding`, `agente-classificador`,
 * `ai-reconciliation`), cada um com o nome do modelo fixo no meio. Trocar de
 * motor exigia editar cinco lugares e lembrar de todos — e o quinto é sempre
 * o que fica para trás.
 *
 * A descoberta que simplifica tudo: **DeepSeek, Kimi (Moonshot), OpenRouter,
 * Groq e Together falam a API de chat da OpenAI.** Um adaptador
 * `openai-compat` com `baseUrl` configurável cobre todos eles. Então o
 * gateway tem três implementações, não sete — e adicionar um provedor novo
 * dessa família é preencher um formulário, não escrever código.
 *
 * O que este módulo NÃO faz, de propósito: decidir o que fazer com a resposta.
 * Ele devolve texto e contagem de tokens. Quem valida, mede confiança e aplica
 * a régua de autonomia é o sistema — e é isso que mantém o comportamento igual
 * independente do motor escolhido.
 */

export type LlmProvider = 'anthropic' | 'gemini' | 'openai-compat';

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  /** Identificador do modelo no provedor. Ex: 'gemini-3.1-flash-lite'. */
  model: string;
  /**
   * Endpoint base — só para `openai-compat`. É o que permite apontar para
   * DeepSeek, Kimi, OpenRouter ou um modelo local sem tocar em código.
   */
  baseUrl?: string;
}

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /** Baixa por padrão: classificação contábil não quer criatividade. */
  temperature?: number;
  /** Pede resposta em JSON quando o provedor souber impor isso. */
  json?: boolean;
}

export interface LlmResponse {
  text: string;
  tokensIn: number | null;
  tokensOut: number | null;
  /** Modelo que de fato respondeu — pode diferir do pedido em roteadores. */
  model: string;
}

export class LlmError extends Error {
  constructor(
    public readonly provider: LlmProvider,
    public readonly status: number | null,
    message: string,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'LlmError';
  }
}

/** Endpoints conhecidos da família OpenAI-compatível. */
export const BASE_URLS = {
  deepseek: 'https://api.deepseek.com/v1',
  moonshot: 'https://api.moonshot.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
} as const;

const TIMEOUT_MS = 60_000;

/**
 * Aborta a chamada em vez de deixá-la pendurada.
 *
 * Um agente que roda por cron e fica esperando um provedor lento consome o
 * tempo da função serverless inteira e morre sem registrar nada — pior que
 * falhar, porque não deixa rastro do que aconteceu.
 */
async function fetchComTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function chamarAnthropic(cfg: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
  const res = await fetchComTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 2000,
      temperature: req.temperature ?? 0.1,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    }),
  });

  if (!res.ok) throw new LlmError('anthropic', res.status, (await res.text()).slice(0, 400));

  const json = await res.json();
  return {
    text: (json.content?.[0]?.text ?? '').trim(),
    tokensIn: json.usage?.input_tokens ?? null,
    tokensOut: json.usage?.output_tokens ?? null,
    model: json.model ?? cfg.model,
  };
}

async function chamarGemini(cfg: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}` +
    `:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  const res = await fetchComTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 2000,
        temperature: req.temperature ?? 0.1,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!res.ok) throw new LlmError('gemini', res.status, (await res.text()).slice(0, 400));

  const json = await res.json();
  const usage = json.usageMetadata ?? {};
  return {
    text: (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim(),
    tokensIn: usage.promptTokenCount ?? null,
    tokensOut: usage.candidatesTokenCount ?? null,
    model: json.modelVersion ?? cfg.model,
  };
}

/**
 * Família OpenAI: DeepSeek, Kimi, OpenRouter, Groq, Together, modelo local.
 *
 * O `system` vai como mensagem de papel `system`, e não concatenado ao prompt
 * do usuário: os provedores desta família tratam os dois de forma diferente, e
 * juntar faria a instrução competir com o dado em vez de governá-lo.
 */
async function chamarOpenAICompat(cfg: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
  const base = (cfg.baseUrl ?? BASE_URLS.openai).replace(/\/+$/, '');

  const res = await fetchComTimeout(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 2000,
      temperature: req.temperature ?? 0.1,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    }),
  });

  if (!res.ok) throw new LlmError('openai-compat', res.status, (await res.text()).slice(0, 400));

  const json = await res.json();
  return {
    text: (json.choices?.[0]?.message?.content ?? '').trim(),
    tokensIn: json.usage?.prompt_tokens ?? null,
    tokensOut: json.usage?.completion_tokens ?? null,
    model: json.model ?? cfg.model,
  };
}

/** Chama o modelo configurado. Única porta de saída para qualquer provedor. */
export async function callLlm(cfg: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
  switch (cfg.provider) {
    case 'anthropic':
      return chamarAnthropic(cfg, req);
    case 'gemini':
      return chamarGemini(cfg, req);
    case 'openai-compat':
      return chamarOpenAICompat(cfg, req);
    default: {
      // Provedor desconhecido falha alto em vez de cair num padrão. Cair no
      // padrão mandaria dados para um endereço que ninguém escolheu.
      const nunca: never = cfg.provider;
      throw new LlmError(nunca, null, `Provedor não suportado: ${String(nunca)}`);
    }
  }
}

/**
 * Recorta um bloco JSON da resposta.
 *
 * Mesmo instruído a devolver JSON puro, o modelo às vezes embrulha em cerca de
 * markdown ou abre com "Claro, aqui está:". Recortar entre o primeiro
 * delimitador e o último é mais barato que perder o lote inteiro por causa de
 * três crases — e o que vier malformado devolve `null`, nunca um palpite.
 */
export function extrairJson<T>(texto: string, forma: 'array' | 'objeto' = 'array'): T | null {
  const [abre, fecha] = forma === 'array' ? ['[', ']'] : ['{', '}'];
  const inicio = texto.indexOf(abre);
  const fim = texto.lastIndexOf(fecha);
  if (inicio === -1 || fim === -1 || fim < inicio) return null;

  try {
    return JSON.parse(texto.slice(inicio, fim + 1)) as T;
  } catch {
    return null;
  }
}

export interface LlmJsonResult<T> {
  dados: T | null;
  tokensIn: number | null;
  tokensOut: number | null;
  model: string;
  /** Texto cru, para o log quando o recorte falha. */
  texto: string;
}

/** Chama o modelo e devolve JSON já recortado, com a contagem de tokens. */
export async function callLlmJson<T>(
  cfg: LlmConfig,
  req: LlmRequest,
  forma: 'array' | 'objeto' = 'array',
): Promise<LlmJsonResult<T>> {
  const r = await callLlm(cfg, { ...req, json: true });
  return {
    dados: extrairJson<T>(r.text, forma),
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    model: r.model,
    texto: r.text,
  };
}
