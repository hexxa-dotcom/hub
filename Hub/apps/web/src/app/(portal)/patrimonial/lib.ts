/**
 * Regras dos BENS — as mesmas em todas as telas (Bens, Aluguéis).
 *
 * Depreciação linear pelas taxas usuais (IN SRF nº 162/1998 e IN RFB nº
 * 1700/2017), contada em meses de uso desde a compra. Terreno não deprecia.
 *
 * O imposto do aluguel NÃO é mais um Lucro Presumido fixo: é a alíquota do
 * regime da empresa (a mesma da Bússola — a efetiva do Simples, ou a do
 * Presumido), passada por quem chama. Assim a previsão bate com a guia.
 */

export const TIPOS = [
  'Imóvel',
  'Terreno',
  'Veículo',
  'Máquina ou Equipamento',
  'Móveis e Utensílios',
  'Equipamento de Informática',
  'Outro',
] as const;
export type TipoDeBem = (typeof TIPOS)[number];

/** Taxa anual (%) e vida útil (anos) de cada tipo. */
export const TAXAS: Record<TipoDeBem, { rate: number; vida: number }> = {
  'Imóvel': { rate: 4, vida: 25 },
  'Terreno': { rate: 0, vida: 0 },
  'Veículo': { rate: 20, vida: 5 },
  'Máquina ou Equipamento': { rate: 10, vida: 10 },
  'Móveis e Utensílios': { rate: 10, vida: 10 },
  'Equipamento de Informática': { rate: 20, vida: 5 },
  'Outro': { rate: 10, vida: 10 },
};

/** Meses completos de uso entre a compra e `ate` (datas AAAA-MM-DD). */
export function mesesDeUso(compra: string, ate: string) {
  const [ay, am, ad] = compra.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = ate.split('-').map(Number) as [number, number, number];
  return Math.max(0, (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0));
}

export function depreciacaoAcumulada(valor: number, taxa: number, meses: number) {
  return Math.min(valor, (valor * taxa * meses) / 1200);
}

/** Depreciação do mês, zerada quando o bem já está todo depreciado. */
export function depreciacaoMensal(valor: number, taxa: number, meses: number) {
  const falta = valor - depreciacaoAcumulada(valor, taxa, meses);
  return Math.max(0, Math.min((valor * taxa) / 1200, falta));
}

/** Imposto previsto sobre a receita de aluguel, pela alíquota do regime em % (6 = 6%). */
export function impostoAluguel(receita: number, aliquotaPct: number) {
  return (Math.max(0, receita) * Math.max(0, aliquotaPct)) / 100;
}
