import { describe, it, expect } from 'vitest';
import { buildDps, type DpsEmitente, type DpsServico } from './dps-builder';
import type { NfseIssueInput } from '@hexxa/core/ports';

const emitente: DpsEmitente = {
  ambiente: 'homologacao',
  cnpj: '11.222.333/0001-81',
  codigoMunicipio: '3550308',
  optanteSimples: true,
  regimeApuracao: '3',
};

const servico: DpsServico = {
  itemListaServico: '1.01',
  aliquotaIss: 2.5,
};

const input: NfseIssueInput = {
  customer: {
    name: 'Cliente Teste Ltda',
    document: '12345678000199',
    email: 'cliente@teste.com',
  },
  amount: 1000,
  serviceDescription: 'Desenvolvimento de software',
  referenceMonth: '2026-08',
  competenciaDate: '2026-08-15',
};

describe('buildDps', () => {
  it('gera o Id do infDPS no formato DPS+cMun(7)+tpInsc(1)+nInsc(14)+serie(5)+nDPS(15)', () => {
    const { refId } = buildDps({ emitente, servico, serie: '1', numero: 42 }, input);
    expect(refId).toBe('DPS' + '3550308' + '2' + '11222333000181' + '00001' + '000000000000042');
    expect(refId).toHaveLength(3 + 7 + 1 + 14 + 5 + 15);
  });

  it('inclui tpAmb=2 (homologação) e ambiente=1 quando produção', () => {
    const { xml } = buildDps({ emitente, servico, serie: '1', numero: 1 }, input);
    expect(xml).toContain('<tpAmb>2</tpAmb>');

    const { xml: xmlProd } = buildDps(
      { emitente: { ...emitente, ambiente: 'producao' }, servico, serie: '1', numero: 1 },
      input,
    );
    expect(xmlProd).toContain('<tpAmb>1</tpAmb>');
  });

  it('deriva cTribNac de 6 dígitos a partir do item LC116', () => {
    const { xml } = buildDps({ emitente, servico: { itemListaServico: '17.19' }, serie: '1', numero: 1 }, input);
    expect(xml).toContain('<cTribNac>171900</cTribNac>');
  });

  it('usa CNPJ ou CPF do tomador conforme o tamanho do documento', () => {
    const { xml } = buildDps({ emitente, servico, serie: '1', numero: 1 }, input);
    expect(xml).toContain('<CNPJ>12345678000199</CNPJ>');

    const { xml: xmlCpf } = buildDps(
      { emitente, servico, serie: '1', numero: 1 },
      { ...input, customer: { ...input.customer, document: '12345678909' } },
    );
    expect(xmlCpf).toContain('<CPF>12345678909</CPF>');
  });

  it('preserva letras do CNPJ alfanumérico do prestador (não trunca com onlyDigits)', () => {
    const { xml, refId } = buildDps(
      { emitente: { ...emitente, cnpj: '12.ABC.345/01DE-35' }, servico, serie: '1', numero: 1 },
      input,
    );
    expect(xml).toContain('<CNPJ>12ABC34501DE35</CNPJ>');
    expect(refId).toContain('12ABC34501DE35');
  });

  it('reconhece CNPJ alfanumérico do tomador mesmo com poucos dígitos numéricos restantes', () => {
    // 14 caracteres, mas só 6 são dígitos — um onlyDigits ingênuo devolveria
    // 6 caracteres (≤11) e cairia erroneamente no ramo CPF.
    const { xml } = buildDps(
      { emitente, servico, serie: '1', numero: 1 },
      { ...input, customer: { ...input.customer, document: 'AB12CD34EF5678' } },
    );
    expect(xml).toContain('<CNPJ>AB12CD34EF5678</CNPJ>');
    expect(xml).not.toContain('<CPF>');
  });

  it('escapa caracteres especiais em campos de texto livre', () => {
    const { xml } = buildDps(
      { emitente, servico, serie: '1', numero: 1 },
      { ...input, serviceDescription: 'Serviço "A&B" <especial>' },
    );
    expect(xml).toContain('Serviço &quot;A&amp;B&quot; &lt;especial&gt;');
    expect(xml).not.toContain('<especial>');
  });

  it('não inclui pAliq quando ME/EPP do Simples sem retenção (regra E0625)', () => {
    const { xml } = buildDps({ emitente, servico, serie: '1', numero: 1 }, input);
    expect(xml).not.toContain('<pAliq>');
  });

  it('inclui pAliq quando há retenção de ISS pelo tomador', () => {
    const { xml } = buildDps({ emitente, servico, serie: '1', numero: 1 }, { ...input, retainIss: true });
    expect(xml).toContain('<pAliq>2.50</pAliq>');
    expect(xml).toContain('<tpRetISSQN>2</tpRetISSQN>');
  });

  it('produz XML bem-formado com um único elemento raiz DPS', () => {
    const { xml } = buildDps({ emitente, servico, serie: '1', numero: 1 }, input);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><DPS ')).toBe(true);
    expect(xml.endsWith('</DPS>')).toBe(true);
    const openTags = xml.match(/<DPS[ >]/g) ?? [];
    const closeTags = xml.match(/<\/DPS>/g) ?? [];
    expect(openTags).toHaveLength(1);
    expect(closeTags).toHaveLength(1);
  });
});
