import { describe, it, expect } from 'vitest';
import { normalizeDocument, documentKind, isCompleteDocument, formatDocument } from './document-br';

describe('normalizeDocument', () => {
  it('remove máscara mas preserva letras', () => {
    expect(normalizeDocument('12.ABC.345/01DE-35')).toBe('12ABC34501DE35');
  });
  it('uppercasa letras minúsculas', () => {
    expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });
  it('lida com null/undefined', () => {
    expect(normalizeDocument(null)).toBe('');
    expect(normalizeDocument(undefined)).toBe('');
  });
});

describe('documentKind', () => {
  it('CPF: 11 dígitos numéricos', () => {
    expect(documentKind('12345678909')).toBe('CPF');
  });
  it('CNPJ alfanumérico: 14 caracteres com letras', () => {
    expect(documentKind('12ABC34501DE35')).toBe('CNPJ');
  });
  it('CNPJ numérico tradicional: 14 dígitos', () => {
    expect(documentKind('11222333000181')).toBe('CNPJ');
  });
  it('detecta CNPJ mesmo incompleto, assim que aparece uma letra', () => {
    expect(documentKind('12A')).toBe('CNPJ');
  });
  it('entrada parcial sem letra e ≤11 chars ainda é tratada como CPF (heurística de digitação)', () => {
    expect(documentKind('123456')).toBe('CPF');
  });
});

describe('isCompleteDocument', () => {
  it('CPF completo com 11 dígitos', () => {
    expect(isCompleteDocument('123.456.789-09')).toBe(true);
  });
  it('CNPJ alfanumérico completo com 14 caracteres', () => {
    expect(isCompleteDocument('12.ABC.345/01DE-35')).toBe(true);
  });
  it('incompleto retorna false', () => {
    expect(isCompleteDocument('123.456')).toBe(false);
    expect(isCompleteDocument('12.ABC.345')).toBe(false);
  });
});

describe('formatDocument', () => {
  it('formata CPF', () => {
    expect(formatDocument('12345678909')).toBe('123.456.789-09');
  });
  it('formata CNPJ numérico', () => {
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('formata CNPJ alfanumérico sem perder as letras', () => {
    expect(formatDocument('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  });
  it('formata incrementalmente durante a digitação (CNPJ alfanumérico parcial)', () => {
    expect(formatDocument('12ABC')).toBe('12.ABC');
  });
});
