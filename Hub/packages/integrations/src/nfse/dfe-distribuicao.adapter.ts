import https from 'node:https';
import zlib from 'node:zlib';
import { DOMParser } from '@xmldom/xmldom';
import { type CertMaterial, buildMtlsAgent } from './cert';

/**
 * Cliente da API de "Distribuição de DF-e" do Sistema Nacional NFS-e (ADN —
 * Ambiente de Dados Nacional). Diferente do Emissor Nacional (sefin.nfse.gov.br,
 * usado por GovNfseAdapter pra EMITIR), esse serviço (adn.nfse.gov.br) só
 * CONSULTA — devolve, em lotes por NSU incremental, todo documento fiscal
 * (NFS-e emitida OU recebida, mais eventos como cancelamento) em que o CNPJ
 * consultado aparece como prestador ou tomador, não importa qual sistema
 * (Emissor Nacional, sistema próprio do município, etc.) emitiu a nota. Isso
 * funciona MESMO quando o município não está parametrizado pra emissão via
 * Emissor Nacional (confirmado empiricamente com notas de Navegantes/SC
 * emitidas via Atende.net — elas aparecem aqui).
 *
 * Spec: https://adn.nfse.gov.br/contribuintes/swagger/v1/swagger.json
 * Auth: mTLS com certificado A1/A3 ICP-Brasil do CNPJ consultado (ou de quem
 * tenha procuração — não usado aqui, só CNPJ próprio).
 */

const BASE_URL = {
  producao: 'https://adn.nfse.gov.br/contribuintes',
  homologacao: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
};

export type DfeTipoDocumento = 'NENHUM' | 'DPS' | 'PEDIDO_REGISTRO_EVENTO' | 'NFSE' | 'EVENTO' | 'CNC';

export interface DistribuicaoNsuItem {
  nsu: number;
  chaveAcesso: string;
  tipoDocumento: DfeTipoDocumento;
  tipoEvento?: string;
  dataHoraGeracao?: string;
}

export interface DistribuicaoLoteResult {
  statusProcessamento: 'REJEICAO' | 'NENHUM_DOCUMENTO_LOCALIZADO' | 'DOCUMENTOS_LOCALIZADOS';
  itens: DistribuicaoNsuItem[];
  ultNsu: number;
  erros: string[];
}

/** Um documento NFS-e já parseado a partir do XML devolvido pela distribuição. */
export interface NfseDistribuicaoDoc {
  nsu: number;
  chaveAcesso: string;
  numeroNfse?: string;
  municipioEmissao?: string;
  dataEmissao?: string;
  valorServico?: number;
  valorLiquido?: number;
  valorIss?: number;
  prestadorCnpj?: string;
  prestadorNome?: string;
  tomadorDocumento?: string;
  tomadorNome?: string;
  descricaoServico?: string;
  itemListaServico?: string;
  /** EMITIDA quando o CNPJ consultado é o prestador; RECEBIDA quando é o tomador. */
  direction: 'EMITIDA' | 'RECEBIDA' | null;
}

export interface DfeEventoDoc {
  nsu: number;
  chaveAcesso: string;
  tipoEvento: string;
  dataHoraGeracao?: string;
}

function httpsGetJson(agent: https.Agent, url: string): Promise<{ status: number; json: Record<string, unknown> | undefined; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { agent, method: 'GET', hostname: u.hostname, path: u.pathname + u.search, port: 443, headers: { Accept: 'application/json' } },
      (res) => {
        let chunks = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          let json: Record<string, unknown> | undefined;
          try {
            json = chunks ? (JSON.parse(chunks) as Record<string, unknown>) : undefined;
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode ?? 0, json, text: chunks });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout na consulta à Distribuição de DF-e'));
    });
    req.end();
  });
}

const tag = (el: Element | Document, name: string): string | undefined => {
  const found = el.getElementsByTagName(name)[0];
  return found?.textContent ?? undefined;
};

const first = (el: Element | Document, name: string): Element | undefined => {
  return (el.getElementsByTagName(name)[0] as Element) ?? undefined;
};

/**
 * Parseia o XML de uma NFS-e (padrão nacional) pra extrair os campos que
 * importam pra visualização de valores — não valida schema, é leitura best-effort
 * (o documento já veio assinado e aceito pelo governo, só estamos lendo).
 */
function parseNfseXml(xml: string, cnpjConsultado: string): Omit<NfseDistribuicaoDoc, 'nsu' | 'chaveAcesso'> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  const emit = first(doc, 'emit');
  const toma = first(doc, 'toma');
  const dps = first(doc, 'DPS');
  const infDPS = dps ? first(dps, 'infDPS') : undefined;
  const cServ = doc.getElementsByTagName('cServ')[0];

  const prestadorCnpj = emit ? tag(emit, 'CNPJ') : undefined;
  const prestadorNome = emit ? tag(emit, 'xNome') : undefined;
  const tomadorDocumento = toma ? (tag(toma, 'CNPJ') ?? tag(toma, 'CPF')) : undefined;
  const tomadorNome = toma ? tag(toma, 'xNome') : undefined;

  const digits = cnpjConsultado.replace(/\D/g, '');
  let direction: NfseDistribuicaoDoc['direction'] = null;
  if (prestadorCnpj && prestadorCnpj.replace(/\D/g, '') === digits) direction = 'EMITIDA';
  else if (tomadorDocumento && tomadorDocumento.replace(/\D/g, '') === digits) direction = 'RECEBIDA';

  const vServ = doc.getElementsByTagName('vServ')[0]?.textContent;
  const vLiq = doc.getElementsByTagName('vLiq')[0]?.textContent;
  const vISSQN = doc.getElementsByTagName('vISSQN')[0]?.textContent;

  return {
    numeroNfse: tag(doc, 'nNFSe'),
    municipioEmissao: tag(doc, 'xLocEmi'),
    dataEmissao: (infDPS && tag(infDPS, 'dhEmi')) ?? tag(doc, 'dhProc'),
    valorServico: vServ ? Number(vServ) : undefined,
    valorLiquido: vLiq ? Number(vLiq) : undefined,
    valorIss: vISSQN ? Number(vISSQN) : undefined,
    prestadorCnpj,
    prestadorNome,
    tomadorDocumento,
    tomadorNome,
    descricaoServico: cServ ? tag(cServ, 'xDescServ') : undefined,
    itemListaServico: cServ ? tag(cServ, 'cTribNac') : undefined,
    direction,
  };
}

