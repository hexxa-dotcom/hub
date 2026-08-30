import { describe, it, expect } from 'vitest';
import { buildCancelamentoEvento, inferCancelamentoMotivo } from './evento-builder';

describe('inferCancelamentoMotivo', () => {
  it('detecta "erro na emissão" -> 1', () => {
    expect(inferCancelamentoMotivo('Erro na emissão, valor errado')).toBe('1');
  });
  it('detecta "serviço não prestado" -> 2', () => {
    expect(inferCancelamentoMotivo('Serviço não prestado ao cliente')).toBe('2');
  });
  it('cai em "outros" (9) quando não reconhece o texto', () => {
    expect(inferCancelamentoMotivo('Pedido do cliente')).toBe('9');
  });
});

describe('buildCancelamentoEvento', () => {
  const chave = '35' + '0'.repeat(48); // 50 dígitos, formato de chave de acesso
  const params = {
    ambiente: 'homologacao' as const,
    chaveAcesso: chave,
    cnpjAutor: '11222333000181',
    motivo: '1' as const,
    justificativa: 'Erro na emissão da nota',
  };

  it('gera o Id do infPedReg como "PRE" + chave(50) + tipoEvento(6)', () => {
    const { refId } = buildCancelamentoEvento(params);
    expect(refId).toBe(`PRE${chave}101101`);
    expect(refId).toHaveLength(3 + 50 + 6);
  });

  it('preserva letras do CNPJ alfanumérico do autor do evento', () => {
    const { xml } = buildCancelamentoEvento({ ...params, cnpjAutor: '12.ABC.345/01DE-35' });
    expect(xml).toContain('<CNPJAutor>12ABC34501DE35</CNPJAutor>');
  });

  it('inclui o elemento e101101 com cMotivo e xMotivo', () => {
    const { xml } = buildCancelamentoEvento(params);
    expect(xml).toContain('<e101101>');
    expect(xml).toContain('<cMotivo>1</cMotivo>');
    expect(xml).toContain('<xMotivo>Erro na emissão da nota</xMotivo>');
    expect(xml).toContain(`<chNFSe>${chave}</chNFSe>`);
    expect(xml).toContain('<CNPJAutor>11222333000181</CNPJAutor>');
  });

  it('usa tpAmb=1 em produção e 2 em homologação', () => {
    const { xml: xmlHomolog } = buildCancelamentoEvento(params);
    expect(xmlHomolog).toContain('<tpAmb>2</tpAmb>');

    const { xml: xmlProd } = buildCancelamentoEvento({ ...params, ambiente: 'producao' });
    expect(xmlProd).toContain('<tpAmb>1</tpAmb>');
  });

  it('trunca a justificativa em 255 caracteres (limite do campo xMotivo)', () => {
    const longa = 'a'.repeat(300);
    const { xml } = buildCancelamentoEvento({ ...params, justificativa: longa });
    expect(xml).toContain(`<xMotivo>${'a'.repeat(255)}</xMotivo>`);
    expect(xml).not.toContain('a'.repeat(256));
  });

  it('produz XML bem-formado com um único elemento raiz pedRegEvento', () => {
    const { xml } = buildCancelamentoEvento(params);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><pedRegEvento ')).toBe(true);
    expect(xml.endsWith('</pedRegEvento>')).toBe(true);
  });
});
