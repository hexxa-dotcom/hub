import 'server-only';
import { XMLParser } from 'fast-xml-parser';
import type { DanfseEndereco, RegimeTributario } from '../danfse-shared';

export type { DanfseEndereco, RegimeTributario } from '../danfse-shared';

/**
 * Layout próprio do DANFSe (documento auxiliar da NFS-e).
 *
 * O Emissor Nacional (gov.br) não expõe mais um endpoint de PDF utilizável
 * por terceiros — a visualização "oficial" só existe no próprio site do
 * governo. O documento fiscal de verdade é o XML (retornado por
 * NfsePort.download(protocolo, 'xml')); a partir dele montamos nosso
 * próprio layout, tanto em HTML (tela) quanto em PDF (download/e-mail).
 * Esta função é a ÚNICA fonte de verdade de como os campos são extraídos
 * do XML do Padrão Nacional — tanto a tela quanto o PDF usam o mesmo
 * resultado, pra nunca divergir.
 *
 * Mapeamento validado contra um DANFSe real (Sefin Nacional, produção,
 * emissor Nota Gateway) — não só contra o manual. Pontos que o manual
 * sozinho não deixava óbvio:
 * - <infNFSe> (nota autorizada) e <infDPS> (pedido) têm campos DIFERENTES
 *   pro "mesmo" dado — ex.: <infNFSe> não tem valores.vServPrest, só
 *   <infDPS> tem; e vice-versa <infDPS> não tem valores.vLiq final.
 * - Endereço do PRESTADOR (<emit><enderNac>) é uma estrutura mais achatada
 *   que a do TOMADOR (<toma><end><endNac>+irmãos) — não são o mesmo shape.
 * - Nome do município só existe como texto (<xLocEmi>) em nota já
 *   autorizada; DPS-only (ainda processando) só tem o código IBGE.
 * - MEI/SN sem apuração de ISS por nota podem trazer <totTrib><pTotTribSN>
 *   (% agregado) em vez de <vTotTrib> (valores absolutos por esfera).
 */
export interface DanfseData {
  /** true = ambiente de HOMOLOGAÇÃO (teste) — precisa ficar bem visível, nunca passar por nota de produção real. */
  homologacao: boolean;
  chaveAcesso: string;
  numero: string;
  dataEmissao: string;
  competencia: string;
  /** Código de tributação nacional (LC 116) formatado "NN.NN.NN", ex: "16.02.01". */
  codigoTributacaoNacional: string;
  /** Descrição oficial do código de tributação nacional (dada pelo governo, não pelo usuário). */
  descricaoTributacaoNacional: string;
  localPrestacao: string;
  prestador: {
    documento: string;
    nome: string;
    municipio: string;
    regime: RegimeTributario;
    endereco: DanfseEndereco | null;
  };
  tomador: {
    documento: string;
    nome: string;
    email: string;
    telefone: string;
    endereco: DanfseEndereco | null;
  };
  descricaoServico: string;
  /** true = ISS retido pelo tomador (tpRetISSQN=2), não recolhido pelo prestador. */
  issRetido: boolean;
  valores: {
    valorServico: number;
    baseCalculo: number;
    aliquotaIss: number;
    valorIss: number;
    valorLiquido: number;
    /** Valor aproximado dos tributos (Lei da Transparência Fiscal 12.741/2012). */
    tributosAproximados: number;
  };
  /**
   * Reforma tributária (LC 214/2025) — IBS/CBS. Campo sempre presente (como
   * no DANFSe oficial, que mostra a seção mesmo com tudo "-"): em 2026 a
   * cobrança de IBS/CBS ainda está em fase de teste, então a maioria das
   * notas vem com CST/cClassTrib preenchidos mas os valores monetários
   * zerados — isso é o comportamento oficial esperado, não um bug do
   * parser. Fonte: Manual de Integração v1.01 (grupo IBSCBS, seção A-43 a
   * A-88) — vTotNF = vLiq até 2026; = vLiq + vCBS + vIBSTot a partir de 2027.
   */
  ibsCbs: {
    cst: string;
    classTrib: string;
    indicadorOperacao: string;
    localIncidencia: string;
    aliquotaIbsUf: number;
    aliquotaEfetivaIbsUf: number;
    valorIbsUf: number;
    aliquotaIbsMun: number;
    aliquotaEfetivaIbsMun: number;
    valorIbsMun: number;
    valorIbsTotal: number;
    aliquotaCbs: number;
    aliquotaEfetivaCbs: number;
    valorCbs: number;
  };
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v !== undefined && v !== null && v !== '' ? String(v) : '';
}

/**
 * dCompet vem como data pura "YYYY-MM-DD" (sem horário) — new Date(str)
 * interpreta isso como meia-noite UTC, e toLocaleDateString('pt-BR') então
 * converte pro fuso local (Brasília, UTC-3), voltando um dia. Formata a
 * partir dos componentes da string, sem passar por conversão de fuso.
 */
