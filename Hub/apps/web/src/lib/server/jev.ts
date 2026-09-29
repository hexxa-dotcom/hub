import 'server-only';
import { getDb, sql } from '@hexxa/db';
import { decryptSecret } from './secret-crypto';

/**
 * JEV (TypeSafe) — modelo de DECISÃO, não de texto.
 *
 * Recebe um estado e perguntas de opção fechada e devolve a opção, a
 * probabilidade de cada uma e a confiança. Sem JSON gerado para interpretar
 * (o que cortava a resposta do Gemini) e sem segunda chamada de revisão: a
 * confiança já diz se dá para lançar ou se vira pergunta.
 *
 * Medido na Gateway (28/09/2026, 49 movimentos com gabarito): com confiança
 * ≥ 0,6 lançaria 27 — todos certos; os 19 erros ficaram abaixo, virando
 * pergunta. Custo US$ 0,006 o lote, menos de 1 s.
 *
 * A confiança é só para o código decidir. Nunca vai para a tela.
 */

const URL_JEV = 'https://api.typesafe.ai/v1/systemone';

/** A partir daqui o Jev lança sozinho; abaixo, vira pergunta. */
export const CONFIANCA_PARA_LANCAR = 0.6;

export interface EscolhaDoJev {
  escolha: string;
  confianca: number;
  /** Opções da mais para a menos provável. */
  ranking: string[];
}

/**
 * A chave salva na tela de Integrações (cifrada) vale mais que a do ambiente.
 * Lida uma vez por minuto — um extrato faz dezenas de chamadas em paralelo.
 */
let cache: { chave: string | null; ate: number } | null = null;
export async function chaveDoJev(): Promise<string | null> {
  if (cache && cache.ate > Date.now()) return cache.chave;
  const [r] = (await getDb()
    .execute(sql`SELECT valor_cifrado FROM segredo_da_plataforma WHERE nome = 'TYPESAFE_API_KEY'`)
    .catch(() => [])) as unknown as { valor_cifrado: string }[];
  const chave = decryptSecret(r?.valor_cifrado) || process.env.TYPESAFE_API_KEY || null;
  cache = { chave, ate: Date.now() + 60_000 };
  return chave;
}

/** Depois de trocar a chave na tela, a próxima chamada já usa a nova. */
export function esquecerChaveDoJev() {
  cache = null;
}

export async function jevDisponivel(): Promise<boolean> {
  return !!(await chaveDoJev());
}

/** Uma pergunta de escolha sobre um estado. Null se o Jev falhar — quem chama usa a reserva. */
export async function escolherComJev(
  estado: unknown,
  instrucoes: string,
  opcoes: Record<string, string>,
): Promise<EscolhaDoJev | null> {
  const chave = await chaveDoJev();
  if (!chave || Object.keys(opcoes).length < 2) return null;
  try {
    const r = await fetch(URL_JEV, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.JEV_MODEL || 'jev-latest',
        state: estado,
        questions: { q: { type: 'choice', instructions: instrucoes, criteria: opcoes } },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      console.error('[jev]', r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const j = (await r.json()) as { answers?: { q?: { choice: string; confidence: number; probabilities?: Record<string, number> } } };
    const a = j.answers?.q;
    if (!a || !(a.choice in opcoes)) return null;
    const ranking = Object.entries(a.probabilities ?? { [a.choice]: 1 })
      .sort((x, y) => y[1] - x[1])
      .map(([k]) => k);
    return { escolha: a.choice, confianca: a.confidence, ranking };
  } catch (e) {
    console.error('[jev]', e);
    return null;
  }
}
