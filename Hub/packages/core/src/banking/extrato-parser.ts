/**
 * LEITURA DE EXTRATO BANCÁRIO — OFX e CSV.
 *
 * É a ponte até o Open Finance. Enquanto ele não existe, o extrato é o único
 * jeito de o razão saber o que realmente entrou e saiu da conta — e sem isso
 * a conciliação é um exercício de fé.
 *
 * ── Por que estas funções são puras ─────────────────────────────────────
 *
 * Nada aqui toca banco de dados nem rede. Um extrato mal lido não produz um
 * erro visível: produz um número plausível e errado, que só aparece meses
 * depois quando o saldo não bate. Testar a leitura isoladamente, com arquivos
 * reais de cada banco, é a única forma de confiar nela.
 *
 * ── Sobre o PDF ─────────────────────────────────────────────────────────
 *
 * Não está aqui de propósito. PDF de extrato não tem estrutura: cada banco
 * diagrama do seu jeito, e extrair valor de um layout visual exige um modelo
 * de linguagem, que erra. O OFX, que todo banco brasileiro oferece, traz os
 * mesmos dados de forma exata e sem interpretação. A leitura por IA existe
 * como último recurso, em outro módulo, e sempre com conferência.
 */

export interface LinhaDeExtrato {
  /** AAAA-MM-DD. */
  data: string;
  /** Positivo = entrou na conta; negativo = saiu. */
  valor: number;
  descricao: string;
  /**
   * Identificador do banco para a transação (FITID no OFX).
   *
   * É o que torna a reimportação segura: o mesmo extrato subido duas vezes
   * não duplica. Quando o formato não oferece, `null` — e aí a duplicidade é
   * detectada por data, valor e descrição, que é menos exato.
   */
  idExterno: string | null;
}

export interface ResultadoLeitura {
  linhas: LinhaDeExtrato[];
  /** Conta informada no arquivo, quando ele traz. */
  banco: string | null;
  conta: string | null;
  /** Período coberto, derivado das linhas. */
  de: string | null;
  ate: string | null;
  /** O que não deu para ler — nomeado, nunca descartado em silêncio. */
  ignoradas: { linha: string; motivo: string }[];
}

export class ExtratoIlegivelError extends Error {
  constructor(motivo: string) {
    super(`Não consegui ler este extrato: ${motivo}`);
    this.name = 'ExtratoIlegivelError';
  }
}

/* ── Números e datas no padrão brasileiro ───────────────────────────────── */

/**
 * Converte valor monetário para número.
 *
 * O caso que exige cuidado: `1.234,56` e `1,234.56` são o mesmo valor escrito
 * de dois jeitos, e `1.234` pode ser mil duzentos e trinta e quatro (BR) ou
 * um vírgula dois três quatro (US). A decisão é pelo ÚLTIMO separador: se for
 * vírgula, o formato é brasileiro; se for ponto e houver exatamente dois
 * dígitos depois, é americano.
 */
