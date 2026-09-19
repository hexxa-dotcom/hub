import { valorBr } from '../banking/extrato-parser';

/**
 * LEITURA DE BALANCETE — CSV, PLANILHA EXPORTADA E PDF.
 *
 * ── O que este arquivo resolve ──────────────────────────────────────────
 *
 * A empresa que troca de contabilidade chega com um balancete do escritório
 * anterior, e é dele que saem os saldos de abertura. Mas "balancete" não é um
 * formato: é um PDF de um sistema, um Excel de outro, um CSV de um terceiro,
 * cada um com sua ordem de colunas e seu jeito de marcar o lado.
 *
 * O que todos têm em comum é a LINHA: um código de conta, um nome, e valores.
 * Então a leitura é por linha, não por layout — o que dispensa configurar um
 * mapeamento por sistema de origem, que é trabalho que nunca acaba.
 *
 * ── A decisão que mais importa: qual número é o saldo ───────────────────
 *
 * Um balancete tem quatro colunas numéricas — saldo anterior, débito do
 * período, crédito do período, saldo atual — e a que interessa é a última.
 * Ler a coluna errada produz um balanço que fecha e está errado, que é o pior
 * resultado possível: parece certo.
 *
 * Por isso o saldo é o ÚLTIMO valor monetário da linha, e por isso as linhas
 * de total são descartadas em vez de somadas.
 *
 * ── O lado vem escrito, quando vem ──────────────────────────────────────
 *
 * Boa parte dos balancetes marca `D` ou `C` ao lado do saldo. Essa marca é
 * melhor do que qualquer dedução: um passivo com saldo devedor existe (uma
 * conta de fornecedor paga a maior, por exemplo) e só a marca revela. Quando
 * ela não vem, quem decide é a natureza da conta — mas aí é palpite, e o
 * chamador precisa saber disso. Daí `lado` ser opcional no resultado.
 */

export interface LinhaDeBalancete {
  /** Código da conta no plano de ORIGEM — pode não existir no plano do Hub. */
  conta: string;
  descricao: string;
  /**
   * Positivo quando `lado` veio marcado — a marca é que carrega o sinal.
   * Pode vir negativo quando não veio marca e o balancete usou sinal.
   */
  valor: number;
  /** 'D' devedor, 'C' credor. Ausente quando o balancete não marcou. */
  lado?: 'D' | 'C';
  /** Linha do arquivo, para a tela poder apontar onde está o problema. */
  linha: number;
}

export interface ResultadoBalancete {
  linhas: LinhaDeBalancete[];
  /** Data de encerramento, se o cabeçalho trouxer. AAAA-MM-DD. */
  dataFinal: string | null;
  /** Quantas linhas foram descartadas por serem totais ou cabeçalho. */
  descartadas: number;
  /** Quando o balancete marcou o lado em TODAS as linhas — nada é palpite. */
  ladoExplicito: boolean;
}

export class BalanceteIlegivelError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'BalanceteIlegivelError';
  }
}

/* ── Reconhecimento de células ──────────────────────────────────────────── */

/**
 * Código de conta: dígitos, possivelmente com pontos ou hífens.
 *
 * O mínimo de dois caracteres evita capturar o número sequencial da linha,
 * que muitos relatórios imprimem na primeira coluna.
 */
const CODIGO = /^\d[\d.\-/]{1,24}$/;

/** `1.234,56`, `1234.56`, `(1.234,56)`, `R$ 1.234,56` — com D/C opcional. */
const MONETARIO = /^[R$\s]*\(?-?[\d.,]*\d[\d.,]*\)?\s*[DCdc]?$/;

/**
 * Linhas que somam outras linhas. Somá-las junto dobraria o balancete.
 *
 * `total`, `soma`, `subtotal` e a linha de conferência final do relatório.
 */
const TOTALIZADORA =
  /^\s*(sub)?total|^\s*soma\b|totais\s*$|^\s*resultado\s+do\s+exerc/i;

/** Cabeçalho de coluna, em qualquer ordem de palavras. */
const CABECALHO =
  /\b(c[óo]digo|classifica[çc][ãa]o|descri[çc][ãa]o|hist[óo]rico|saldo\s+(anterior|atual|final)|d[ée]bito|cr[ée]dito|movimento)\b/i;

/**
 * Quebra uma linha em células.
 *
 * CSV e planilha exportada trazem separador explícito. O texto de PDF não
 * traz nenhum — as colunas são feitas de espaços, e duas ou mais em sequência
 * marcam a fronteira. Tratar os dois casos aqui evita duas funções de leitura
 * que precisariam concordar uma com a outra para sempre.
 */