function toDateBr(v: unknown): string {
  if (!v || typeof v !== 'string') return 'N/A';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 'N/A';
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function toDateTimeBr(v: unknown): string {
  if (!v || typeof v !== 'string') return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('pt-BR');
}

/** "160201" -> "16.02.01". Deixa como veio se não tiver 6 dígitos. */
function formatCTribNac(v: unknown): string {
  const s = str(v);
  return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4, 6)}` : s;
}

/**
 * Os 2 primeiros dígitos do código IBGE de 7 dígitos identificam a UF —
 * tabela fixa do IBGE, nunca muda. Usada pra derivar a UF do LOCAL DA
 * PRESTAÇÃO e do LOCAL DE INCIDÊNCIA (IBS/CBS), que podem legitimamente
 * ser em outro estado além do da sede do prestador (serviço interestadual;
 * o IBS/CBS é tributado no destino). Emprestar a UF do prestador pra esses
 * dois campos — como este arquivo fazia antes — mostra a UF errada em
 * qualquer nota interestadual.
 */
const UF_POR_PREFIXO_IBGE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};
function ufDoCodigoIbge(codigoMunicipio: string): string {
  return UF_POR_PREFIXO_IBGE[codigoMunicipio.slice(0, 2)] ?? '';
}

/** opSimpNac: 1=Não Optante, 2=Optante MEI, 3=Optante ME/EPP (Manual v1.01, campo B-... regTrib). */
function toRegime(opSimpNac: unknown): RegimeTributario {
  const v = str(opSimpNac);
  if (v === '2') return 'MEI';
  if (v === '3') return 'SIMPLES_NACIONAL';
  return 'NAO_OPTANTE';
}

function parseEnderecoNacional(raw: unknown): DanfseEndereco | null {
  const e = raw as Record<string, unknown> | undefined;
  if (!e) return null;
  return {
    logradouro: str(e.xLgr),
    numero: str(e.nro),
    complemento: str(e.xCpl),
    bairro: str(e.xBairro),
    cep: str((e as any).CEP ?? (e as any).endNac?.CEP),
  };
}

/** Faz o parse do XML da NFS-e/DPS (Padrão Nacional) num formato estável pra UI e PDF. */
export function parseNfseXml(xmlString: string, chaveAcesso: string): DanfseData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    // Documento fiscal: CEP, CNPJ, códigos de município etc. têm zeros à
    // esquerda que fazem parte do valor — o parser converteria "01310100"
    // pro número 1310100 por padrão (parseTagValue:true), perdendo o zero.
    parseTagValue: false,
  });
  const jsonObj = parser.parse(xmlString);

  // O XML pode vir como <NFSe> (autorizada, com <infNFSe> envolvendo a
  // <DPS>) ou só <DPS> (pedido, antes da nota existir). Os dois trazem
  // campos que o outro NÃO tem — nunca escolher um objeto "valores"
  // inteiro de um dos dois, e sim combinar campo a campo.
  const rootNfse = jsonObj?.NFSe?.infNFSe || jsonObj?.infNFSe || {};
  const rootDps = rootNfse.DPS?.infDPS || jsonObj?.DPS?.infDPS || jsonObj?.infDPS || {};

  const emit = rootNfse.emit || {};
  const prest = rootDps.prest || emit || {};
  const toma = rootDps.toma || {};
  const serv = rootDps.serv || {};

  const valoresNfse = rootNfse.valores || {}; // vISSQN, vTotalRet, vLiq (finais, pós-processamento)
  const valoresDps = rootDps.valores || {}; // vServPrest.vServ, trib.* (o que foi pedido)
  const trib = valoresDps?.trib || {};
  const tribMun = trib?.tribMun || {};
  const vTotTrib = trib?.totTrib?.vTotTrib;
  const pTotTribSN = trib?.totTrib?.pTotTribSN;

  const valorServico = toNumber(valoresDps?.vServPrest?.vServ ?? valoresNfse?.vLiq);
  const valorLiquido = toNumber(valoresNfse?.vLiq ?? valoresDps?.vServPrest?.vServ);

  let tributosAproximados = toNumber(vTotTrib?.vTotTribFed) + toNumber(vTotTrib?.vTotTribEst) + toNumber(vTotTrib?.vTotTribMun);
  if (tributosAproximados === 0 && pTotTribSN !== undefined) {
    // Nota de optante do Simples Nacional: só vem o percentual agregado, não o valor por esfera.
    tributosAproximados = (valorServico * toNumber(pTotTribSN)) / 100;
  }

  // Nome do município só existe (texto) numa nota JÁ autorizada; DPS-only só tem o código IBGE.
  const municipioNome = str(rootNfse?.xLocEmi);
  const municipioUf = str(emit?.enderNac?.UF);
  const municipio = municipioNome
    ? [municipioNome, municipioUf].filter(Boolean).join(' / ')
    : str(rootNfse?.cLocEmi ?? rootDps?.cLocEmi) || 'N/A';

  const localPrestCodigo = str(serv?.locPrest?.cLocPrestacao);
  const localPrestNome = str(rootNfse?.xLocPrestacao);
  const localPrestUf = ufDoCodigoIbge(localPrestCodigo);
  const localPrestacao = localPrestNome
    ? [localPrestNome, localPrestUf].filter(Boolean).join(' / ')
    : localPrestCodigo || 'N/A';

  // tpAmb: 1=produção, 2=homologação — só existe dentro da infDPS.
  const tpAmb = str(rootDps?.tpAmb) || '1';

  // IBS/CBS (reforma tributária): CST/cClassTrib são DECLARADOS pelo
  // emitente (infDPS.IBSCBS); os valores calculados/oficiais vêm no bloco
  // gerado pelo sistema (infNFSe.IBSCBS) — dois lugares diferentes no XML.
  const dpsIbsCbs = rootDps?.IBSCBS || {};
  const dpsIbsCbsGrupo = dpsIbsCbs?.valores?.trib?.gIBSCBS || {};
  const nfseIbsCbs = rootNfse?.IBSCBS || {};
  const ibsUf = nfseIbsCbs?.valores?.uf || {};
  const ibsMun = nfseIbsCbs?.valores?.mun || {};
  const ibsFed = nfseIbsCbs?.valores?.fed || {};
  const totCIBS = nfseIbsCbs?.totCIBS || {};
  const localIncidCodigo = str(nfseIbsCbs?.cLocalidadeIncid);
  const localIncidNome = str(nfseIbsCbs?.xLocalidadeIncid);
  const localIncidUf = ufDoCodigoIbge(localIncidCodigo);
  const localIncid = localIncidNome
    ? [localIncidNome, localIncidUf].filter(Boolean).join(' / ')
    : localIncidCodigo;

  return {
    homologacao: tpAmb === '2',
    chaveAcesso,
    numero: str(rootNfse?.nNFSe ?? rootDps?.nDPS) || 'S/N',
    // dhProc = data/hora em que a NFS-e foi processada/autorizada (o que o
    // DANFSe oficial chama de "Data e Hora da Emissão da NFS-e"); dhEmi é
    // só da DPS (o pedido), existe mesmo antes de autorizar.
    dataEmissao: toDateTimeBr(rootNfse?.dhProc || rootDps?.dhEmi),
    competencia: toDateBr(rootDps.dCompet),
    codigoTributacaoNacional: formatCTribNac(serv?.cServ?.cTribNac),
    descricaoTributacaoNacional: str(rootNfse?.xTribNac),
    localPrestacao,
    prestador: {
      documento: str(prest?.CNPJ ?? prest?.CPF) || 'N/A',
      nome: str(emit?.xNome ?? prest?.xNome) || 'N/A',
      municipio,
      regime: toRegime(prest?.regTrib?.opSimpNac),
      endereco: parseEnderecoNacional(emit?.enderNac),
    },
    tomador: {
      documento: str(toma?.CNPJ ?? toma?.CPF) || 'N/A',
      nome: str(toma?.xNome) || 'N/A',
      email: str(toma?.email) || 'N/A',
      telefone: str(toma?.fone) || 'N/A',
      endereco: toma?.end
        ? {
            logradouro: str(toma.end?.xLgr),
            numero: str(toma.end?.nro),
            complemento: str(toma.end?.xCpl),
            bairro: str(toma.end?.xBairro),
            cep: str(toma.end?.endNac?.CEP),
          }
        : null,
    },
    descricaoServico: str(serv?.cServ?.xDescServ) || 'Nenhum serviço discriminado.',
    issRetido: str(tribMun?.tpRetISSQN) === '2',
    valores: {
      valorServico,
      baseCalculo: toNumber(valoresNfse?.vBC ?? valoresDps?.vBC ?? valorServico),
      aliquotaIss: toNumber(valoresNfse?.pAliqAplic ?? tribMun?.pAliq),
      valorIss: toNumber(valoresNfse?.vISSQN ?? tribMun?.vISSQN),
      valorLiquido,
      tributosAproximados,
    },
    ibsCbs: {
      cst: str(dpsIbsCbsGrupo?.CST),
      classTrib: str(dpsIbsCbsGrupo?.cClassTrib),
      indicadorOperacao: str(dpsIbsCbs?.cIndOp),
      localIncidencia: localIncid,
      aliquotaIbsUf: toNumber(ibsUf?.pIBSUF),
      aliquotaEfetivaIbsUf: toNumber(ibsUf?.pAliqEfetUF),
      valorIbsUf: toNumber(totCIBS?.gIBS?.gIBSUFTot?.vIBSUF),
      aliquotaIbsMun: toNumber(ibsMun?.pIBSMun),
      aliquotaEfetivaIbsMun: toNumber(ibsMun?.pAliqEfetMun),
      valorIbsMun: toNumber(totCIBS?.gIBS?.gIBSMunTot?.vIBSMun),
      valorIbsTotal: toNumber(totCIBS?.gIBS?.vIBSTot),
      aliquotaCbs: toNumber(ibsFed?.pCBS),
      aliquotaEfetivaCbs: toNumber(ibsFed?.pAliqEfetCBS),
      valorCbs: toNumber(totCIBS?.gCBS?.vCBS),
    },
  };
}
