import { describe, it, expect } from 'vitest';
import { conferirPlano } from './resultado-oneflow';

/**
 * A conferência que impede o capital social de entrar no lucro distribuível.
 *
 * Os números de "HEXX real" são o balancete de agosto/2026 lido do OneFlow:
 * resultado acumulado de R$ 34.159,70.
 */
const linha = (classificacao: string, descricaoConta: string, saldoFinal: number, saldoFinalDC: 'D' | 'C') =>
  ({ classificacao, descricaoConta, saldoFinal, saldoFinalDC });

const HEXX_REAL = [
  linha('1', 'Ativo', 38764.88, 'D'),
  linha('1.1', 'Ativo Circulante', 38764.88, 'D'),
  linha('2', 'Passivo', 4605.18, 'C'),
  linha('3', 'Receita', 41592.5, 'C'),
  linha('3.1', 'Receita de Vendas', 41592.5, 'C'),
  linha('4', 'Custo', 7432.8, 'D'),
];

describe('conferirPlano', () => {
  it('aceita o plano real da HEXX', () => {
    expect(conferirPlano(HEXX_REAL)).toBeNull();
  });

  it('recusa quando o grupo 3 é patrimônio líquido', () => {
    // O caso que motivou a trava: capital social lido como receita viraria
    // lucro distribuível.
    const plano = [
      linha('1', 'Ativo', 10000, 'D'),
      linha('2', 'Passivo', 2000, 'C'),
      linha('3', 'Patrimônio Líquido', 8000, 'C'),
      linha('4', 'Receitas', 0, 'C'),
    ];
    expect(conferirPlano(plano)).toMatch(/patrim/i);
  });

  it('recusa grupo de resultado que não reconhece', () => {
    const plano = [
      linha('1', 'Ativo', 100, 'D'),
      linha('2', 'Passivo', 50, 'C'),
      linha('3', 'Contas de Compensação', 50, 'C'),
    ];
    expect(conferirPlano(plano)).toMatch(/não é reconhecido/);
  });

  it('recusa quando os grupos 1 e 2 não são Ativo e Passivo', () => {
    const plano = [linha('1', 'Receitas', 100, 'C'), linha('2', 'Despesas', 100, 'D')];
    expect(conferirPlano(plano)).toMatch(/Grupo 1/);
  });

  it('recusa balancete que não fecha', () => {
    const plano = [...HEXX_REAL.filter((l) => l.classificacao !== '4'), linha('4', 'Custo', 7000, 'D')];
    expect(conferirPlano(plano)).toMatch(/não fecha/);
  });

  it('ignora acento e caixa nos nomes', () => {
    const plano = [
      linha('1', 'ATIVO', 500, 'D'),
      linha('2', 'PASSIVO E PATRIMÔNIO LÍQUIDO', 200, 'C'),
      linha('3', 'RECEITA BRUTA', 400, 'C'),
      linha('5', 'DESPESAS OPERACIONAIS', 100, 'D'),
    ];
    expect(conferirPlano(plano)).toBeNull();
  });
});