/**
 * Busca um lote (até 50, conforme API) de documentos da distribuição a
 * partir de `ultNsu` (exclusive — devolve o que vier DEPOIS desse NSU).
 * Cada item já vem com o XML decompactado (gzip+base64 → texto), e se for
 * uma NFS-e, já parseado nos campos de valor.
 */
export async function fetchDistribuicaoLote(
  cert: CertMaterial,
  ambiente: 'producao' | 'homologacao',
  cnpjConsulta: string,
  ultNsu: number,
): Promise<{
  statusProcessamento: DistribuicaoLoteResult['statusProcessamento'];
  ultNsu: number;
  notas: NfseDistribuicaoDoc[];
  eventos: DfeEventoDoc[];
  erros: string[];
}> {
  const agent = buildMtlsAgent(cert);
  const cnpjDigits = cnpjConsulta.replace(/\D/g, '');
  const url = `${BASE_URL[ambiente]}/DFe/${ultNsu}?cnpjConsulta=${cnpjDigits}&lote=true`;

  const res = await httpsGetJson(agent, url);
  // "Nenhum documento a partir deste NSU" chega como HTTP 404 (E2220). Não é
  // falha: é o fim da fila, e acontece em toda sincronização que alcança o
  // último documento. Tratar como erro fazia toda sincronização terminar em erro.
  if (res.status === 404 && res.json?.StatusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO') {
    return { statusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO', ultNsu, notas: [], eventos: [], erros: [] };
  }
  if (res.status !== 200 || !res.json) {
    throw new Error(`Falha na consulta à Distribuição de DF-e: HTTP ${res.status} — ${res.text.slice(0, 500)}`);
  }

  const statusProcessamento = res.json.StatusProcessamento as DistribuicaoLoteResult['statusProcessamento'];
  const lote = (res.json.LoteDFe as Array<Record<string, unknown>> | null) ?? [];
  const erros = ((res.json.Erros as Array<Record<string, unknown>> | null) ?? []).map((e) =>
    [e.Codigo, e.Descricao, e.Complemento].filter(Boolean).join(' - '),
  );

  const notas: NfseDistribuicaoDoc[] = [];
  const eventos: DfeEventoDoc[] = [];
  let maxNsu = ultNsu;

  for (const item of lote) {
    const nsu = Number(item.NSU);
    if (nsu > maxNsu) maxNsu = nsu;
    const chaveAcesso = String(item.ChaveAcesso ?? '');
    const tipoDocumento = item.TipoDocumento as DfeTipoDocumento;
    const arquivoXmlB64 = item.ArquivoXml as string | undefined;

    if (tipoDocumento === 'EVENTO') {
      eventos.push({
        nsu,
        chaveAcesso,
        tipoEvento: String(item.TipoEvento ?? ''),
        dataHoraGeracao: item.DataHoraGeracao as string | undefined,
      });
      continue;
    }

    if (tipoDocumento === 'NFSE' && arquivoXmlB64) {
      try {
        const xml = zlib.gunzipSync(Buffer.from(arquivoXmlB64, 'base64')).toString('utf8');
        const parsed = parseNfseXml(xml, cnpjConsulta);
        notas.push({ nsu, chaveAcesso, ...parsed });
      } catch {
        // XML ilegível/formato inesperado — não derruba o lote inteiro por uma nota.
        notas.push({ nsu, chaveAcesso, direction: null });
      }
    }
  }

  return { statusProcessamento, ultNsu: maxNsu, notas, eventos, erros };
}

/**
 * O XML inteiro de UMA nota, pelo NSU.
 *
 * A sincronização guarda só os valores, que é o que o faturamento precisa.
 * Para configurar a emissão a partir de uma nota é preciso mais — alíquota,
 * código municipal, regime —, e isso só está no XML. A distribuição devolve
 * o que vem DEPOIS do NSU pedido, então pede-se o anterior e pega-se o item.
 */
export async function fetchXmlDaNotaPorNsu(
  cert: CertMaterial,
  ambiente: 'producao' | 'homologacao',
  cnpjConsulta: string,
  nsu: number,
): Promise<string | null> {
  const agent = buildMtlsAgent(cert);
  const cnpjDigits = cnpjConsulta.replace(/\D/g, '');
  const url = `${BASE_URL[ambiente]}/DFe/${Math.max(nsu - 1, 0)}?cnpjConsulta=${cnpjDigits}&lote=true`;
  const res = await httpsGetJson(agent, url);
  if (res.status !== 200 || !res.json) return null;
  const lote = (res.json.LoteDFe as Array<Record<string, unknown>> | null) ?? [];
  const item = lote.find((i) => Number(i.NSU) === nsu);
  const b64 = item?.ArquivoXml as string | undefined;
  return b64 ? zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8') : null;
}
