import { CORRELACAO_IBSCBS } from './ibscbs-correlacao';

/**
 * IBS e CBS NA NOTA — o que a DPS precisa dizer (LC 214/2025; NT CGNFS-e 007
 * e 009/2026, leiaute RTC v1.04).
 *
 * O prestador não precisa saber os códigos: a partir do item da LC 116 do
 * perfil fiscal, a tabela oficial (Anexo VIII) dá a NBS, o indicador da
 * operação e a classificação tributária. O perfil pode sobrepor a
 * classificação e o CST, quando o contador souber de um caso especial.
 *
 * Datas: regime regular já informa (sem rejeição até 31/12/2026); Simples
 * Nacional e MEI só a partir de janeiro de 2027.
 */

export interface IbsCbsDaNota {
  nbs: string | null;
  cIndOp: string;
  cClassTrib: string;
  /** CST: os três primeiros dígitos da classificação. */
  cst: string;
  /** Veio da tabela oficial (true) ou do perfil (false). */
  daTabela: boolean;
}

/** "17.02", "1702", "17.2" → "17.02". */
export function normalizarItemLc116(item: string | null | undefined): string {
  const partes = String(item ?? '').replace(/[^\d.]/g, '').split('.');
  if (partes.length >= 2) return `${partes[0]!.padStart(2, '0')}.${partes[1]!.padStart(2, '0')}`;
  const d = partes[0] ?? '';
  return d.length >= 3 ? `${d.slice(0, d.length - 2).padStart(2, '0')}.${d.slice(-2)}` : d;
}

/** As opções oficiais do item (NBS possíveis), para o perfil escolher quando houver mais de uma. */
export function opcoesIbsCbs(itemLc116: string | null | undefined) {
  return (CORRELACAO_IBSCBS[normalizarItemLc116(itemLc116)] ?? []).map(([nbs, descNbs, cIndOp, cClassTrib]) => ({ nbs, descNbs, cIndOp, cClassTrib }));
}

/**
 * O IBS/CBS da nota: o que o perfil disser, completado pela tabela oficial.
 * Null quando não há como afirmar — aí a nota não leva o grupo (e até
 * 31/12/2026 isso não causa rejeição).
 */
export function ibsCbsDaNota(p: { itemLc116: string | null | undefined; nbs?: string | null; cClassTrib?: string | null; cst?: string | null }): IbsCbsDaNota | null {
  const opcoes = opcoesIbsCbs(p.itemLc116);
  const daNbs = p.nbs ? opcoes.find((o) => o.nbs === p.nbs) : undefined;
  const base = daNbs ?? opcoes[0];
  const cClassTrib = (p.cClassTrib || base?.cClassTrib || '').replace(/\D/g, '');
  const cIndOp = base?.cIndOp ?? '';
  if (cClassTrib.length !== 6 || cIndOp.length !== 6) return null;
  return {
    nbs: p.nbs || base?.nbs || null,
    cIndOp,
    cClassTrib,
    cst: (p.cst || cClassTrib.slice(0, 3)).replace(/\D/g, '').padStart(3, '0'),
    daTabela: !p.cClassTrib,
  };
}
