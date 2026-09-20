import { describe, it, expect } from 'vitest';
import { inicioDaJanelaDeExtrato } from './importar-extrato';

/**
 * Regra do escritório: extrato só do ano corrente. O exercício anterior está
 * fechado e entra pelo balanço de abertura, não por lançamento.
 */
describe('inicioDaJanelaDeExtrato', () => {
  it('aceita desde 1º de janeiro do ano corrente', () => {
    expect(inicioDaJanelaDeExtrato('2026-09-19')).toBe('2026-01-01');
    expect(inicioDaJanelaDeExtrato('2027-02-01')).toBe('2027-01-01');
    expect(inicioDaJanelaDeExtrato('2026-12-31')).toBe('2026-01-01');
  });

  it('em janeiro ainda aceita dezembro, que é fechado em janeiro', () => {
    expect(inicioDaJanelaDeExtrato('2027-01-10')).toBe('2026-12-01');
  });
});
