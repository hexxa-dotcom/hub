/**
 * Regras fiscais/contábeis do módulo Gestão Patrimonial, centralizadas aqui
 * pra não duplicar a mesma fórmula em cada aba (Ativos, Aluguéis...).
 *
 * Depreciação linear pelas taxas usuais (IN SRF nº 162/1998 e IN RFB nº
 * 1700/2017). Imposto sobre aluguéis estimado pelo Lucro Presumido — base
 * presumida de 32% sobre a receita, IRPJ 15% + CSLL 9% = 24% sobre a base.
 */

export const TAXAS: Record<string, { rate: number; vida: number }> = {
  'Imóvel': { rate: 4, vida: 25 },
  'Máquina ou Equipamento': { rate: 10, vida: 10 },
  'Móveis e Utensílios': { rate: 10, vida: 10 },
  'Veículo': { rate: 20, vida: 5 },
  'Equipamento de Informática': { rate: 20, vida: 5 },
  'Outro': { rate: 10, vida: 10 },
};

/** Alíquota efetiva de IRPJ+CSLL sobre a receita bruta de aluguel (Lucro Presumido). */
export const ALIQUOTA_ALUGUEL = 0.32 * 0.24; // 7,68%

export function depreciacaoAcumulada(acq: number, rate: number, anos: number) {
  return Math.min(acq, (acq * rate * Math.max(0, anos)) / 100);
}

export function valorContabilLiquido(acq: number, rate: number, anos: number) {
  return acq - depreciacaoAcumulada(acq, rate, anos);
}

/** Depreciação anual do bem, zerada quando já totalmente depreciado. */
export function depreciacaoAnual(acq: number, rate: number, anos: number) {
  const acumulada = depreciacaoAcumulada(acq, rate, anos);
  if (acumulada >= acq) return 0;
  return Math.min(acq * (rate / 100), acq - acumulada);
}

export function impostoAluguel(rendaAnual: number) {
  return Math.max(0, rendaAnual) * ALIQUOTA_ALUGUEL;
}
