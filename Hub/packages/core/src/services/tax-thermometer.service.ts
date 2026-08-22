/**
 * Termômetro Tributário (Dashboard) — regra de negócio PURA.
 * Calcula o uso do teto de faturamento, o Fator R e a posição no
 * Simples Nacional (anexo III/V e faixa de faturamento).
 */

export interface ThermometerInput {
  /** Teto de faturamento aplicável (ex.: R$ 4.800.000 no Simples). */
  revenueCeiling: number;
  /** Faturamento acumulado nos últimos 12 meses (RBT12). */
  revenueLast12Months: number;
  /** Folha (pró-labore + salários) nos últimos 12 meses — para o Fator R. */
  payrollLast12Months: number;
}

export type ThermometerLevel = 'OK' | 'ATENCAO' | 'CRITICO';

export interface ThermometerResult {
  usagePct: number; // 0..1 do teto
  level: ThermometerLevel;
  fatorR: number;
  fatorRFavorable: boolean;
}

/** Posição no Simples Nacional (serviços: anexo III ou V conforme Fator R). */
export interface SimplesPosition {
  anexo: 'III' | 'V';
  fatorR: number;
  fatorRFavorable: boolean; // >= 0.28 → Anexo III (geralmente mais vantajoso)
  faixa: number; // 1..6
  faixaMin: number;
  faixaMax: number;
  nominalRate: number; // alíquota nominal da faixa atual (%)
  /** Alíquota efetiva real: ((RBT12 × alíquota nominal) − parcela a deduzir) / RBT12. */
  effectiveRate: number;
  /** Quanto falta (R$) para entrar na próxima faixa; null se já na última. */
  toNextFaixa: number | null;
  nextRate: number | null; // alíquota nominal da próxima faixa (%)
  ceiling: number; // teto (4.8M)
  ceilingUsagePct: number; // 0..1 do teto
}

const ATTENTION_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;
const FATOR_R_LIMIT = 0.28;

/** Limites superiores das 6 faixas do Simples (RBT12). */
const FAIXA_LIMITS = [180_000, 360_000, 720_000, 1_800_000, 3_600_000, 4_800_000];
/** Alíquotas nominais por faixa — Anexo III e Anexo V. */
const RATES_III = [6, 11.2, 13.5, 16, 21, 33];
const RATES_V = [15.5, 18, 19.5, 20.5, 23, 30.5];
/** Parcela a deduzir (R$) por faixa — LC 123/2006, tabelas Anexo III e V. */
const PD_III = [0, 9_360, 17_640, 35_640, 125_640, 648_000];
const PD_V = [0, 4_500, 9_900, 17_100, 62_100, 540_000];

export class TaxThermometerService {
  evaluate(input: ThermometerInput): ThermometerResult {
    const usagePct =
      input.revenueCeiling > 0 ? input.revenueLast12Months / input.revenueCeiling : 0;

    const level: ThermometerLevel =
      usagePct >= CRITICAL_THRESHOLD ? 'CRITICO' : usagePct >= ATTENTION_THRESHOLD ? 'ATENCAO' : 'OK';

    const fatorR =
      input.revenueLast12Months > 0 ? input.payrollLast12Months / input.revenueLast12Months : 0;

    return { usagePct, level, fatorR, fatorRFavorable: fatorR >= FATOR_R_LIMIT };
  }

  /** Em qual anexo/faixa do Simples a empresa está e quanto falta p/ a próxima faixa. */
  simplesPosition(input: { rbt12: number; payroll12: number }): SimplesPosition {
    const fatorR = input.rbt12 > 0 ? input.payroll12 / input.rbt12 : 0;
    const anexo: 'III' | 'V' = fatorR >= FATOR_R_LIMIT ? 'III' : 'V';
    const rates = anexo === 'III' ? RATES_III : RATES_V;
    const pds = anexo === 'III' ? PD_III : PD_V;

    let idx = FAIXA_LIMITS.findIndex((limit) => input.rbt12 <= limit);
    if (idx === -1) idx = FAIXA_LIMITS.length - 1; // acima do teto → última faixa

    const isLast = idx === FAIXA_LIMITS.length - 1;
    const faixaMin = idx === 0 ? 0 : FAIXA_LIMITS[idx - 1]!;
    const faixaMax = FAIXA_LIMITS[idx]!;
    const toNextFaixa = isLast ? null : Math.max(0, faixaMax - input.rbt12);
    const nextRate = isLast ? null : rates[idx + 1]!;
    const nominalRate = rates[idx]!;
    const effectiveRate =
      input.rbt12 > 0 ? Math.max(0, (input.rbt12 * (nominalRate / 100) - pds[idx]!) / input.rbt12) * 100 : 0;

    return {
      anexo,
      fatorR,
      fatorRFavorable: fatorR >= FATOR_R_LIMIT,
      faixa: idx + 1,
      faixaMin,
      faixaMax,
      nominalRate,
      effectiveRate,
      toNextFaixa,
      nextRate,
      ceiling: 4_800_000,
      ceilingUsagePct: input.rbt12 / 4_800_000,
    };
  }
}
