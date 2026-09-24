import { describe, it, expect } from 'vitest';
import { inssEmpregado, inssProLabore, irrfMensal, proLaboreDoMes, custoDoColaborador } from './folha';

describe('INSS 2026', () => {
  it('salário mínimo: 7,5%', () => expect(inssEmpregado(1621)).toBe(121.58));
  it('progressivo por faixa', () => {
    // 1621×7,5% + 1281,84×9% + 1451,43×12% + 645,73×14%
    expect(inssEmpregado(5000)).toBeCloseTo(121.575 + 115.3656 + 174.1716 + 90.4022, 1);
  });
  it('limitado ao teto', () => expect(inssEmpregado(20000)).toBe(inssEmpregado(8475.55)));
  it('pró-labore: 11% até o teto', () => {
    expect(inssProLabore(5000)).toBe(550);
    expect(inssProLabore(20000)).toBe(932.31);
  });
});

describe('IRRF 2026', () => {
  it('até R$ 5.000 não paga', () => expect(irrfMensal(5000, 550)).toBe(0));
  it('entre 5.000 e 7.350 paga com redutor', () => {
    const semRedutor = (6000 - 660) * 0.275 - 908.73; // 559,77
    const redutor = 978.62 - 0.133145 * 6000; // 179,75
    expect(irrfMensal(6000, 660)).toBeCloseTo(semRedutor - redutor, 1);
  });
  it('acima de 7.350 paga a tabela cheia', () => expect(irrfMensal(10000, 932.31)).toBeCloseTo((10000 - 932.31) * 0.275 - 908.73, 1));
});

describe('pró-labore e custo', () => {
  it('pró-labore de R$ 5.000: só o INSS', () => expect(proLaboreDoMes(5000)).toEqual({ bruto: 5000, inss: 550, irrf: 0, liquido: 4450 }));
  it('custo de um CLT de R$ 3.000', () => {
    const c = custoDoColaborador(3000);
    expect(c.fgts).toBe(240);
    expect(c.provisaoFerias).toBe(333.33);
    expect(c.provisao13).toBe(250);
    expect(c.custoMensal).toBeCloseTo(3000 + 240 + 333.33 + 250 + 46.67, 1);
  });
});