export function celulasDaLinha(linha: string, separador?: string): string[] {
  if (separador) {
    return linha.split(separador).map((c) => c.replace(/^"|"$/g, '').trim());
  }
  return linha.split(/\s{2,}|\t/).map((c) => c.trim()).filter((c) => c !== '');
}

/** Descobre o separador olhando o arquivo inteiro, não a primeira linha. */
export function separadorDe(conteudo: string): string | undefined {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 60);
  if (!linhas.length) return undefined;

  for (const cand of [';', '\t', ',']) {
    /**
     * Antes de contar frequência: um caractere que vive ENTRE DÍGITOS é
     * separador decimal, não de coluna.
     *
     * A checagem por frequência sozinha não basta, e a falha é silenciosa.
     * Num balancete com cinco colunas de valor por linha, a vírgula decimal
     * aparece cinco vezes em quase toda linha — frequência alta e constante,
     * exatamente o perfil de um separador de verdade. Dividir por ela quebra
     * cada valor ao meio, e o resultado não é um erro: são sete contas lidas
     * com saldo zero.
     */
    const escapado = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const todas = (conteudo.match(new RegExp(escapado, 'g')) ?? []).length;
    const entreDigitos = (conteudo.match(new RegExp(`\\d${escapado}\\d`, 'g')) ?? []).length;
    if (todas > 0 && entreDigitos / todas > 0.5) continue;

    /**
     * Um separador de verdade aparece o MESMO número de vezes na maioria das
     * linhas — é o que faz dele uma coluna. Duas coisas quebram a checagem
     * ingênua, e as duas aconteceram:
     *
     * exigir que TODA linha tenha o separador reprova o `;` por causa do
     * título do relatório, que não tem nenhum;
     *
     * e aceitar qualquer frequência aprova a vírgula do balancete brasileiro,
     * onde ela é decimal e aparece uma vez por valor. Daí o piso de duas
     * ocorrências: uma coluna só não é uma tabela.
     */
    const contagens = linhas.map((l) => l.split(cand).length - 1);
    const frequencia = new Map<number, number>();
    for (const n of contagens) if (n > 0) frequencia.set(n, (frequencia.get(n) ?? 0) + 1);

    let moda = 0;
    let vezes = 0;
    for (const [n, q] of frequencia) if (q > vezes) { moda = n; vezes = q; }

    if (moda >= 2 && vezes >= linhas.length * 0.6) return cand;
  }
  return undefined;
}

/**
 * Distingue um código de conta de um valor monetário.
 *
 * Os dois são feitos de dígitos e pontos, e `1.1.01.001` contra `1.234,56` é
 * a confusão que trava a leitura inteira: tomando o código por valor, a linha
 * fica sem conta e é descartada em silêncio.
 *
 * Duas marcas separam um do outro. A vírgula decimal, que balancete brasileiro
 * sempre traz no valor e nunca no código. E os centavos: um valor com ponto
 * decimal termina em dois dígitos depois de um ponto só; um código tem vários
 * pontos, e o último grupo costuma ter três.
 */
export function ehCodigo(celula: string): boolean {
  if (!CODIGO.test(celula)) return false;
  if (celula.includes(',')) return false;
  const pontos = (celula.match(/\./g) ?? []).length;
  if (pontos <= 1 && /\.\d{2}$/.test(celula)) return false;
  return true;
}

/** Separa o valor da marca de lado: `1.234,56 C` → `1234.56` + `'C'`. */
function valorComLado(texto: string): { valor: number; lado?: 'D' | 'C' } | null {
  const t = texto.trim();
  const m = /^(.*?)[\s]*([DCdc])$/.exec(t);

  /**
   * `valorBr` trata `D` no fim como negativo, porque em extrato bancário é
   * isso que significa. Em balancete significa "devedor", que é positivo do
   * lado do débito. A marca sai antes de o valor ser lido.
   */
  const bruto = m ? m[1]! : t;
  const v = valorBr(bruto);
  if (v === null) return null;

  const lado = m ? (m[2]!.toUpperCase() as 'D' | 'C') : undefined;
  // Parênteses ou sinal negativo sem marca de lado: o sinal fica no valor.
  return { valor: v, lado };
}

/* ── Leitura ────────────────────────────────────────────────────────────── */

/**
 * Lê o balancete de um texto — CSV, planilha salva como texto, ou a camada de
 * texto de um PDF.
 *
 * Não lê PDF binário nem `.xlsx`: quem chama converte para texto antes. Essa
 * fronteira mantém a função pura e testável sem arquivo de apoio.
 */
