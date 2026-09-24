import { describe, it, expect } from 'vitest';
import { lerConfigDaNfse, cTribNacParaItemLC116 } from './ler-config-da-nfse';

/** Uma NFS-e do Padrão Nacional, reduzida ao que o leitor usa. */
const NOTA = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infNFSe Id="NFS123">
    <nNFSe>000000042</nNFSe>
    <xLocEmi>Porto Alegre</xLocEmi>
    <DPS>
      <infDPS Id="DPS123">
        <cLocEmi>4314902</cLocEmi>
        <prest>
          <CNPJ>62414421000116</CNPJ>
          <regTrib>
            <opSimpNac>3</opSimpNac>
            <regApTribSN>1</regApTribSN>
            <regEspTrib>0</regEspTrib>
          </regTrib>
        </prest>
        <toma>
          <CNPJ>47316917000163</CNPJ>
          <xNome>BM3 GESTAO EM SAUDE LTDA</xNome>
        </toma>
        <serv>
          <locPrest><cLocPrestacao>4314902</cLocPrestacao></locPrest>
          <cServ>
            <cTribNac>171900</cTribNac>
            <cTribMun>170190</cTribMun>
            <xDescServ>Servicos de contabilidade</xDescServ>
          </cServ>
        </serv>
        <valores>
          <trib><tribMun><tribISSQN>1</tribISSQN><pAliq>2.50</pAliq></tribMun></trib>
        </valores>
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>`;

describe('lerConfigDaNfse', () => {
  it('extrai o que o passo fiscal pediria à mão', () => {
    const c = lerConfigDaNfse(NOTA);
    expect(c.itemListaServico).toBe('17.19');
    expect(c.aliquotaIss).toBe(2.5);
    expect(c.codigoTributacaoMunicipio).toBe('170190');
    expect(c.codigoMunicipio).toBe('4314902');
  });

  it('pega o CNPJ do PRESTADOR, não o do tomador', () => {
    // Os dois usam a tag <CNPJ>; ler a primeira ocorrência solta traria o
    // errado quando a nota tem tomador pessoa jurídica.
    expect(lerConfigDaNfse(NOTA).prestadorCnpj).toBe('62414421000116');
  });

  it('traz o regime do prestador e a descrição do serviço', () => {
    const c = lerConfigDaNfse(NOTA);
    expect(c.opSimpNac).toBe('3');
    expect(c.regimeEspecial).toBe('0');
    expect(c.descricaoServico).toBe('Servicos de contabilidade');
    expect(c.numeroNota).toBe('000000042');
  });

  it('lê XML com prefixo de namespace', () => {
    const comPrefixo = NOTA.replace(/<cTribNac>/g, '<ns2:cTribNac>').replace(
      /<\/cTribNac>/g,
      '</ns2:cTribNac>',
    );
    expect(lerConfigDaNfse(comPrefixo).itemListaServico).toBe('17.19');
  });

  it('o que não vier fica null, em vez de virar zero', () => {
    const c = lerConfigDaNfse('<NFSe></NFSe>');
    expect(c.itemListaServico).toBeNull();
    expect(c.aliquotaIss).toBeNull();
    expect(c.prestadorCnpj).toBeNull();
  });

  it('nota do Simples sem retenção não traz alíquota — e isso não é zero', () => {
    // Regra E0625: ME/EPP do Simples sem retenção NÃO informa pAliq. Ler como
    // 0% faria a tela gravar alíquota zero e o imposto sair errado.
    const semAliq = NOTA.replace('<pAliq>2.50</pAliq>', '');
    expect(lerConfigDaNfse(semAliq).aliquotaIss).toBeNull();
  });
});

describe('cTribNacParaItemLC116', () => {
  it('desfaz a conversão do builder', () => {
    expect(cTribNacParaItemLC116('171900')).toBe('17.19');
    expect(cTribNacParaItemLC116('010100')).toBe('1.01');
    expect(cTribNacParaItemLC116('160200')).toBe('16.02');
  });

  it('mantém a variação quando ela não é genérica', () => {
    expect(cTribNacParaItemLC116('170901')).toBe('17.09.01');
  });

  it('código vazio ou zerado não vira item', () => {
    expect(cTribNacParaItemLC116('000000')).toBeNull();
    expect(cTribNacParaItemLC116(null)).toBeNull();
  });
});

/**
 * Ida e volta com o próprio emissor.
 *
 * O leitor desfaz o que `buildDps` faz. Se um dos dois mudar de tag ou de
 * formato sem o outro, é aqui que aparece — e não num cliente cuja primeira
 * nota sai com a alíquota errada.
 */
describe('ida e volta com o buildDps', () => {
  it('lê de volta o que a Hexx acabou de escrever', async () => {
    const { buildDps } = await import('./dps-builder');
    const { xml } = buildDps(
      {
        emitente: {
          ambiente: 'producao',
          cnpj: '62.414.421/0001-16',
          codigoMunicipio: '4314902',
          optanteSimples: true,
          // regimeApuracao 1 = não optante: assim o builder INFORMA a pAliq
          // (no Simples sem retenção ele a omite, regra E0625).
          regimeApuracao: '1',
        },
        servico: { itemListaServico: '17.19', aliquotaIss: 2.5, codigoTributacaoMunicipio: '170190' },
        serie: '1',
        numero: 7,
      },
      {
        customer: { name: 'Cliente Ltda', document: '47316917000163' },
        amount: 1000,
        serviceDescription: 'Servicos de contabilidade',
        referenceMonth: '2026-09',
        competenciaDate: '2026-09-15',
      },
    );

    const c = lerConfigDaNfse(xml);
    expect(c.prestadorCnpj).toBe('62414421000116');
    expect(c.codigoMunicipio).toBe('4314902');
    expect(c.itemListaServico).toBe('17.19');
    expect(c.codigoTributacaoMunicipio).toBe('170190');
    expect(c.aliquotaIss).toBe(2.5);
    expect(c.descricaoServico).toBe('Servicos de contabilidade');
  });
});
