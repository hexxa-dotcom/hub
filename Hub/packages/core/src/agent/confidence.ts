/**
 * CONFIANÇA MEDIDA — a partir de sinais verificáveis, não de auto-relato.
 *
 * O que havia antes no sistema era `confidenceScore: 0.95` escrito na mão, com
 * o comentário "Alto, pois bateu o valor e a IA classificou". Isso não é uma
 * medida: é uma opinião constante, que não muda quando o mundo muda.
 *
 * O problema de fundo é que pedir a confiança AO MODELO também não resolve.
 * Um LLM perguntado "de 0 a 1, quanto você confia?" produz um número
 * plausível, correlacionado com a fluência da própria resposta e não com a
 * chance de estar certo. É auto-relato, e auto-relato de sistema que não sabe
 * o que não sabe.
 *
 * Aqui a confiança é composta de sinais que se pode CONFERIR depois:
 *
 * - um histórico de classificações humanas para a mesma descrição
 * - o mesmo fornecedor sempre indo para a mesma categoria
 * - valor batendo exatamente com um lançamento em aberto
 * - proximidade de data
 *
 * Cada sinal tem peso e é registrado em `evidence`, então uma classificação
 * com confiança 0,87 pode ser aberta e explicada linha a linha. É essa
 * decomposição — e não o número — que permite auditar o agente e descobrir
 * QUAL sinal está enganando quando ele erra.
 */

/** Um sinal observado, com o quanto ele pesa e o que de fato viu. */
export interface Sinal {
  nome: string;
  /** 0 a 1: quanto este sinal sustenta a proposta. */
  forca: number;
  /** Peso relativo do sinal na média. */
  peso: number;
  /** O que foi observado, em texto — é o que torna a medida auditável. */
  observado: string;
}

export interface Confianca {
  /** 0 a 1. Média ponderada dos sinais presentes. */
  score: number;
  sinais: Sinal[];
  /** Frase única para a tela de revisão. */
  resumo: string;
}

/**
 * Combina sinais numa confiança única.
 *
 * Média ponderada, e não produto nem máximo:
 * - o produto colapsaria para perto de zero a cada sinal fraco, punindo
 *   proposta boa só por ter pouca evidência;
 * - o máximo deixaria um único sinal forte mascarar três sinais contra.
 *
 * Quando não há sinal nenhum, a confiança é 0 — e não 0,5. Ausência de
 * evidência não é evidência média; é ausência, e deve mandar a ação para
 * revisão humana.
 */
export function combinarSinais(sinais: Sinal[]): Confianca {
  const validos = sinais.filter((s) => s.peso > 0);
  if (!validos.length) {
    return {
      score: 0,
      sinais: [],
      resumo: 'Sem evidência: nada no histórico sustenta ou contradiz esta proposta.',
    };
  }

  const pesoTotal = validos.reduce((acc, s) => acc + s.peso, 0);
  const score = validos.reduce((acc, s) => acc + s.forca * s.peso, 0) / pesoTotal;

  const maisForte = [...validos].sort((a, b) => b.forca * b.peso - a.forca * a.peso)[0]!;
  const resumo =
    validos.length === 1
      ? maisForte.observado
      : `${maisForte.observado} (+${validos.length - 1} outro${validos.length > 2 ? 's' : ''} sinal${validos.length > 2 ? 'is' : ''})`;

  return { score: Math.round(score * 1000) / 1000, sinais: validos, resumo };
}

/* ══════════════════════════════════════════════════════════════════════════
   Sinais para classificação de lançamento
   ══════════════════════════════════════════════════════════════════════════ */

export interface HistoricoClassificacao {
  /** Quantas vezes esta descrição já foi classificada nesta categoria por humano. */
  acertosDescricao: number;
  /** Quantas vezes foi classificada em OUTRA categoria. */
  divergenciasDescricao: number;
  /** Quantas vezes este fornecedor caiu nesta categoria. */
  acertosFornecedor: number;
  divergenciasFornecedor: number;
}

/**
 * Sinal de histórico: a mesma descrição já foi para esta categoria antes?
 *
 * A força cresce com a quantidade de precedentes mas satura — dez precedentes
 * não são dez vezes mais convincentes que um. E divergências derrubam: uma
 * descrição que já foi para duas categorias diferentes é genuinamente ambígua,
 * e fingir certeza aí é o pior erro possível.
 */