export function valorBr(texto: string): number | null {
  const limpo = texto
    .replace(/[R$\s ]/g, '')
    .replace(/^\+/, '')
    .trim();
  if (!limpo || !/\d/.test(limpo)) return null;

  // Parênteses e "D" (débito) marcam negativo em alguns bancos.
  const negativo = /^\(.*\)$/.test(limpo) || /[dD]$/.test(limpo) || limpo.startsWith('-');
  const so = limpo.replace(/[()DdCc-]/g, '');

  const ultimaVirgula = so.lastIndexOf(',');
  const ultimoPonto = so.lastIndexOf('.');

  let normalizado: string;
  if (ultimaVirgula > ultimoPonto) {
    normalizado = so.replace(/\./g, '').replace(',', '.');
  } else if (ultimoPonto > ultimaVirgula) {
    normalizado = so.replace(/,/g, '');
  } else {
    normalizado = so;
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  return negativo ? -Math.abs(n) : n;
}

/** Aceita DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD e AAAAMMDD. */
export function dataBr(texto: string): string | null {
  const t = texto.trim();

  let m = /^(\d{2})[/\-.](\d{2})[/\-.](\d{2,4})$/.exec(t);
  if (m) {
    const ano = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${ano}-${m[2]}-${m[1]}`;
  }

  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = /^(\d{4})(\d{2})(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}

/* ── OFX ────────────────────────────────────────────────────────────────── */

/**
 * Lê um arquivo OFX.
 *
 * O OFX é SGML, não XML: as tags podem não ter fechamento. Por isso a leitura
 * é por expressão regular sobre cada bloco `<STMTTRN>`, e não por um parser
 * de XML — que recusaria metade dos arquivos que os bancos brasileiros geram.
 */
export function lerOfx(conteudo: string): ResultadoLeitura {
  const texto = conteudo.replace(/\r/g, '');
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];

  if (blocos.length === 0) {
    throw new ExtratoIlegivelError(
      'nenhuma transação encontrada. O arquivo é mesmo um OFX de extrato?',
    );
  }

  const campo = (bloco: string, tag: string): string | null => {
    const m = new RegExp(`<${tag}>([^<\n]*)`, 'i').exec(bloco);
    return m ? m[1]!.trim() : null;
  };

  const linhas: LinhaDeExtrato[] = [];
  const ignoradas: ResultadoLeitura['ignoradas'] = [];

  for (const b of blocos) {
    const data = dataBr(campo(b, 'DTPOSTED') ?? '');
    const valor = valorBr(campo(b, 'TRNAMT') ?? '');
    // MEMO costuma ser mais descritivo que NAME; os dois juntos, sem repetir.
    const nome = campo(b, 'NAME') ?? '';
    const memo = campo(b, 'MEMO') ?? '';
    const descricao = [nome, memo].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' — ');

    if (!data || valor === null || valor === 0) {
      ignoradas.push({
        linha: b.slice(0, 120).replace(/\s+/g, ' '),
        motivo: !data ? 'sem data legível' : valor === null ? 'sem valor legível' : 'valor zero',
      });
      continue;
    }

    linhas.push({
      data,
      valor,
      descricao: descricao || 'Sem descrição',
      idExterno: campo(b, 'FITID'),
    });
  }

  return {
    linhas,
    banco: campo(texto, 'BANKID'),
    conta: campo(texto, 'ACCTID'),
    ...periodo(linhas),
    ignoradas,
  };
}

/* ── CSV ────────────────────────────────────────────────────────────────── */

/** Palavras que identificam cada coluna, por ordem de preferência. */
const CABECALHOS = {
  data: ['data', 'date', 'dt', 'data lancamento', 'data do lançamento', 'data mov'],
  descricao: ['historico', 'histórico', 'descricao', 'descrição', 'lancamento', 'lançamento', 'memo', 'description', 'detalhes'],
  valor: ['valor', 'amount', 'valor (r$)', 'montante'],
  credito: ['credito', 'crédito', 'entrada', 'receita'],
  debito: ['debito', 'débito', 'saida', 'saída', 'despesa'],
  documento: ['documento', 'doc', 'numero', 'número', 'id'],
};

function acha(cabecalho: string[], alvos: string[]): number {
  const limpo = cabecalho.map((c) => c.toLowerCase().trim().replace(/["']/g, ''));
  for (const alvo of alvos) {
    const i = limpo.findIndex((c) => c === alvo);
    if (i >= 0) return i;
  }
  for (const alvo of alvos) {
    const i = limpo.findIndex((c) => c.includes(alvo));
    if (i >= 0) return i;
  }
  return -1;
}

/** Divide uma linha de CSV respeitando aspas. */
export function dividirCsv(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = '';
  let dentro = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (c === '"') {
      // Aspas duplicadas dentro de campo com aspas representam uma aspa.
      if (dentro && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentro = !dentro;
    } else if (c === sep && !dentro) {
      out.push(atual); atual = '';
    } else {
      atual += c;
    }
  }
  out.push(atual);
  return out.map((s) => s.trim());
}

/**
 * Lê um CSV de extrato.
 *
 * O cabeçalho é procurado, não presumido na primeira linha: os arquivos dos
 * bancos costumam trazer nome da empresa, período e linhas em branco antes
 * dele. Presumir a primeira linha faria o arquivo inteiro virar "ignorado"
 * sem que ninguém entendesse por quê.
 */
export function lerCsv(conteudo: string): ResultadoLeitura {
  const todas = conteudo.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!todas.length) throw new ExtratoIlegivelError('arquivo vazio.');

  // Separador: o que mais aparece nas primeiras linhas.
  const amostra = todas.slice(0, 15).join('\n');
  const sep = [';', ',', '\t']
    .map((s) => ({ s, n: amostra.split(s).length }))
    .sort((a, b) => b.n - a.n)[0]!.s;

  let iCabecalho = -1;
  let colunas: string[] = [];
  for (let i = 0; i < Math.min(todas.length, 25); i++) {
    const c = dividirCsv(todas[i]!, sep);
    if (acha(c, CABECALHOS.data) >= 0 && (acha(c, CABECALHOS.valor) >= 0 ||
        (acha(c, CABECALHOS.credito) >= 0 || acha(c, CABECALHOS.debito) >= 0))) {
      iCabecalho = i; colunas = c; break;
    }
  }
  if (iCabecalho < 0) {
    throw new ExtratoIlegivelError(
      'não encontrei um cabeçalho com colunas de data e valor. ' +
        'Se o arquivo tiver esses dados com outros nomes, renomeie as colunas para "Data", "Histórico" e "Valor".',
    );
  }

  const cData = acha(colunas, CABECALHOS.data);
  const cDesc = acha(colunas, CABECALHOS.descricao);
  const cValor = acha(colunas, CABECALHOS.valor);
  const cCred = acha(colunas, CABECALHOS.credito);
  const cDeb = acha(colunas, CABECALHOS.debito);
  const cDoc = acha(colunas, CABECALHOS.documento);

  const linhas: LinhaDeExtrato[] = [];
  const ignoradas: ResultadoLeitura['ignoradas'] = [];

  for (const bruta of todas.slice(iCabecalho + 1)) {
    const c = dividirCsv(bruta, sep);
    const data = dataBr(c[cData] ?? '');
    if (!data) {
      // Linhas de total e rodapé caem aqui, e não são erro: só não são
      // transação. Registrar sem alarde deixa o diagnóstico possível.
      ignoradas.push({ linha: bruta.slice(0, 120), motivo: 'sem data na coluna de data' });
      continue;
    }

    /**
     * Duas formas de representar o sinal, e o extrato usa uma ou outra:
     * uma coluna de valor com sinal, ou colunas separadas de crédito e
     * débito. Somar as duas colunas cobre ambos os casos sem adivinhação.
     */
    let valor: number | null = null;
    if (cValor >= 0) {
      valor = valorBr(c[cValor] ?? '');
    } else {
      const cr = cCred >= 0 ? valorBr(c[cCred] ?? '') ?? 0 : 0;
      const de = cDeb >= 0 ? valorBr(c[cDeb] ?? '') ?? 0 : 0;
      valor = Math.abs(cr) - Math.abs(de);
    }

    if (valor === null || valor === 0) {
      ignoradas.push({ linha: bruta.slice(0, 120), motivo: 'sem valor legível' });
      continue;
    }

    linhas.push({
      data,
      valor,
      descricao: (cDesc >= 0 ? c[cDesc] : '')?.trim() || 'Sem descrição',
      idExterno: cDoc >= 0 ? (c[cDoc] ?? '').trim() || null : null,
    });
  }

  if (!linhas.length) {
    throw new ExtratoIlegivelError('encontrei o cabeçalho, mas nenhuma linha com data e valor.');
  }

  return { linhas, banco: null, conta: null, ...periodo(linhas), ignoradas };
}

/* ── Codificação do arquivo ─────────────────────────────────────────────── */

/**
 * Bytes do arquivo → texto, na codificação em que o banco gravou.
 *
 * Nubank e os bancos digitais gravam em UTF-8; Itaú, BB, Caixa e boa parte
 * dos bancos tradicionais ainda gravam OFX em Windows-1252 (`CHARSET:1252`).
 * Ler tudo como UTF-8 transforma "Transferência" em "Transfer�ncia" — o valor
 * continua certo, mas a descrição que a identificação usa fica ilegível e o
 * histórico deixa de reconhecer o fornecedor.
 *
 * A decisão é pelo conteúdo, não pelo cabeçalho: um texto com acento em
 * Windows-1252 quase nunca é UTF-8 válido, então o UTF-8 estrito falha e
 * cai no 1252. Cabeçalho mentindo sobre a codificação é comum o bastante
 * para não confiar nele.
 */
export function textoDoExtrato(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/* ── Porta única ────────────────────────────────────────────────────────── */

/** Escolhe o leitor pelo conteúdo, não pela extensão do arquivo. */
export function lerExtrato(conteudo: string): ResultadoLeitura {
  if (/<STMTTRN>/i.test(conteudo) || /<OFX>/i.test(conteudo)) return lerOfx(conteudo);
  return lerCsv(conteudo);
}

function periodo(linhas: LinhaDeExtrato[]): { de: string | null; ate: string | null } {
  if (!linhas.length) return { de: null, ate: null };
  const datas = linhas.map((l) => l.data).sort();
  return { de: datas[0]!, ate: datas[datas.length - 1]! };
}
