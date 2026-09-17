import type { Transition } from 'framer-motion';

/**
 * Molas do design system. A Apple descreve mola por dois parâmetros de
 * designer — amortecimento (quanto passa do alvo) e resposta (quão rápido
 * chega lá, em segundos) — em vez do trio massa/rigidez/atrito. No
 * framer-motion isso mapeia direto: `bounce` = amortecimento, `duration` =
 * resposta (não é duração fixa: a mola não tem uma).
 *
 * Regra: `ui` é o padrão. `momentum` só quando o próprio gesto trouxe
 * inércia (arrasto, flick) — passar do alvo numa aba que só recebeu clique
 * parece erro, não física.
 */
export const spring = {
  /** Padrão: criticamente amortecido, sem passar do alvo. */
  ui: { type: 'spring', bounce: 0, duration: 0.4 },
  /** Chrome pequeno (pílula de aba, indicador) — mesma curva, mais curta. */
  snappy: { type: 'spring', bounce: 0, duration: 0.3 },
  /** Só para interação com inércia de gesto: arrastar gaveta, soltar card. */
  momentum: { type: 'spring', bounce: 0.2, duration: 0.4 },
} as const satisfies Record<string, Transition>;

/** Substituto sem deslocamento, para quem pediu movimento reduzido. */
export const crossFade: Transition = { type: 'tween', duration: 0.15, ease: 'easeOut' };
