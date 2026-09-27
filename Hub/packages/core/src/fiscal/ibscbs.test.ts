import { describe, it, expect } from 'vitest';
import { ibsCbsDaNota, normalizarItemLc116, opcoesIbsCbs } from './ibscbs';

describe('IBS/CBS pela tabela oficial (Anexo VIII)', () => {
  it('normaliza o item da LC 116', () => {
    expect(normalizarItemLc116('17.2')).toBe('17.02');
    expect(normalizarItemLc116('1702')).toBe('17.02');
    expect(normalizarItemLc116('01.01')).toBe('01.01');
  });
  it('item 17.02 (apoio administrativo): tributação integral, operação 100301', () => {
    const r = ibsCbsDaNota({ itemLc116: '17.02' })!;
    expect(r.cClassTrib).toBe('000001');
    expect(r.cst).toBe('000');
    expect(r.cIndOp).toBe('100301');
    expect(r.nbs).toMatch(/^1\.\d{4}\.\d{2}\.\d{2}$/);
  });
  it('o perfil pode sobrepor a classificação', () => {
    const r = ibsCbsDaNota({ itemLc116: '17.02', cClassTrib: '200052' })!;
    expect(r.cClassTrib).toBe('200052');
    expect(r.cst).toBe('200');
    expect(r.daTabela).toBe(false);
  });
  it('item desconhecido não inventa código', () => {
    expect(ibsCbsDaNota({ itemLc116: '99.99' })).toBeNull();
    expect(opcoesIbsCbs('99.99')).toEqual([]);
  });
});
