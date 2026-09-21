/**
 * QUANTO DESSE DINHEIRO É MEU.
 *
 * ── A pergunta ─────────────────────────────────────────────────────────
 *
 * Quem tem PJ sozinho abre o sistema com uma dúvida só: entrou R$ 18 mil,
 * quanto dá para tirar sem se ferrar em março? O saldo do banco não responde
 * — dentro dele estão o DAS que vence dia 20, o fornecedor que ainda não
 * cobrou e o pró-labore do mês. Tirar olhando o extrato é como gastar o
 * dinheiro do imposto e descobrir depois.
 *
 * ── Por que a conta sai do razão, e não do financeiro ──────────────────
 *
 * Todo lançamento financeiro já é escriturado (ver `escriturarLancamento`):
 * uma conta a pagar vira despesa contra Fornecedores. Somar as pendências do
 * financeiro E as obrigações do razão contaria a mesma dívida duas vezes.
 * O razão é a única fonte que não duplica.
 *
 * ── O que NÃO é descontado ─────────────────────────────────────────────
 *
 * Lucros a Pagar já é dinheiro DELE, só que ainda na empresa. Descontá-lo
 * diria "não está livre" sobre o que é justamente o que ele tem a receber.
 */

/** Saldo de uma conta do razão, já com o sinal da natureza dela. */
export interface SaldoDeConta {
  code: string;
  /** Devedor nas contas de ativo, credor nas de passivo. Sempre ≥ 0 aqui. */
  balance: number;
}

export interface EntradasDoCaixaLivre {
  /** Saldos do balancete até hoje. */
  saldos: SaldoDeConta[];
  /**
   * Imposto do mês corrente ainda NÃO provisionado no razão.
   *
   * O DAS de setembro é provisionado no fechamento de setembro, mas vence em
   * outubro. Entre o dia 1º e o fechamento, o razão ainda não conhece essa
   * dívida — e o número sairia otimista justamente no período em que o cliente
   * mais olha para ele. Zero quando já está provisionado.
   */
  impostoEstimadoDoMes?: number;
}

export interface CaixaLivre {
  saldoEmConta: number;
  impostos: number;
  /** Fornecedores e demais contas a pagar já reconhecidas. */
  contasAPagar: number;
  /** Pró-labore, salários e encargos ainda não pagos. */
  pessoal: number;
  /** Já é dele: lucros declarados e ainda não sacados. */
  lucrosAPagar: number;
  /** O número da tela. Só vale quando `saldoConhecido` é `true`. */
  livre: number;
  /**
   * O razão sabe quanto tem no banco?
   *
   * Empresa recém-integrada tem folha e imposto provisionados e NENHUM
   * movimento bancário — o extrato ainda não veio. A conta daria um "livre
   * para retirar" de dezenas de milhares NEGATIVO, e o cliente leria isso
   * como "estou quebrado" quando o que houve foi ausência de dado.
   *
   * Medido na BM3 e na Nathalia em 2026-09-21: −R$ 17.044 e −R$ 13.453, as
   * duas com dinheiro em conta na vida real. Sem esta trava, o primeiro
   * número que o cliente veria do produto seria uma mentira alarmante.
   */
  saldoConhecido: boolean;
  /**
   * Dinheiro que entrou ou saiu do banco e ninguém classificou. Enquanto
   * houver saldo aqui, o número acima é provisório — pode haver despesa
   * escondida dentro dele.
   */
  aClassificar: number;
}

/** Contas que a conta do caixa livre referencia. Ver `ACCOUNTS`. */
const CAIXA = ['1.1.01.001', '1.1.01.002'];
const A_CLASSIFICAR = '1.1.09.001';
const LUCROS_A_PAGAR = '2.1.04.001';
const IMPOSTOS = '2.1.03';
const PESSOAL = '2.1.02';

export function calcularCaixaLivre(entradas: EntradasDoCaixaLivre): CaixaLivre {
  const soma = (filtro: (code: string) => boolean) =>
    entradas.saldos.filter((s) => filtro(s.code)).reduce((t, s) => t + Number(s.balance || 0), 0);

  const saldoEmConta = soma((c) => CAIXA.includes(c));
  // Conta de caixa/banco que nunca recebeu partida não aparece no balancete.
  const saldoConhecido = entradas.saldos.some((s) => CAIXA.includes(s.code));
  const aClassificar = soma((c) => c.startsWith(A_CLASSIFICAR));
  const lucrosAPagar = soma((c) => c.startsWith(LUCROS_A_PAGAR));
  const impostosNoRazao = soma((c) => c.startsWith(IMPOSTOS));
  const pessoal = soma((c) => c.startsWith(PESSOAL));

  // Todo o resto do passivo circulante: fornecedores, adiantamentos de
  // cliente, outras obrigações. Menos o que já foi nomeado acima — e menos os
  // lucros, que são dele.
  const contasAPagar = soma(
    (c) =>
      c.startsWith('2.1') &&
      !c.startsWith(IMPOSTOS) &&
      !c.startsWith(PESSOAL) &&
      !c.startsWith(LUCROS_A_PAGAR),
  );

  const impostos = impostosNoRazao + Math.max(0, Number(entradas.impostoEstimadoDoMes ?? 0));

  return {
    saldoEmConta,
    impostos,
    contasAPagar,
    pessoal,
    lucrosAPagar,
    aClassificar,
    saldoConhecido,
    // Pode dar negativo, e nesse caso o número precisa aparecer negativo: a
    // empresa deve mais do que tem em caixa, e arredondar para zero esconderia
    // exatamente a situação que o cliente precisa ver.
    livre: Math.round((saldoEmConta - impostos - contasAPagar - pessoal) * 100) / 100,
  };
}
