import { describe, it, expect } from 'vitest';
import { calcularAlavancaFatorR } from './fator-r-alavanca';

describe('calcularAlavancaFatorR', () => {
  it('diz quanto subir o pró-labore para chegar a 28%', () => {
    // RBT12 de 600k, folha de 120k (20%) — toda ela pró-labore.
    const r = calcularAlavancaFatorR({
      rbt12: 600_000,
      folha12: 120_000,
      folhaEmpregados12: 0,
      receitaDoMes: 50_000,
    })!;
    expect(r.jaFavoravel).toBe(false);
    expect(r.fatorR).toBeCloseTo(0.2, 5);
    // 28% de 600k = 168k/ano = 14k/mês. Hoje são 10k/mês.
    expect(r.proLaboreAlvo).toBe(14_000);
    expect(r.aumentoMensal).toBe(4_000);
  });

  it('a economia é a diferença de alíquota entre o Anexo V e o III', () => {
    const r = calcularAlavancaFatorR({
      rbt12: 600_000,
      folha12: 120_000,
      folhaEmpregados12: 0,
      receitaDoMes: 50_000,
    })!;
    expect(r.economiaMensal).toBeGreaterThan(0);
    expect(r.aliquotaHoje).toBeGreaterThan(r.aliquotaNoAnexoIII);
    // Confere o encadeamento: economia = receita × diferença de alíquota.
    const esperado = (50_000 * (r.aliquotaHoje - r.aliquotaNoAnexoIII)) / 100;
    expect(r.economiaMensal).toBeCloseTo(esperado, 1);
  });

  it('o INSS do sócio sai separado, a 11% do aumento', () => {
    const r = calcularAlavancaFatorR({
      rbt12: 600_000,
      folha12: 120_000,
      folhaEmpregados12: 0,
      receitaDoMes: 50_000,
    })!;
    expect(r.inssSobreOAumento).toBe(440); // 11% de 4.000
    expect(r.sobraMensal).toBeCloseTo(r.economiaMensal - 440, 2);
  });

  it('quem já está acima de 28% não recebe sugestão', () => {
    const r = calcularAlavancaFatorR({
      rbt12: 600_000,
      folha12: 200_000,
      folhaEmpregados12: 150_000,
      receitaDoMes: 50_000,
    })!;
    expect(r.jaFavoravel).toBe(true);
    expect(r.economiaMensal).toBe(0);
    expect(r.aumentoMensal).toBe(0);
  });

  it('desconta a folha de empregados do alvo — ela já conta para o Fator R', () => {
    const r = calcularAlavancaFatorR({
      rbt12: 600_000,
      folha12: 120_000,
      folhaEmpregados12: 120_000, // tudo empregado, pró-labore zero
      receitaDoMes: 50_000,
    })!;
    // Faltam 48k/ano = 4k/mês, e o pró-labore hoje é zero.
    expect(r.proLaboreAlvo).toBe(4_000);
    expect(r.aumentoMensal).toBe(4_000);
  });

  it('avisa quando subir o pró-labore custa mais do que economiza', () => {
    // Receita mensal baixa: a economia no DAS não paga o INSS do aumento.
    const r = calcularAlavancaFatorR({
      rbt12: 600_000,
      folha12: 12_000,
      folhaEmpregados12: 0,
      receitaDoMes: 100,
    })!;
    expect(r.naoCompensa).toBe(true);
    expect(r.sobraMensal).toBeLessThan(0);
  });

  it('empresa sem receita não produz alavanca', () => {
    expect(
      calcularAlavancaFatorR({ rbt12: 0, folha12: 0, folhaEmpregados12: 0, receitaDoMes: 0 }),
    ).toBeNull();
  });
});
