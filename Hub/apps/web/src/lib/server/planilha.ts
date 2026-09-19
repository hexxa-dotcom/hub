import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

/**
 * PLANILHA .XLSX → TEXTO SEPARADO POR TABULAÇÃO.
 *
 * ── Por que converter em vez de ler direto ──────────────────────────────
 *
 * O leitor de balancete (`lerBalancete`, no core) trabalha sobre texto, e é
 * testado sobre texto. Converter a planilha para o mesmo formato de uma
 * planilha COLADA mantém um leitor só — em vez de dois que precisariam
 * concordar para sempre sobre o que é código, o que é valor e qual coluna é
 * o saldo.
 *
 * ── A decisão que importa: número de conta contra número de valor ───────
 *
 * O Excel guarda `110001` (código de conta) e `1200` (mil e duzentos reais)
 * como o mesmo tipo de célula: número. Emitidos iguais, o leitor não teria
 * como separá-los, e um código lido como valor tira a linha inteira da
 * abertura, em silêncio.
 *
 * O que os distingue na planilha é o FORMATO da célula. Valor contábil é
 * formatado com casas decimais (`#,##0.00`); código é "Geral". Então: número
 * com formato de decimais, ou com parte fracionária, sai como valor em padrão
 * brasileiro (`1.200,00`), que o leitor reconhece sem ambiguidade. O resto
 * sai cru.
 *
 * ── Limites ─────────────────────────────────────────────────────────────
 *
 * Lê a primeira aba. Balancete vem numa aba só; se vier em várias, a
 * primeira é a que o sistema de origem exporta como relatório. `.xls` (o
 * formato binário antigo) não é zip e não é lido — a mensagem diz o que fazer.
 */

export class PlanilhaIlegivelError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'PlanilhaIlegivelError';
  }
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // Sem isto, "00123" vira 123 e "1.10" vira 1.1 — o parser tentaria ser
  // útil e destruiria justamente o texto que precisa chegar intacto.
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (nome) => ['si', 'r', 'row', 'c', 'sheet', 'Relationship', 'xf', 'numFmt'].includes(nome),
});

/** Formatos embutidos do Excel que mostram casas decimais. */
const EMBUTIDOS_COM_DECIMAIS = new Set([2, 4, 7, 8, 10, 11, 39, 40, 43, 44]);

export function planilhaParaTexto(bytes: Uint8Array): string {
  let arquivos: Record<string, Uint8Array>;
  try {
    arquivos = unzipSync(bytes);
  } catch {
    throw new PlanilhaIlegivelError(
      'Não consegui abrir esta planilha. Se for .xls (o formato antigo do Excel), ' +
        'abra no Excel e salve como .xlsx ou CSV.',
    );
  }

  const ler = (caminho: string) => {
    const f = arquivos[caminho];
    return f ? xml.parse(strFromU8(f)) : null;
  };

  const compartilhados = textosCompartilhados(ler('xl/sharedStrings.xml'));
  const comDecimais = estilosComDecimais(ler('xl/styles.xml'));
  const caminhoAba = primeiraAba(ler('xl/workbook.xml'), ler('xl/_rels/workbook.xml.rels'), arquivos);

  const aba = ler(caminhoAba);
  const linhas: unknown[] = aba?.worksheet?.sheetData?.row ?? [];
  if (!linhas.length) throw new PlanilhaIlegivelError('A primeira aba da planilha está vazia.');

  const saida: string[] = [];
  for (const linha of linhas as Record<string, unknown>[]) {
    const celulas = (linha.c ?? []) as Record<string, unknown>[];
    const valores: string[] = [];

    for (const c of celulas) {
      // A posição vem da referência ("C7"), não da ordem: o Excel omite
      // células vazias, e perder a posição deslocaria o saldo para a coluna
      // do débito.
      const coluna = indiceDaColuna(String(c.r ?? ''));
      while (valores.length < coluna) valores.push('');
      valores[coluna] = valorDaCelula(c, compartilhados, comDecimais);
    }
    saida.push(valores.join('\t'));
  }

  return saida.join('\n');
}

function valorDaCelula(
  c: Record<string, unknown>,
  compartilhados: string[],
  comDecimais: Set<number>,
): string {
  const tipo = String(c.t ?? 'n');
  const v = c.v === undefined ? '' : String(c.v);

  if (tipo === 's') return compartilhados[Number(v)] ?? '';
  if (tipo === 'inlineStr') return textoDe((c.is as Record<string, unknown>) ?? {});
  if (tipo === 'str' || tipo === 'e') return v;
  if (tipo === 'b') return v === '1' ? 'VERDADEIRO' : 'FALSO';
  if (v === '') return '';

  const n = Number(v);
  if (!Number.isFinite(n)) return v;

  const estilo = c.s === undefined ? -1 : Number(c.s);
  const pareceDinheiro = !Number.isInteger(n) || comDecimais.has(estilo);
  return pareceDinheiro
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(n);
}

function textosCompartilhados(doc: Record<string, any> | null): string[] {
  const itens: Record<string, unknown>[] = doc?.sst?.si ?? [];
  return itens.map(textoDe);
}

/** Texto de um `<si>` ou `<is>`: direto em `<t>`, ou picado em runs `<r><t>`. */
function textoDe(no: Record<string, unknown>): string {
  const t = no.t;
  if (t !== undefined) return typeof t === 'object' ? String((t as Record<string, unknown>)['#text'] ?? '') : String(t);
  const runs = (no.r ?? []) as Record<string, unknown>[];
  return runs.map((r) => textoDe(r)).join('');
}

/** Índices de estilo (`s`) cujo formato numérico mostra casas decimais. */
function estilosComDecimais(doc: Record<string, any> | null): Set<number> {
  const out = new Set<number>();
  if (!doc) return out;

  const proprios = new Map<number, string>();
  for (const f of (doc.styleSheet?.numFmts?.numFmt ?? []) as Record<string, string>[]) {
    proprios.set(Number(f.numFmtId), String(f.formatCode ?? ''));
  }

  const xfs = (doc.styleSheet?.cellXfs?.xf ?? []) as Record<string, string>[];
  xfs.forEach((xf, i) => {
    const id = Number(xf.numFmtId ?? 0);
    const codigo = proprios.get(id);
    // "0.00", "#,##0.00", "R$ #,##0.00;[Red]-..." — ponto seguido de zeros.
    if (EMBUTIDOS_COM_DECIMAIS.has(id) || (codigo && /\.0+/.test(codigo))) out.add(i);
  });
  return out;
}

/** Caminho da primeira aba, seguindo workbook → rels, com fallback. */
function primeiraAba(
  workbook: Record<string, any> | null,
  rels: Record<string, any> | null,
  arquivos: Record<string, Uint8Array>,
): string {
  const primeira = workbook?.workbook?.sheets?.sheet?.[0];
  const rid = primeira?.['r:id'];
  const alvo = ((rels?.Relationships?.Relationship ?? []) as Record<string, string>[])
    .find((r) => r.Id === rid)?.Target;

  if (alvo) {
    const caminho = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
    if (arquivos[caminho]) return caminho;
  }
  const qualquer = Object.keys(arquivos).filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort();
  if (!qualquer.length) throw new PlanilhaIlegivelError('Esta planilha não tem nenhuma aba.');
  return qualquer[0]!;
}

/** "C7" → 2. "AA3" → 26. */
function indiceDaColuna(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}
