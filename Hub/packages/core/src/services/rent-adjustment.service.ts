/**
 * Reajuste de aluguel (Gestão Patrimonial) — regra de negócio PURA.
 * Aplica IPCA/IGP-M acumulado quando o contrato completa o ciclo (12 meses).
 * A série do índice vem de uma port (EconomicIndexPort) — injeção de dependência.
 */
import type { EconomicIndexPort } from '../ports/index';
import type { IndexType } from '../enums';

export interface RentAdjustmentInput {
  currentRent: number;
  indexType: IndexType;
  /** mês-base do último reajuste (o MÊS, nunca "competência"). */
  anchorMonth: string; // YYYY-MM
  /** mês atual de avaliação. */
  currentMonth: string; // YYYY-MM
}

export interface RentAdjustmentResult {
  shouldAdjust: boolean;
  accumulatedChange: number; // fração
  newRent: number;
  nextAnchorMonth: string;
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
}

export class RentAdjustmentService {
  constructor(private readonly indexProvider: EconomicIndexPort) {}

  async preview(input: RentAdjustmentInput): Promise<RentAdjustmentResult> {
    const elapsed = monthsBetween(input.anchorMonth, input.currentMonth);
    const shouldAdjust = elapsed >= 12;

    if (!shouldAdjust) {
      return {
        shouldAdjust: false,
        accumulatedChange: 0,
        newRent: input.currentRent,
        nextAnchorMonth: input.anchorMonth,
      };
    }

    const change = await this.indexProvider.accumulatedChange(
      input.indexType,
      input.anchorMonth,
      input.currentMonth,
    );

    return {
      shouldAdjust: true,
      accumulatedChange: change,
      newRent: Math.round(input.currentRent * (1 + change) * 100) / 100,
      nextAnchorMonth: input.currentMonth,
    };
  }
}
