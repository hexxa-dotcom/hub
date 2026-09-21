/**
 * LER A ÚLTIMA NOTA PARA CONFIGURAR A PRÓXIMA.
 *
 * ── Por que isto vale mais que um formulário ───────────────────────────
 *
 * O que o passo fiscal pede — item da LC 116, alíquota de ISS, código de
 * tributação do município — é exatamente o que já está dentro de qualquer
 * nota que a empresa emitiu. Pedir para a pessoa digitar é pedir que ela
 * procure numa nota antiga e copie à mão, com chance de errar um dígito que
 * vira imposto errado em todas as notas seguintes.
 *
 * ── Por que só XML, e não PDF ──────────────────────────────────────────
 *
 * O XML do Padrão Nacional tem estrutura única e definida em schema: ler é
 * determinístico. O PDF é desenho, e cada prefeitura faz o seu — lê-lo seria
 * adivinhar, e adivinhar dado fiscal é pior que perguntar.
 *
 * Leitura tolerante de propósito: a nota já foi aceita pelo governo, não
 * cabe a nós validá-la de novo. O que não vier fica `null` e o formulário
 * pergunta só isso.
 */

export interface ConfigDaNfse {
  /** CNPJ do prestador, só dígitos — para conferir se a nota é da empresa. */
  prestadorCnpj: string | null;
  /** Código IBGE do município de emissão. */
  codigoMunicipio: string | null;
  /** Item da LC 116 no formato "17.19". */
  itemListaServico: string | null;
  /** Código de tributação do município, quando a nota trouxe. */
  codigoTributacaoMunicipio: string | null;
  /** Alíquota de ISS em pontos percentuais (2.5 = 2,5%). */
  aliquotaIss: number | null;
  /** 1 = não optante, 2 = MEI, 3 = ME/EPP do Simples. */
  opSimpNac: string | null;
  regimeEspecial: string | null;
  /** Descrição do serviço — serve de sugestão na primeira emissão. */
  descricaoServico: string | null;
  numeroNota: string | null;
}

/** Primeiro valor de uma tag, sem depender de namespace nem de DOM. */
function tag(xml: string, nome: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${nome}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nome}>`).exec(xml);
  const v = m?.[1]?.trim();
  return v ? v : null;
}

/**
 * Desfaz o cTribNac de 6 dígitos de volta ao item da LC 116.
 *
 * Inverso de `lcItemToCTribNac`. "171900" vira "17.19": o grupo perde o zero
 * à esquerda porque é assim que a lista é citada ("1.07", não "01.07"), e a
 * variação final some quando é genérica ("00"), que é o caso comum.
 */
export function cTribNacParaItemLC116(cTribNac: string | null): string | null {
  if (!cTribNac) return null;
  const d = cTribNac.replace(/\D/g, '').padStart(6, '0');
  if (d === '000000') return null;
  const grupo = String(Number(d.slice(0, 2)));
  const sub = d.slice(2, 4);
  const variacao = d.slice(4, 6);
  return variacao === '00' ? `${grupo}.${sub}` : `${grupo}.${sub}.${variacao}`;
}

export function lerConfigDaNfse(xml: string): ConfigDaNfse {
  // O <prest> está dentro do DPS; recortar evita confundir o CNPJ do
  // prestador com o do tomador, que usa a mesma tag <CNPJ>.
  const trecho = (nome: string): string => {
    const m = new RegExp(`<(?:\\w+:)?${nome}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nome}>`).exec(xml);
    return m?.[1] ?? '';
  };

  const prest = trecho('prest');
  const cServ = trecho('cServ');
  const tribMun = trecho('tribMun');
  const regTrib = trecho('regTrib');

  const aliq = tag(tribMun, 'pAliq');
  const aliquota = aliq === null ? null : Number(aliq.replace(',', '.'));

  return {
    prestadorCnpj: (tag(prest, 'CNPJ') ?? '').replace(/\D/g, '') || null,
    // cLocPrestacao é onde o serviço acontece; cLocEmi, de onde saiu. Para
    // configurar a emissão, o que vale é o de emissão.
    codigoMunicipio: tag(xml, 'cLocEmi') ?? tag(xml, 'cLocPrestacao'),
    itemListaServico: cTribNacParaItemLC116(tag(cServ, 'cTribNac')),
    codigoTributacaoMunicipio: tag(cServ, 'cTribMun'),
    aliquotaIss: aliquota !== null && Number.isFinite(aliquota) ? aliquota : null,
    opSimpNac: tag(regTrib, 'opSimpNac'),
    regimeEspecial: tag(regTrib, 'regEspTrib'),
    descricaoServico: tag(cServ, 'xDescServ'),
    numeroNota: tag(xml, 'nNFSe'),
  };
}
