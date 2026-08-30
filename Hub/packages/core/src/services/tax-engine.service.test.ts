import { describe, it, expect } from 'vitest';
import { TaxEngineService, type SimplesNacionalInput } from './tax-engine.service';

// Faixas simplificadas do Anexo III (mesmos limites/alíquotas do seed real).
const brackets: SimplesNacionalInput['brackets'] = [
  { annex: 'III', bracket: 1, minRevenue: 0, maxRevenue: 180000, nominalRate: 6.0, deductionAmount: 0, partitionDistribution: { irpj: 100 } },
  { annex: 'III', bracket: 2, minRevenue: 180000.01, maxRevenue: 360000, nominalRate: 11.2, deductionAmount: 9360, partitionDistribution: { irpj: 100 } },
  { annex: 'III', bracket: 3, minRevenue: 360000.01, maxRevenue: 720000, nominalRate: 13.5, deductionAmount: 17640, partitionDistribution: { irpj: 100 } },
];

function baseInput(rba12: number): SimplesNacionalInput {
  return {
    rba12,
    payroll12: rba12 * 0.3,
    currentRevenue: 10000,
    subjectToFatorR: false,
    primaryAnnex: 'III',
    brackets,
    fatorRLimit: 0.28,
  };
}

describe('TaxEngineService.calculateSimplesNacional — seleção de faixa', () => {
  it('RBA12 no meio de uma faixa cai na faixa certa', () => {
    const r = TaxEngineService.calculateSimplesNacional(baseInput(50000), 'r1');
    expect(r.appliedBracket).toBe(1);
  });

  it('RBA12 exatamente no teto da faixa 1 (180000,00) continua na faixa 1 — não cai pro fallback (última faixa)', () => {
    const r = TaxEngineService.calculateSimplesNacional(baseInput(180000), 'r2');
    expect(r.appliedBracket).toBe(1);
  });

  it('RBA12 um centavo acima do teto da faixa 1 já cai na faixa 2', () => {
    const r = TaxEngineService.calculateSimplesNacional(baseInput(180000.01), 'r3');
    expect(r.appliedBracket).toBe(2);
  });

  it('RBA12 exatamente no teto da faixa 2 (360000,00) continua na faixa 2', () => {
    const r = TaxEngineService.calculateSimplesNacional(baseInput(360000), 'r4');
    expect(r.appliedBracket).toBe(2);
  });

  it('RBA12 acima de todas as faixas cai na última (comportamento de fallback esperado)', () => {
    const r = TaxEngineService.calculateSimplesNacional(baseInput(1000000), 'r5');
    expect(r.appliedBracket).toBe(3);
  });
});