export function sinalHistoricoDescricao(h: HistoricoClassificacao): Sinal | null {
  const total = h.acertosDescricao + h.divergenciasDescricao;
  if (total === 0) return null;

  const proporcao = h.acertosDescricao / total;
  // Saturação: 1 precedente → 0,5; 3 → 0,75; 7 → 0,875.
  const volume = total / (total + 1);
  return {
    nome: 'historico_descricao',
    forca: proporcao * volume,
    peso: 3,
    observado:
      `Descrição idêntica classificada assim ${h.acertosDescricao}× ` +
      (h.divergenciasDescricao
        ? `e de outra forma ${h.divergenciasDescricao}×`
        : 'e nunca de outra forma'),
  };
}

export function sinalHistoricoFornecedor(h: HistoricoClassificacao): Sinal | null {
  const total = h.acertosFornecedor + h.divergenciasFornecedor;
  if (total === 0) return null;

  const proporcao = h.acertosFornecedor / total;
  const volume = total / (total + 1);
  return {
    nome: 'historico_fornecedor',
    forca: proporcao * volume,
    peso: 2,
    observado:
      `Mesmo fornecedor caiu nesta categoria ${h.acertosFornecedor}× ` +
      (h.divergenciasFornecedor ? `e em outra ${h.divergenciasFornecedor}×` : 'sempre'),
  };
}

/**
 * Sinal do modelo. Peso deliberadamente BAIXO — é a opinião de quem está sendo
 * avaliado. Serve para desempatar quando não há histórico, não para decidir.
 */
export function sinalModelo(autoavaliacao: number, justificativa: string): Sinal {
  return {
    nome: 'modelo',
    forca: Math.max(0, Math.min(1, autoavaliacao)),
    peso: 1,
    observado: `Modelo: ${justificativa}`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Sinais para conciliação bancária
   ══════════════════════════════════════════════════════════════════════════ */

export interface EvidenciaConciliacao {
  /** Diferença absoluta entre o valor da transação e o do lançamento. */
  diferencaValor: number;
  /** Dias entre a data do extrato e o vencimento. */
  diferencaDias: number;
  /** Quantos lançamentos em aberto casam com o mesmo valor. */
  candidatosMesmoValor: number;
}

/**
 * Valor exato é o sinal mais forte que existe em conciliação — mas só quando
 * é ÚNICO. Dois aluguéis de R$ 1.500 no mesmo mês fazem o "valor bate
 * exatamente" deixar de significar qualquer coisa, e é exatamente aí que a
 * conciliação automática erra e ninguém percebe.
 */
export function sinalValorExato(e: EvidenciaConciliacao): Sinal {
  const bate = e.diferencaValor < 0.01;
  const unico = e.candidatosMesmoValor <= 1;

  return {
    nome: 'valor',
    forca: bate ? (unico ? 1 : 0.35) : 0,
    peso: 3,
    observado: bate
      ? unico
        ? 'Valor bate exatamente e é o único lançamento com este valor'
        : `Valor bate, mas há ${e.candidatosMesmoValor} lançamentos em aberto com o mesmo valor`
      : `Valor difere em R$ ${e.diferencaValor.toFixed(2)}`,
  };
}

/** Proximidade de data. Decai suave: 0 dias → 1; 3 dias → 0,5; 7 → ~0,3. */
export function sinalProximidadeData(e: EvidenciaConciliacao): Sinal {
  const forca = 1 / (1 + Math.abs(e.diferencaDias) / 3);
  return {
    nome: 'data',
    forca,
    peso: 1,
    observado:
      e.diferencaDias === 0
        ? 'Pago na data do vencimento'
        : `${Math.abs(e.diferencaDias)} dia(s) ${e.diferencaDias > 0 ? 'após' : 'antes'} do vencimento`,
  };
}

/** Confiança de uma conciliação, a partir das evidências do pareamento. */
export function confiancaConciliacao(e: EvidenciaConciliacao): Confianca {
  return combinarSinais([sinalValorExato(e), sinalProximidadeData(e)]);
}

/** Confiança de uma classificação, a partir de histórico e opinião do modelo. */
export function confiancaClassificacao(
  h: HistoricoClassificacao,
  modelo?: { autoavaliacao: number; justificativa: string },
): Confianca {
  const sinais: Sinal[] = [];
  const desc = sinalHistoricoDescricao(h);
  const forn = sinalHistoricoFornecedor(h);
  if (desc) sinais.push(desc);
  if (forn) sinais.push(forn);
  if (modelo) sinais.push(sinalModelo(modelo.autoavaliacao, modelo.justificativa));
  return combinarSinais(sinais);
}
