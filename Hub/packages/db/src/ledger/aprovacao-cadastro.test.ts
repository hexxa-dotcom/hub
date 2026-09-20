import { describe, it, expect } from 'vitest';
import { separarTelefone, competenciaInicialPadrao } from './aprovacao-cadastro';

describe('separarTelefone', () => {
  it('separa DDD de celular e de fixo, com ou sem +55', () => {
    expect(separarTelefone('+55 (47) 99693-2914')).toEqual({ ddd: '47', numero: '996932914' });
    expect(separarTelefone('4733334444')).toEqual({ ddd: '47', numero: '33334444' });
  });

  it('recusa o que não é telefone, em vez de mandar um número de enfeite', () => {
    expect(separarTelefone('123')).toBeNull();
    expect(separarTelefone(null)).toBeNull();
  });
});

describe('competenciaInicialPadrao', () => {
  it('é janeiro do ano corrente — a mesma regra da janela do extrato', () => {
    expect(competenciaInicialPadrao('2026-09-19')).toBe('202601');
    expect(competenciaInicialPadrao('2026-09-19', '201901')).toBe('202601');
  });

  it('empresa aberta neste ano começa no mês da abertura', () => {
    expect(competenciaInicialPadrao('2026-09-19', '202605')).toBe('202605');
  });
});
