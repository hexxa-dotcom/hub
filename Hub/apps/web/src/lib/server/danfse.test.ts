import { describe, it, expect } from 'vitest';
import { parseNfseXml } from './danfse';

const CHAVE = '42113061246311617000129000000000002626080000000014';

function wrapXml(inner: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">${inner}</NFSe>`;
}

describe('parseNfseXml — local da prestação e local de incidência (UF)', () => {
  it('deriva a UF do CÓDIGO IBGE do local — não empresta a UF do prestador quando o serviço é interestadual', () => {
    // Prestador em São Paulo, serviço prestado E incidência no Rio de Janeiro.
    const xml = wrapXml(`
      <infNFSe Id="X">
        <nNFSe>1</nNFSe>
        <xLocEmi>São Paulo</xLocEmi>
        <xLocPrestacao>Rio de Janeiro</xLocPrestacao>
        <dhProc>2026-08-19T12:00:00-03:00</dhProc>
        <emit><CNPJ>11222333000181</CNPJ><xNome>Empresa SP</xNome><enderNac><UF>SP</UF><cMun>3550308</cMun></enderNac></emit>
        <IBSCBS><cLocalidadeIncid>3304557</cLocalidadeIncid><xLocalidadeIncid>Rio de Janeiro</xLocalidadeIncid></IBSCBS>
        <DPS><infDPS Id="Y"><tpAmb>1</tpAmb><dCompet>2026-08-01</dCompet><cLocEmi>3550308</cLocEmi>
          <toma><CNPJ>99888777000166</CNPJ><xNome>Cliente RJ</xNome></toma>
          <serv><locPrest><cLocPrestacao>3304557</cLocPrestacao></locPrest><cServ><xDescServ>Servico</xDescServ></cServ></serv>
        </infDPS></DPS>
      </infNFSe>`);

    const data = parseNfseXml(xml, CHAVE);
    expect(data.prestador.municipio).toBe('São Paulo / SP');
    expect(data.localPrestacao).toBe('Rio de Janeiro / RJ');
    expect(data.ibsCbs.localIncidencia).toBe('Rio de Janeiro / RJ');
  });

  it('quando o serviço é prestado no mesmo estado do prestador, UF continua correta', () => {
    const xml = wrapXml(`
      <infNFSe Id="X">
        <nNFSe>1</nNFSe>
        <xLocEmi>Itajaí</xLocEmi>
        <xLocPrestacao>Itajaí</xLocPrestacao>
        <dhProc>2026-08-19T12:00:00-03:00</dhProc>
        <emit><CNPJ>11222333000181</CNPJ><xNome>Empresa SC</xNome><enderNac><UF>SC</UF><cMun>4208203</cMun></enderNac></emit>
        <DPS><infDPS Id="Y"><tpAmb>1</tpAmb><dCompet>2026-08-01</dCompet><cLocEmi>4208203</cLocEmi>
          <toma><CNPJ>99888777000166</CNPJ><xNome>Cliente</xNome></toma>
          <serv><locPrest><cLocPrestacao>4208203</cLocPrestacao></locPrest><cServ><xDescServ>Servico</xDescServ></cServ></serv>
        </infDPS></DPS>
      </infNFSe>`);

    const data = parseNfseXml(xml, CHAVE);
    expect(data.localPrestacao).toBe('Itajaí / SC');
  });
});

describe('parseNfseXml — ambiente de homologação', () => {
  it('marca homologacao=true quando tpAmb=2 na DPS', () => {
    const xml = wrapXml(`
      <infNFSe Id="X"><nNFSe>1</nNFSe>
        <emit><CNPJ>11222333000181</CNPJ><xNome>Empresa</xNome></emit>
        <DPS><infDPS Id="Y"><tpAmb>2</tpAmb><dCompet>2026-08-01</dCompet>
          <toma><CNPJ>99888777000166</CNPJ><xNome>Cliente</xNome></toma>
          <serv><cServ><xDescServ>Servico</xDescServ></cServ></serv>
        </infDPS></DPS>
      </infNFSe>`);
    expect(parseNfseXml(xml, CHAVE).homologacao).toBe(true);
  });

  it('marca homologacao=false quando tpAmb=1 (produção)', () => {
    const xml = wrapXml(`
      <infNFSe Id="X"><nNFSe>1</nNFSe>
        <emit><CNPJ>11222333000181</CNPJ><xNome>Empresa</xNome></emit>
        <DPS><infDPS Id="Y"><tpAmb>1</tpAmb><dCompet>2026-08-01</dCompet>
          <toma><CNPJ>99888777000166</CNPJ><xNome>Cliente</xNome></toma>
          <serv><cServ><xDescServ>Servico</xDescServ></cServ></serv>
        </infDPS></DPS>
      </infNFSe>`);
    expect(parseNfseXml(xml, CHAVE).homologacao).toBe(false);
  });
});

describe('parseNfseXml — valores (não confundir infNFSe.valores com infDPS.valores)', () => {
  it('usa vServPrest.vServ (DPS) como valor bruto do serviço, e vLiq (NFSe) como líquido — mesmo com dedução', () => {
    const xml = wrapXml(`
      <infNFSe Id="X"><nNFSe>1</nNFSe>
        <emit><CNPJ>11222333000181</CNPJ><xNome>Empresa</xNome></emit>
        <valores><vISSQN>20.00</vISSQN><vLiq>900.00</vLiq></valores>
        <DPS><infDPS Id="Y"><tpAmb>1</tpAmb><dCompet>2026-08-01</dCompet>
          <toma><CNPJ>99888777000166</CNPJ><xNome>Cliente</xNome></toma>
          <serv><cServ><xDescServ>Servico</xDescServ></cServ></serv>
          <valores><vServPrest><vServ>1000.00</vServ></vServPrest></valores>
        </infDPS></DPS>
      </infNFSe>`);
    const data = parseNfseXml(xml, CHAVE);
    // Com dedução de 100 no meio do caminho, bruto (1000) e líquido (900) DEVEM divergir.
    expect(data.valores.valorServico).toBe(1000);
    expect(data.valores.valorLiquido).toBe(900);
  });
});

describe('parseNfseXml — CEP e documentos preservam zeros à esquerda', () => {
  it('não perde o zero inicial do CEP do tomador', () => {
    const xml = wrapXml(`
      <infNFSe Id="X"><nNFSe>1</nNFSe>
        <emit><CNPJ>11222333000181</CNPJ><xNome>Empresa</xNome></emit>
        <DPS><infDPS Id="Y"><tpAmb>1</tpAmb><dCompet>2026-08-01</dCompet>
          <toma><CNPJ>99888777000166</CNPJ><xNome>Cliente</xNome>
            <end><endNac><cMun>3550308</cMun><CEP>01310100</CEP></endNac><xLgr>Rua</xLgr><nro>1</nro><xBairro>Centro</xBairro></end>
          </toma>
          <serv><cServ><xDescServ>Servico</xDescServ></cServ></serv>
        </infDPS></DPS>
      </infNFSe>`);
    const data = parseNfseXml(xml, CHAVE);
    expect(data.tomador.endereco?.cep).toBe('01310100');
  });
});
