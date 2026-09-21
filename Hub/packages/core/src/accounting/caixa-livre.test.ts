import { describe, it, expect } from 'vitest';
import { calcularCaixaLivre } from './caixa-livre';

const saldos = (m: Record<string, number>) =>
  Object.entries(m).map(([code, balance]) => ({ code, balance }));

describe('calcularCaixaLivre', () => {
  it('desconta imposto, fornecedor e pró-labore do que está em conta', () => {
    const r = calcularCaixaLivre({
      saldos: saldos({
        '1.1.01.002': 18400, // banco
        '2.1.03.001': 1240, // impostos a recolher
        '2.1.01.001': 3100, // fornecedores
        '2.1.02.003': 4200, // pró-labore a pagar
      }),
    });
    expect(r.livre).toBe(9860);
    expect(r.saldoEmConta).toBe(18400);
    expect(r.pessoal).toBe(4200);
  });

  it('NÃO desconta lucros a pagar — esse dinheiro já é do sócio', () => {
    const r = calcularCaixaLivre({
      saldos: saldos({ '1.1.01.002': 10000, '2.1.04.001': 4000 }),
    });
    expect(r.livre).toBe(10000);
    expect(r.lucrosAPagar).toBe(4000);
  });

  it('soma o imposto do mês ainda não provisionado', () => {
    const r = calcularCaixaLivre({
      saldos: saldos({ '1.1.01.002': 10000 }),
      impostoEstimadoDoMes: 900,
    });
    expect(r.impostos).toBe(900);
    expect(r.livre).toBe(9100);
  });

  it('soma caixa e banco', () => {
    const r = calcularCaixaLivre({
      saldos: saldos({ '1.1.01.001': 500, '1.1.01.002': 1500 }),
    });
    expect(r.saldoEmConta).toBe(2000);
  });

  it('mostra negativo quando a empresa deve mais do que tem', () => {
    const r = calcularCaixaLivre({
      saldos: saldos({ '1.1.01.002': 1000, '2.1.01.001': 4000 }),
    });
    expect(r.livre).toBe(-3000);
  });

  it('separa o que ninguém classificou, sem tirar do saldo', () => {
    const r = calcularCaixaLivre({
      saldos: saldos({ '1.1.01.002': 5000, '1.1.09.001': 700 }),
    });
    expect(r.aClassificar).toBe(700);
    expect(r.livre).toBe(5000);
  });

  it('empresa sem nada não quebra', () => {
    expect(calcularCaixaLivre({ saldos: [] }).livre).toBe(0);
  });
});

describe('saldo desconhecido', () => {
  it('avisa quando o razão não tem nenhum movimento de caixa ou banco', () => {
    // Foi o caso da BM3: folha e DAS provisionados, extrato nunca carregado.
    // Sem a trava, a tela diria "-R$ 17.044 livre para retirar".
    const r = calcularCaixaLivre({
      saldos: saldos({ '2.1.02.003': 12971.86, '2.1.03.001': 4043.02 }),
    });
    expect(r.saldoConhecido).toBe(false);
  });

  it('com movimento bancário, o saldo é conhecido mesmo se zerado', () => {
    const r = calcularCaixaLivre({ saldos: saldos({ '1.1.01.002': 0 }) });
    expect(r.saldoConhecido).toBe(true);
  });
});
