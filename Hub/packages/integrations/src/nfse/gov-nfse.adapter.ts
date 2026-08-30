import https from 'node:https';
import zlib from 'node:zlib';
import type { NfsePort, NfseIssueInput, NfseIssueResult } from '@hexxa/core/ports';
import { type CertMaterial, buildMtlsAgent } from './cert';
import { buildDps, type DpsEmitente, type DpsServico } from './dps-builder';
import { buildCancelamentoEvento, inferCancelamentoMotivo } from './evento-builder';
import { signXmlElement } from './xml-sign';

/**
 * Adapter de NFSe do PADRÃO NACIONAL (Emissor Nacional / ADN — gov.br).
 * Fluxo: monta DPS → assina (A1, XMLDSig) → GZip+Base64 → POST mTLS → parse.
 * Implementa a port NfsePort; o domínio não conhece nenhum detalhe disso.
 */

const BASE_URL = {
  producao: 'https://sefin.nfse.gov.br/sefinNacional',
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/sefinNacional',
};

export interface GovNfseConfig {
  emitente: DpsEmitente;
  servico: DpsServico;
  cert: CertMaterial;
  serie: string;
  nextNumber: number;
  baseUrl?: string;
}

const gzipB64 = (xml: string) => zlib.gzipSync(Buffer.from(xml, 'utf8')).toString('base64');

interface HttpResult {
  status: number;
  json: Record<string, unknown> | undefined;
  text: string;
}

function httpsJson(
  agent: https.Agent,
  method: string,
  url: string,
  body?: unknown,
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        agent,
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || 443,
        headers: {
          Accept: 'application/json',
          ...(data
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            : {}),
        },
      },
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
    if (data) req.write(data);
    req.end();
  });
}

export class GovNfseAdapter implements NfsePort {
  constructor(private readonly config: GovNfseConfig) {}

  private base() {
    return this.config.baseUrl ?? BASE_URL[this.config.emitente.ambiente];
  }

  async issue(input: NfseIssueInput): Promise<NfseIssueResult> {
    const servico: DpsServico = input.serviceOverride ? {
      ...this.config.servico,
      itemListaServico: input.serviceOverride.itemListaServico,
      codigoTributacaoMunicipio: input.serviceOverride.codigoTributacaoMunicipio ?? this.config.servico.codigoTributacaoMunicipio,
      aliquotaIss: input.serviceOverride.aliquotaIss ?? this.config.servico.aliquotaIss,
    } : this.config.servico;

    const { xml, refId } = buildDps(
      { emitente: this.config.emitente, servico, serie: this.config.serie, numero: this.config.nextNumber },
      input,
    );
    const signed = signXmlElement(xml, refId, this.config.cert.keyPem, this.config.cert.certPem, 'infDPS');
    const dpsXmlGZipB64 = gzipB64(signed);

    const agent = buildMtlsAgent(this.config.cert);
    const res = await httpsJson(agent, 'POST', `${this.base()}/nfse`, { dpsXmlGZipB64 });

    if (res.status === 200 || res.status === 201) {
      const chave =
        (res.json?.chaveAcesso as string) ??
        ((res.json?.nfse as Record<string, unknown>)?.chaveAcesso as string) ??
        refId;
      return {
        providerProtocol: chave,
        nfseNumber: chave,
        status: 'ISSUED',
      };
    }
    if (res.status === 202) {
      return { providerProtocol: (res.json?.protocolo as string) ?? refId, status: 'ISSUING' };
    }
    return { providerProtocol: refId, status: 'ERROR', errorMessage: this.extractError(res) };
  }

  async getStatus(providerProtocol: string): Promise<NfseIssueResult> {
    const agent = buildMtlsAgent(this.config.cert);
    const res = await httpsJson(agent, 'GET', `${this.base()}/nfse/${providerProtocol}`);
    if (res.status === 200) {
      return {
        providerProtocol,
        status: 'ISSUED',
        nfseNumber: (res.json?.numero as string) ?? providerProtocol,
      };
    }
    if (res.status === 404 || res.status === 202) {
      return { providerProtocol, status: 'ISSUING' };
    }
    return { providerProtocol, status: 'ERROR', errorMessage: this.extractError(res) };
  }

