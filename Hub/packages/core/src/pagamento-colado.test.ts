import { describe, it, expect } from 'vitest';
import { lerPagamentoColado, vencimentoDoFator } from './pagamento-colado';

const HOJE = new Date('2026-09-23T12:00:00Z');

describe('vencimentoDoFator', () => {
  it('lê a era antiga (base 07/10/1997)', () => {
    expect(vencimentoDoFator(1000, new Date('2000-07-01'))).toBe('2000-07-03');
  });
  it('lê a era nova, reiniciada em 22/02/2025', () => {
    expect(vencimentoDoFator(1000, HOJE)).toBe('2025-02-22');
    expect(vencimentoDoFator(1579, HOJE)).toBe('2026-09-24');
  });
});

describe('lerPagamentoColado', () => {
  it('boleto bancário pela linha digitável', () => {
    // Banco 341 (Itaú), fator 1579 (24/09/2026), valor R$ 150,00
    const linha = '34191.09008 00000.000000 00000.000000 1 15790000015000';
    const r = lerPagamentoColado(linha, HOJE)!;
    expect(r.tipo).toBe('BOLETO');
    expect(r.favorecido).toBe('Itaú');
    expect(r.valor).toBe(150);
    expect(r.vencimento).toBe('2026-09-24');
  });

  it('boleto pelo código de barras de 44 dígitos', () => {
    const barras = '2379' + '1' + '1579' + '0000089990' + '0'.repeat(25);
    const r = lerPagamentoColado(barras, HOJE)!;
    expect(r.favorecido).toBe('Bradesco');
    expect(r.valor).toBe(899.9);
  });

  it('convênio com valor efetivo', () => {
    // 8 (arrecadação) 3 (energia) 6 (valor efetivo) + DV + 11 dígitos de valor
    const barras = '836' + '0' + '00000012345' + '0'.repeat(29);
    const r = lerPagamentoColado(barras, HOJE)!;
    expect(r.tipo).toBe('CONVENIO');
    expect(r.favorecido).toBe('Energia elétrica e gás');
    expect(r.valor).toBe(123.45);
  });

  it('Pix copia e cola com valor e recebedor', () => {
    const pix =
      '00020126330014br.gov.bcb.pix0111123456789005204000053039865406125.505802BR5913FORNECEDOR XP6009SAO PAULO62070503***6304ABCD';
    const r = lerPagamentoColado(pix, HOJE)!;
    expect(r.tipo).toBe('PIX');
    expect(r.valor).toBe(125.5);
    expect(r.favorecido).toBe('FORNECEDOR XP');
  });

  it('texto qualquer não é pagamento', () => {
    expect(lerPagamentoColado('olá', HOJE)).toBeNull();
  });
});
