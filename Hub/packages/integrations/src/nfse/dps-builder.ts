import type { NfseIssueInput } from '@hexxa/core/ports';
import { normalizeDocument, documentKind } from '@hexxa/core/document-br';

/**
 * Montagem do XML da DPS (Declaração de Prestação de Serviço) — layout v1.01
 * do Padrão Nacional da NFS-e (Emissor Nacional / gov.br).
 */

export interface DpsEmitente {
  ambiente: 'homologacao' | 'producao';
  cnpj: string;
  inscricaoMunicipal?: string; // IM não é exigida pelo portal nacional
  codigoMunicipio: string;     // IBGE 7 dígitos
  optanteSimples: boolean;
  regimeApuracao?: string;     // 1=Não optante, 2=MEI, 3=ME/EPP
  regimeEspecial?: string;     // regEspTrib 0–6; default "0"
  /**
   * Leiaute da reforma (IBS/CBS). Desligado, a DPS sai como sempre.
   * - 'NT009': leiaute RTC v1.04 (NT 009/2026) — finNFSe no corpo da DPS,
   *   cNBS/cAtvSN antes da descrição, regApIBSCBSSN no regime.
   * - 'V101': esquema XSD RTC v1.01 (NT 004) — finNFSe dentro do IBSCBS,
   *   cNBS depois da descrição.
   * Teste em Produção Restrita (27/09/2026): V101 passou no esquema; NT009
   * foi recusado (E1235, finNFSe fora do lugar). Use V101.
   */
  leiauteIbsCbs?: 'NT009' | 'V101';
  /** Simples: 1 = IBS e CBS pelo SN; 2 = só a CBS pelo SN; 3 = os dois pelo regime regular. */
  regApIBSCBSSN?: '1' | '2' | '3';
  /** Código da atividade no Simples (cAtvSN): 7 Anexo III, 9 Fator R, 14 Anexo IV… */
  cAtvSN?: string;
  fone?: string;               // Telefone do prestador (opcional no DPS)
  email?: string;              // E-mail do prestador (opcional no DPS)
}

export interface DpsServico {
  itemListaServico: string;        // LC 116/2003 ex: "17.19" — usado para derivar cTribNac
  cTribNac?: string;               // Código tributação nacional 6 dígitos ex: "171900"; derivado se omitido
  aliquotaIss?: number;            // % (não vai mais na DPS — calculado pelo município)
  codigoTributacaoMunicipio?: string; // cTribMun (opcional)
}

export interface DpsParams {
  emitente: DpsEmitente;
  servico: DpsServico;
  serie: string;
  numero: number;
}

const onlyDigits = (s: string) => (s ?? '').replace(/\D/g, '');

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** dhEmi no fuso de Brasília (-03:00). */
function nowBrasilia(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Subtrai 3h para obter horário de Brasília
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return (
    `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}` +
    `T${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}:${pad(brt.getUTCSeconds())}-03:00`
  );
}