  async download(providerProtocol: string, type: 'xml' | 'pdf'): Promise<Buffer> {
    if (type === 'pdf') {
      // O Emissor Nacional não disponibiliza mais PDF via API pra terceiros
      // (só pelo site do governo). O PDF do DANFSe é gerado localmente a
      // partir do XML — ver apps/web/src/lib/server/danfse-pdf.tsx.
      throw new Error(
        'Download de PDF direto do governo não é mais suportado. Baixe o XML e gere o DANFSe localmente.',
      );
    }
    const agent = buildMtlsAgent(this.config.cert);
    // XML download
    const res = await httpsJson(agent, 'GET', `${this.base()}/nfse/${providerProtocol}`);
    if (res.status !== 200 || !res.json) {
      throw new Error(`Failed to get NFSe for XML download: HTTP ${res.status}`);
    }
    const b64 = (res.json.nfseXmlGZipB64 as string) ?? (res.json.xml as string);
    if (!b64) {
      throw new Error('XML not found in API response');
    }
    try {
      return zlib.gunzipSync(Buffer.from(b64, 'base64'));
    } catch {
      // maybe it's just raw xml or not gzipped?
      return Buffer.from(b64, 'base64'); // Actually if it's plain text xml in base64
    }
  }

  async cancel(providerProtocol: string, reason: string): Promise<void> {
    // Cancelamento = Pedido de Registro de Evento e101101, um DF-e assinado
    // (XMLDSig) próprio, GZip+Base64, postado em POST /nfse/{chave}/eventos
    // com o corpo { pedidoRegistroEventoXmlGZipB64 }. Conforme Manual de
    // Integração NFS-e Padrão Nacional v1.01 (seção 10.4 "Eventos") e o Guia
    // de API do Sistema Nacional NFS-e v1.2. Se o portal rejeitar,
    // PROPAGAMOS o erro para que a nota não seja marcada como cancelada
    // localmente sem estar cancelada no governo.
    const { xml, refId } = buildCancelamentoEvento({
      ambiente: this.config.emitente.ambiente,
      chaveAcesso: providerProtocol,
      cnpjAutor: this.config.emitente.cnpj,
      motivo: inferCancelamentoMotivo(reason),
      justificativa: reason,
    });
    const signed = signXmlElement(xml, refId, this.config.cert.keyPem, this.config.cert.certPem, 'infPedReg');
    const pedidoRegistroEventoXmlGZipB64 = gzipB64(signed);

    const agent = buildMtlsAgent(this.config.cert);
    const res = await httpsJson(agent, 'POST', `${this.base()}/nfse/${providerProtocol}/eventos`, {
      pedidoRegistroEventoXmlGZipB64,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Cancelamento rejeitado pelo Emissor Nacional: ${this.extractError(res)}`);
    }
  }

  private extractError(res: HttpResult): string {
    const erros = res.json?.erros;
    if (Array.isArray(erros) && erros.length) {
      return erros
        .map((e) => {
          if (typeof e === 'string') return e;
          const obj = e as Record<string, unknown>;
          return [obj.Codigo, obj.Descricao, obj.Complemento].filter(Boolean).join(' - ');
        })
        .filter(Boolean)
        .join('; ');
    }
    // API de Eventos retorna erro singular: { erro: { mensagem, codigo, descricao, complemento } }
    const erro = res.json?.erro as Record<string, unknown> | undefined;
    if (erro && typeof erro === 'object') {
      return [erro.codigo, erro.mensagem ?? erro.descricao, erro.complemento].filter(Boolean).join(' - ');
    }
    // Debug info: dump the entire payload
    return (res.json?.mensagem as string) ?? `HTTP ${res.status}: ${JSON.stringify(res.json) || res.text}`;
  }
}
