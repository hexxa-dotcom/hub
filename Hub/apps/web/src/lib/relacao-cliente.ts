/**
 * RELAÇÃO COM O CLIENTE — recorrente, avulso ou inativo.
 *
 * "Ativo" dizia pouco: quem manda nota todo mês e quem comprou uma vez há
 * três meses ficavam iguais. Pela regra:
 *   recorrente — nota em pelo menos 3 dos últimos 4 meses (tolera uma falha)
 *                ou contrato ativo;
 *   avulso     — comprou nos últimos 6 meses, sem essa regularidade;
 *   inativo    — nada nos últimos 6 meses.
 * O empresário pode marcar recorrente ou avulso à mão; aí a marca vale sobre a
 * regra (mas quem não compra há 6 meses continua aparecendo como inativo).
 */

export type Relacao = 'RECORRENTE' | 'AVULSO' | 'INATIVO';
export type MarcaDeRecorrencia = 'RECORRENTE' | 'AVULSO' | null;

export interface DadosDaRelacao {
  contratosAtivos: number;
  aReceber: number;
  ultimaNota: string | null;
  mesesComNota4: number;
  recorrenciaManual: MarcaDeRecorrencia;
}

const SEIS_MESES = 183 * 86400000;

export function relacaoDoCliente(c: DadosDaRelacao): Relacao {
  const recente = !!c.ultimaNota && Date.now() - Date.parse(c.ultimaNota) <= SEIS_MESES;
  const emAberto = c.contratosAtivos > 0 || c.aReceber > 0;
  if (!recente && !emAberto) return 'INATIVO';
  if (c.recorrenciaManual) return c.recorrenciaManual;
  return c.contratosAtivos > 0 || c.mesesComNota4 >= 3 ? 'RECORRENTE' : 'AVULSO';
}

export const ROTULO_DA_RELACAO: Record<Relacao, string> = { RECORRENTE: 'Recorrente', AVULSO: 'Avulso', INATIVO: 'Inativo' };

/** A cor do ponto de cada relação. */
export const COR_DA_RELACAO: Record<Relacao, string> = {
  RECORRENTE: 'bg-emerald-500',
  AVULSO: 'bg-amber-500',
  INATIVO: 'bg-black/20 dark:bg-white/25',
};