export function lerBalancete(conteudo: string): ResultadoBalancete {
  const sep = separadorDe(conteudo);
  const brutas = conteudo.split(/\r?\n/);

  const linhas: LinhaDeBalancete[] = [];
  let descartadas = 0;
  let semLado = 0;

  for (let i = 0; i < brutas.length; i++) {
    const crua = brutas[i]!;
    if (crua.trim() === '') continue;

    if (CABECALHO.test(crua) && !/\d[.,]\d{2}/.test(crua)) {
      descartadas++;
      continue;
    }
    if (TOTALIZADORA.test(crua)) {
      descartadas++;
      continue;
    }

    const celulas = celulasDaLinha(crua, sep).filter((c) => c !== '');
    if (celulas.length < 2) continue;

    /* Código: a primeira célula que se pareça com um. */
    let iCodigo = -1;
    for (let c = 0; c < celulas.length; c++) {
      if (ehCodigo(celulas[c]!)) {
        iCodigo = c;
        break;
      }
    }

    /* Valores: todas as células monetárias depois do código. */
    const valores: { indice: number; valor: number; lado?: 'D' | 'C' }[] = [];
    for (let c = iCodigo + 1; c < celulas.length; c++) {
      const cel = celulas[c]!;
      if (!MONETARIO.test(cel)) continue;
      const v = valorComLado(cel);
      if (v) valores.push({ indice: c, ...v });
    }

    if (!valores.length) {
      descartadas++;
      continue;
    }

    /**
     * O saldo é o ÚLTIMO valor — a coluna de saldo atual. Ver o cabeçalho
     * deste arquivo: ler o saldo anterior no lugar dele dá um balanço que
     * fecha e está errado.
     */
    const ultimo = valores[valores.length - 1]!;

    /**
     * A marca de lado pode vir na célula seguinte, em coluna própria. Um
     * `D`/`C` solto logo depois do saldo é isso, e não uma descrição.
     */
    let lado = ultimo.lado;
    const seguinte = celulas[ultimo.indice + 1];
    if (!lado && seguinte && /^[DCdc]$/.test(seguinte)) lado = seguinte.toUpperCase() as 'D' | 'C';

    /* Descrição: o texto entre o código e o primeiro valor. */
    const primeiro = valores[0]!.indice;
    const descricao = celulas
      .slice(iCodigo + 1, primeiro)
      .filter((c) => !/^[DCdc]$/.test(c))
      .join(' ')
      .trim();

    const conta = iCodigo >= 0 ? celulas[iCodigo]! : '';
    if (!conta && !descricao) {
      descartadas++;
      continue;
    }

    if (!lado) semLado++;

    /**
     * Com marca de lado, o valor é sempre positivo e a marca carrega o sinal.
     * Sem marca, o sinal do próprio número é a única informação que existe
     * sobre inversão — e por isso é preservado em vez de descartado.
     */
    const valor = lado ? Math.abs(ultimo.valor) : ultimo.valor;

    linhas.push({ conta, descricao, valor, ...(lado ? { lado } : {}), linha: i + 1 });
  }

  if (!linhas.length) {
    throw new BalanceteIlegivelError(
      'Não encontrei nenhuma conta com saldo neste arquivo. ' +
        'Se for um PDF digitalizado (foto ou scan), o texto não existe para ser lido — ' +
        'peça o balancete em Excel, CSV ou um PDF gerado pelo sistema contábil.',
    );
  }

  return {
    linhas,
    dataFinal: dataDoCabecalho(conteudo),
    descartadas,
    ladoExplicito: semLado === 0,
  };
}

/**
 * Procura a data de encerramento no cabeçalho do relatório.
 *
 * É só uma sugestão para a tela — o contador confirma. Errar a data de
 * abertura joga os saldos no período errado, e ninguém percebe até o
 * primeiro balanço sair torto.
 */
export function dataDoCabecalho(conteudo: string): string | null {
  const topo = conteudo.slice(0, 3000);

  // "31/12/2025", normalmente precedido de "a", "até" ou "em".
  const datas = [...topo.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  if (datas.length) {
    // A última data do cabeçalho é a do fim do período.
    const d = datas[datas.length - 1]!;
    return `${d[3]}-${d[2]}-${d[1]}`;
  }

  // "Dezembro/2025" ou "12/2025" → último dia do mês.
  const mes = /(\b\d{2})\/(\d{4})\b/.exec(topo);
  if (mes) {
    const ano = Number(mes[2]);
    const m = Number(mes[1]);
    if (m >= 1 && m <= 12) {
      const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
      return `${ano}-${String(m).padStart(2, '0')}-${ultimo}`;
    }
  }

  return null;
}
