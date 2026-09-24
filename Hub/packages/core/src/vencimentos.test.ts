import { describe, it, expect } from 'vitest';
import { diasDeVencimento } from './vencimentos';

describe('diasDeVencimento', () => {
  it('começa no mês seguinte quando o início é depois do dia de vencimento', () => {
    expect(diasDeVencimento('2026-09-24', '2026-12-31', 10)).toEqual(['2026-10-10', '2026-11-10', '2026-12-10']);
  });
  it('começa no mesmo mês quando o vencimento ainda não passou', () => {
    expect(diasDeVencimento('2026-09-05', '2026-11-30', 10)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10']);
  });
  it('vence no último dia em mês mais curto', () => {
    expect(diasDeVencimento('2027-01-31', '2027-03-31', 31)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });
  it('um ano de contrato são 12 parcelas', () => {
    expect(diasDeVencimento('2026-10-01', '2027-09-30', 5)).toHaveLength(12);
  });
  it('contrato curto que acaba antes do vencimento tem uma parcela no fim', () => {
    expect(diasDeVencimento('2026-09-20', '2026-10-05', 10)).toEqual(['2026-10-05']);
  });
});
