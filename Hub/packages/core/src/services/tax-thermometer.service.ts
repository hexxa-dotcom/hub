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

export type AnexoDeServico = 'III' | 'IV' | 'V';

/** Uma faixa de um anexo, como está no banco (`tax_annex_bracket`). */
export interface FaixaDoAnexo {
  annex: string;
  bracket: number;
  maxRevenue: number;
  nominalRate: number;
  deductionAmount: number;
}

/** Posição no Simples Nacional (serviços: anexo III, IV ou V). */
export interface SimplesPosition {
  anexo: AnexoDeServico;
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
  /**
   * Acima de R$ 3,6 milhões o ISS sai do DAS e é pago à parte ao município
   * (sublimite, LC 123 art. 13-A). 'ACIMA' = já passou; 'PERTO' = a menos de 10%.
   */
  sublimite: 'ABAIXO' | 'PERTO' | 'ACIMA';
}

const ATTENTION_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;
const FATOR_R_LIMIT = 0.28;

/** Limites superiores das 6 faixas do Simples (RBT12). */
const FAIXA_LIMITS = [180_000, 360_000, 720_000, 1_800_000, 3_600_000, 4_800_000];
/** Sublimite estadual/municipal: acima dele o ISS sai do DAS. */
const SUBLIMITE = 3_600_000;
/**
 * Tabelas de reserva — LC 123/2006 com a LC 155/2016. A fonte é o banco
 * (`tax_annex_bracket`, que o contador edita); estas só valem se a tabela
 * não for passada, e são iguais às do banco hoje.
 */
const RATES: Record<AnexoDeServico, number[]> = {
  III: [6, 11.2, 13.5, 16, 21, 33],
  IV: [4.5, 9, 10.2, 14, 22, 33],
  V: [15.5, 18, 19.5, 20.5, 23, 30.5],
};
const PDS: Record<AnexoDeServico, number[]> = {
  III: [0, 9_360, 17_640, 35_640, 125_640, 648_000],
  IV: [0, 8_100, 12_420, 39_780, 183_780, 828_000],
  V: [0, 4_500, 9_900, 17_100, 62_100, 540_000],
};

/**
 * RBT12 de quem ainda não tem 12 meses de atividade (LC 123, art. 18, §§ 1º-2º).
 *
 * A lei manda usar a MÉDIA dos meses anteriores × 12 — no primeiro mês, a
 * receita do próprio mês × 12. Somar só os meses que existem jogava a
 * empresa nova numa faixa (e alíquota) menor que a real.
 *
 * @param somaAnteriores receita dos meses de atividade antes do mês apurado
 * @param mesesAnteriores quantos meses de atividade houve antes dele (0 no 1º mês)
 * @param receitaDoMes receita do mês apurado (usada só no 1º mês)
 */
export function rbt12Proporcional(somaAnteriores: number, mesesAnteriores: number, receitaDoMes: number): number {
  if (mesesAnteriores >= 12) return somaAnteriores;
  if (mesesAnteriores <= 0) return receitaDoMes * 12;
  return (somaAnteriores / mesesAnteriores) * 12;
}

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

  /**
   * Em qual anexo/faixa do Simples a empresa está e quanto falta p/ a próxima faixa.
   *
   * `anexo`, quando informado, é o que a apuração OFICIAL usou. Sem ele, o
   * anexo é deduzido do Fator R — o que só vale para atividade sujeita ao
   * Fator R. Deduzir para uma empresa do Anexo III por atividade, com folha
   * baixa, dava Anexo V: faixa e projeção saíam nas alíquotas do V (15,5%,
   * 18%) para quem paga pelas do III (6%, 11,2%).
   */
  simplesPosition(input: {
    rbt12: number;
    payroll12: number;
    /** O anexo conhecido (apurado ou marcado pelo contador). Sem ele, deduz III/V pelo Fator R. */
    anexo?: AnexoDeServico;
    /** As faixas do banco. Sem elas, as tabelas de reserva. */
    tabela?: FaixaDoAnexo[];
  }): SimplesPosition {
    // Sem faturamento ainda e com folha/pró-labore, a razão é "infinita" —
    // a empresa está acima dos 28%. Dividir por zero dava 0 e jogava no V.
    const fatorR = input.rbt12 > 0 ? input.payroll12 / input.rbt12 : input.payroll12 > 0 ? 1 : 0;
    const anexo: AnexoDeServico = input.anexo ?? (fatorR >= FATOR_R_LIMIT ? 'III' : 'V');
    const doBanco = (input.tabela ?? []).filter((f) => f.annex === anexo).sort((a, b) => a.bracket - b.bracket);
    const rates = doBanco.length === 6 ? doBanco.map((f) => f.nominalRate) : RATES[anexo];
    const pds = doBanco.length === 6 ? doBanco.map((f) => f.deductionAmount) : PDS[anexo];

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
      sublimite: input.rbt12 > SUBLIMITE ? 'ACIMA' : input.rbt12 > SUBLIMITE * 0.9 ? 'PERTO' : 'ABAIXO',
    };
  }
}