/** Data de hoje em Brasília (YYYY-MM-DD) — usada como dCompet. */
function todayBrasilia(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}`;
}

/**
 * Converte o código LC 116/2003 ("17.19", "1.01", "16.02") para o cTribNac
 * de 6 dígitos usado no DPS ("171900", "010100", "160200").
 * A variação final ("00") é genérica; o usuário pode sobrescrever via cTribNac.
 */
function lcItemToCTribNac(item: string | null | undefined): string {
  if (!item) return '000000';
  const parts = item.split('.');
  const group = (parts[0] ?? '0').padStart(2, '0');
  const sub = (parts[1] ?? '00').padStart(2, '0');
  const subclass = (parts[2] ?? '00').padStart(2, '0');
  return `${group}${sub}${subclass}`;
}

export interface BuiltDps {
  xml: string;
  refId: string;
  numero: number;
}

/** Constrói o XML da DPS (sem assinatura). */
export function buildDps(params: DpsParams, input: NfseIssueInput): BuiltDps {
  const { emitente: e, servico: s } = params;
  const tpAmb = e.ambiente === 'producao' ? '1' : '2';
  /*
   * Tributos aproximados (Lei 12.741). O municipal é o ISS; o federal é o
   * resto da carga total — que, no Simples, é a alíquota efetiva do DAS.
   * Antes o federal era 6% fixo, igual para toda empresa. Sem a carga total
   * informada, mantém o valor antigo para não mudar notas já em uso.
   */
  const totTribMun = input.amount * (Number(s.aliquotaIss ?? 0) / 100);

  // opSimpNac: 1 = Não optante, 2 = MEI, 3 = ME/EPP. Optante sem o tipo
  // informado é ME/EPP — o MEI tem de estar marcado (antes o padrão era 2).
  const opSimpNac = e.regimeApuracao || (e.optanteSimples ? '3' : '1');
  const simples = opSimpNac !== '1';

  // Reforma tributária: o grupo IBS/CBS, no leiaute escolhido.
  const nt009 = e.leiauteIbsCbs === 'NT009';
  const v101 = e.leiauteIbsCbs === 'V101';
  const ibs = e.leiauteIbsCbs ? input.ibsCbs : undefined;
  const ibsCbsXml = ibs
    ? `<IBSCBS>` +
      (v101 ? `<finNFSe>0</finNFSe>` : '') +
      (ibs.consumoFinal ? `<indFinal>1</indFinal>` : '') +
      `<cIndOp>${onlyDigits(ibs.cIndOp)}</cIndOp>` +
      // 0 = o destinatário é o próprio tomador.
      `<indDest>0</indDest>` +
      `<valores><trib><gIBSCBS>` +
      `<CST>${onlyDigits(ibs.cst)}</CST>` +
      `<cClassTrib>${onlyDigits(ibs.cClassTrib)}</cClassTrib>` +
      `</gIBSCBS></trib></valores>` +
      `</IBSCBS>`
    : '';
  const totTribFed =
    input.aliquotaTributosTotal != null
      ? Math.max(0, input.amount * (input.aliquotaTributosTotal / 100) - totTribMun)
      : input.amount * 0.06;
  // Se competenciaDate for enviada (YYYY-MM-DD), usa ela. Se não, tenta referenceMonth (YYYY-MM) -> se tiver len 7, anexa -01.
  const dCompet = input.competenciaDate 
    ? input.competenciaDate 
    : (input.referenceMonth && input.referenceMonth.length === 7 ? `${input.referenceMonth}-01` : todayBrasilia());
  // normalizeDocument PRESERVA letras — CNPJ alfanumérico (obrigatório pra
  // novos CNPJs a partir de jul/2026) tem os 12 primeiros caracteres
  // podendo ser letra OU dígito; um onlyDigits ingênuo destruiria o valor.
  const cnpjPrest = normalizeDocument(e.cnpj);
  const doc = normalizeDocument(input.customer.document);
  const tomaTag = documentKind(doc);

  // Id do infDPS conforme NT: DPS + cMun(7) + tpInsc(1) + nInsc(14) + serie(5) + nDPS(15)
  const refId =
    'DPS' +
    e.codigoMunicipio.padStart(7, '0') +
    '2' +
    cnpjPrest.padStart(14, '0') +
    params.serie.padStart(5, '0') +
    String(params.numero).padStart(15, '0');

  // cTribNac: usa override ou deriva do item LC116
  const cTribNac = s.cTribNac ?? lcItemToCTribNac(s.itemListaServico);
  // tpRetISSQN, conforme Manual de Integração NFS-e Padrão Nacional v1.01
  // (campo B-132): 1 = Não Retido; 2 = Retido pelo Tomador; 3 = Retido pelo
  // Intermediário. Confirmado contra o manual oficial em 2026-08-22 — havia
  // um comentário divergente e incorreto no campo (já removido) dizendo o
  // contrário; o valor abaixo está correto e bate com o manual.
  const tpRetISSQN = input.retainIss ? '2' : '1';

  const addr = input.customer.address;
  const addressXml = addr
    ? `<end>` +
      `<endNac><cMun>${escapeXml(addr.cMun)}</cMun><CEP>${escapeXml(addr.cep)}</CEP></endNac>` +
      `<xLgr>${escapeXml(addr.logradouro)}</xLgr>` +
      `<nro>${escapeXml(addr.numero)}</nro>` +
      (addr.complemento ? `<xCpl>${escapeXml(addr.complemento)}</xCpl>` : '') +
      `<xBairro>${escapeXml(addr.bairro)}</xBairro>` +
      `</end>`
    : '';

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
    `<infDPS Id="${refId}">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<dhEmi>${nowBrasilia()}</dhEmi>` +
    `<verAplic>hexx-hub-digital-1.0</verAplic>` +
    `<serie>${escapeXml(params.serie)}</serie>` +
    `<nDPS>${params.numero}</nDPS>` +
    `<dCompet>${dCompet}</dCompet>` +
    `<tpEmit>1</tpEmit>` +
    (nt009 ? `<finNFSe>0</finNFSe>` : '') +
    `<cLocEmi>${e.codigoMunicipio}</cLocEmi>` +
    `<prest>` +
    `<CNPJ>${cnpjPrest}</CNPJ>` +
    (e.fone ? `<fone>${escapeXml(onlyDigits(e.fone))}</fone>` : '') +
    (e.email ? `<email>${escapeXml(e.email)}</email>` : '') +
    `<regTrib>` +
    // opSimpNac (Padrão Nacional): 1=Não Optante, 2=Optante MEI, 3=Optante ME/EPP
    `<opSimpNac>${opSimpNac}</opSimpNac>` +
    // regApTribSN: 1 = apuração dos tributos pelo SN (padrão para ME/EPP)
    (opSimpNac === '3' ? `<regApTribSN>1</regApTribSN>` : '') +
    (nt009 && simples && e.regApIBSCBSSN ? `<regApIBSCBSSN>${e.regApIBSCBSSN}</regApIBSCBSSN>` : '') +
    `<regEspTrib>${e.regimeEspecial ?? '0'}</regEspTrib>` +
    `</regTrib>` +
    `</prest>` +
    `<toma>` +
    `<${tomaTag}>${doc}</${tomaTag}>` +
    `<xNome>${escapeXml(input.customer.name)}</xNome>` +
    addressXml +
    (input.customer.email ? `<email>${escapeXml(input.customer.email)}</email>` : '') +
    `</toma>` +
    `<serv>` +
    `<locPrest><cLocPrestacao>${e.codigoMunicipio}</cLocPrestacao></locPrest>` +
    `<cServ>` +
    `<cTribNac>${escapeXml(cTribNac)}</cTribNac>` +
    (s.codigoTributacaoMunicipio
      ? `<cTribMun>${escapeXml(s.codigoTributacaoMunicipio)}</cTribMun>`
      : '') +
    (nt009 && ibs?.nbs ? `<cNBS>${onlyDigits(ibs.nbs)}</cNBS>` : '') +
    (nt009 && simples && e.cAtvSN ? `<cAtvSN>${escapeXml(e.cAtvSN)}</cAtvSN>` : '') +
    `<xDescServ>${escapeXml(input.serviceDescription)}</xDescServ>` +
    (v101 && ibs?.nbs ? `<cNBS>${onlyDigits(ibs.nbs)}</cNBS>` : '') +
    `</cServ>` +
    `</serv>` +
    `<valores>` +
    `<vServPrest><vServ>${input.amount.toFixed(2)}</vServ></vServPrest>` +
    `<trib>` +
    `<tribMun>` +
    `<tribISSQN>1</tribISSQN>` +
    `<tpRetISSQN>${tpRetISSQN}</tpRetISSQN>` +
    // pAliq: para ME/EPP SN sem retenção, NÃO informar (E0625)
    (s.aliquotaIss && (input.retainIss || opSimpNac !== '3') ? `<pAliq>${Number(s.aliquotaIss).toFixed(2)}</pAliq>` : '') +
    `</tribMun>` +
    // totTrib: valores aproximados dos tributos (modelo do XML autorizado)
    `<totTrib>` +
    `<vTotTrib>` +
    `<vTotTribFed>${totTribFed.toFixed(2)}</vTotTribFed>` +
    `<vTotTribEst>0.00</vTotTribEst>` +
    `<vTotTribMun>${totTribMun.toFixed(2)}</vTotTribMun>` +
    `</vTotTrib>` +
    `</totTrib>` +
    `</trib>` +
    `</valores>` +
    ibsCbsXml +
    `</infDPS>` +
    `</DPS>`;

  return { xml, refId, numero: params.numero };
}
