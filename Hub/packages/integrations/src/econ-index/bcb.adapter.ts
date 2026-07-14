import type { EconomicIndexPort } from '@hexxa/core/ports';

/**
 * Provedor de índices IPCA/IGP-M via API de séries temporais do Banco Central.
 * IMPLEMENTA EconomicIndexPort, usado pelo RentAdjustmentService.
 * Séries (SGS): IPCA = 433, IGP-M = 189.
 */
const SERIES: Record<'IPCA' | 'IGPM', number> = { IPCA: 433, IGPM: 189 };

export class BcbIndexAdapter implements EconomicIndexPort {
  async accumulatedChange(index: 'IPCA' | 'IGPM', fromMonth: string, toMonth: string): Promise<number> {
    const code = SERIES[index];
    const url =
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados` +
      `?formato=json&dataInicial=${toBcbDate(fromMonth)}&dataFinal=${toBcbDate(toMonth)}`;
    const res = await fetch(url);
    const data = (await res.json()) as { valor: string }[];
    // Acumula as variações mensais (em %): produto de (1 + v/100) - 1
    return data.reduce((acc, row) => acc * (1 + Number(row.valor) / 100), 1) - 1;
  }
}

/** 'YYYY-MM' -> 'DD/MM/YYYY' (dia 01) exigido pela API do BCB. */
function toBcbDate(month: string): string {
  const [y, m] = month.split('-');
  return `01/${m}/${y}`;
}
