import { describe, it, expect } from 'vitest';
import { estimativaPresumido } from './presumido';

describe('estimativaPresumido', () => {
  it('R$ 50 mil: 11,33% sem adicional', () => {
    const e = estimativaPresumido(50_000);
    expect(e.pis).toBe(325);
    expect(e.cofins).toBe(1500);
    expect(e.irpj).toBe(2400);
    expect(e.adicionalIrpj).toBe(0);
    expect(e.csll).toBe(1440);
    expect(e.total).toBe(5665);
    expect(e.aliquotaEfetiva).toBe(11.33);
  });
  it('R$ 100 mil: adicional de 10% sobre o que passa de R$ 20 mil de base', () => {
    // base 32.000 → adicional sobre 12.000 = 1.200
    expect(estimativaPresumido(100_000).adicionalIrpj).toBe(1200);
  });
  it('sem receita, sem imposto', () => {
    expect(estimativaPresumido(0).total).toBe(0);
  });
});
