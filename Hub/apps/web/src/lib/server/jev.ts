import 'server-only';

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

export function jevDisponivel(): boolean {
  return !!process.env.TYPESAFE_API_KEY;
}

/** Uma pergunta de escolha sobre um estado. Null se o Jev falhar — quem chama usa a reserva. */
export async function escolherComJev(
  estado: unknown,
  instrucoes: string,
  opcoes: Record<string, string>,
): Promise<EscolhaDoJev | null> {
  const chave = process.env.TYPESAFE_API_KEY;
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
