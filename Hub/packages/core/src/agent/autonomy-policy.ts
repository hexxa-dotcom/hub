/**
 * RÉGUA DE AUTONOMIA — o que o agente pode fazer sozinho.
 *
 * A regra é: **valor e reversibilidade, nunca a confiança do modelo.**
 *
 * Isso não é preciosismo. Confiança alta num modelo significa "este texto se
 * parece com os textos que eu classifiquei certo" — não significa "esta nota
 * fiscal pode ser emitida". Um modelo pode estar 99% confiante e errado, e o
 * custo do erro não muda em nada com a confiança: emitir NFSe errada dá
 * trabalho na prefeitura do mesmo jeito.
 *
 * O que muda o custo do erro é o VALOR envolvido e se dá para desfazer. Então
 * é isso que governa a autonomia — e a regra mora aqui, no sistema, onde é
 * código testável, e não no prompt, onde seria uma sugestão que o modelo pode
 * reinterpretar.
 *
 * A confiança medida tem um papel, mas é outro: confiança baixa manda a ação
 * para revisão mesmo quando o valor permitiria automático. Ela só aperta a
 * régua, nunca afrouxa.
 */

export type Autonomy = 'AUTO' | 'REVIEW' | 'APPROVAL';

/** Tipos de ação que um agente pode propor. */
export type ActionKind =
  | 'CLASSIFICAR_LANCAMENTO'
  | 'CONCILIAR_TRANSACAO'
  | 'CRIAR_LANCAMENTO'
  | 'ESCRITURAR'
  | 'ESTORNAR_PARTIDA'
  | 'MARCAR_PAGO'
  | 'EMITIR_NFSE'
  | 'CANCELAR_NFSE'
  | 'PAGAR_GUIA'
  | 'DISTRIBUIR_LUCRO'
  | 'FECHAR_MES'
  | 'REABRIR_MES'
  | 'LIBERAR_CONTABIL'
  | 'ENVIAR_COBRANCA';

interface Regra {
  /** Teto máximo de autonomia, independente de valor. */
  teto: Autonomy;
  /**
   * Acima deste valor (R$), sobe um degrau na régua. `null` = o valor não
   * muda nada, porque o risco não é financeiro (emitir nota de R$ 50 fala
   * com a prefeitura igual a uma de R$ 50 mil).
   */
  limiteValor: number | null;
  /** Por que esta ação tem este teto — some no código, fica na revisão. */
  porque: string;
}

const REGRAS: Record<ActionKind, Regra> = {
  CLASSIFICAR_LANCAMENTO: {
    teto: 'AUTO',
    limiteValor: 5_000,
    porque: 'Trocar a categoria de uma despesa é reversível com um clique e não sai do sistema.',
  },
  CONCILIAR_TRANSACAO: {
    teto: 'AUTO',
    limiteValor: 5_000,
    porque: 'Casar extrato com lançamento se desfaz; o dinheiro já se moveu de qualquer forma.',
  },
  ESCRITURAR: {
    teto: 'AUTO',
    limiteValor: null,
    porque:
      'A partida é derivada de documento que já existe, e o razão só aceita partida que fecha. ' +
      'Errar aqui se corrige por estorno, que deixa rastro.',
  },
  CRIAR_LANCAMENTO: {
    teto: 'REVIEW',
    limiteValor: 1_000,
    porque: 'Inventa um fato financeiro que ninguém registrou — precisa de olho humano depois.',
  },
  MARCAR_PAGO: {
    teto: 'REVIEW',
    limiteValor: 1_000,
    porque: 'Afirma que dinheiro saiu. Se não saiu, o caixa passa a mentir.',
  },
  ESTORNAR_PARTIDA: {
    teto: 'REVIEW',
    limiteValor: 10_000,
    porque: 'Estorno é a correção certa, mas estorno indevido apaga escrituração legítima.',
  },
  ENVIAR_COBRANCA: {
    teto: 'REVIEW',
    limiteValor: null,
    porque: 'Fala com o cliente da empresa. Não desfaz — no máximo se pede desculpa.',
  },
  EMITIR_NFSE: {
    teto: 'APPROVAL',
    limiteValor: null,
    porque:
      'Documento fiscal na prefeitura. Cancelar tem prazo, gera obrigação acessória e ' +
      'aparece na apuração. O valor não muda isso.',
  },
  CANCELAR_NFSE: {
    teto: 'APPROVAL',
    limiteValor: null,
    porque: 'Mesma razão da emissão, e com prazo legal correndo.',
  },
  PAGAR_GUIA: {
    teto: 'APPROVAL',
    limiteValor: null,
    porque: 'Move dinheiro para fora. Irreversível por definição.',
  },
  DISTRIBUIR_LUCRO: {
    teto: 'APPROVAL',
    limiteValor: null,
    porque:
      'Move dinheiro aos sócios e tem consequência tributária (isenção depende de lucro ' +
      'apurado). Erro aqui vira problema de IRPF do sócio.',
  },
  /**
   * Trancar o mês para o cliente. A IA faz sozinha.
   *
   * Mudei de APPROVAL para REVIEW ao perceber que eu tinha classificado o
   * fato errado. Fechar para o cliente é reversível (reabrir é operação
   * normal), não sai do sistema e não fala com ninguém de fora — pelos
   * critérios da própria régua, é REVIEW.
   *
   * O que de fato é irreversível e externo é LIBERAR_CONTABIL, abaixo. Eram
   * dois fatos colapsados num só: exigir aprovação para o primeiro deixaria o
   * cliente esperando alguém destravar o mês dele para voltar a trabalhar.
   */
  FECHAR_MES: {
    teto: 'REVIEW',
    limiteValor: null,
    porque:
      'Tranca o mês para o cliente depois de apurado e conferido. Reversível por reabertura, ' +
      'e não sai do sistema — mas o contador confere depois.',
  },

  REABRIR_MES: {
    teto: 'APPROVAL',
    limiteValor: null,
    porque:
      'Destrava um mês já fechado para receber lançamento novo. Muda número que já foi ' +
      'apresentado como final — quem reabre precisa assumir isso.',
  },

  /**
   * A liberação para a contabilidade oficial. SEMPRE exige o contador.
   *
   * É ele quem assina o balanço e é ele quem tem como avaliar — o cliente não
   * pode aprovar um fechamento porque não sabe o que estaria aprovando, e
   * pedir isso a ele seria teatro de controle: clicaria em tudo, e a aprovação
   * perderia o sentido.
   */
  LIBERAR_CONTABIL: {
    teto: 'APPROVAL',
    limiteValor: null,
    porque:
      'Entrega o período à contabilidade oficial. Sai do sistema, vira base de obrigação ' +
      'acessória e não volta atrás.',
  },
};

const ESCADA: Autonomy[] = ['AUTO', 'REVIEW', 'APPROVAL'];

function subirUmDegrau(a: Autonomy): Autonomy {
  const i = ESCADA.indexOf(a);
  return ESCADA[Math.min(i + 1, ESCADA.length - 1)]!;
}

function maisRestritivo(a: Autonomy, b: Autonomy): Autonomy {
  return ESCADA.indexOf(a) >= ESCADA.indexOf(b) ? a : b;
}

/**
 * Confiança abaixo disto manda para revisão, mesmo em ação automática.
 *
 * Note a assimetria: confiança BAIXA aperta a régua, confiança ALTA nunca a
 * afrouxa. É o único uso honesto de um número que, no fundo, é o modelo
 * opinando sobre si mesmo.
 */
export const CONFIANCA_MINIMA_AUTO = 0.85;

export interface DecisaoAutonomia {
  autonomy: Autonomy;
  /** Explicação legível — vai para a tela de revisão, não só para o log. */
  motivo: string;
}

/**
 * Decide o nível de autonomia de uma ação.
 *
 * @param kind  o que a ação faz
 * @param amount valor financeiro envolvido, se houver
 * @param confidence confiança MEDIDA (ver `measureConfidence`), 0 a 1
 */
export function decidirAutonomia(
  kind: ActionKind,
  amount: number | null,
  confidence: number,
): DecisaoAutonomia {
  const regra = REGRAS[kind];
  if (!regra) {
    // Ação desconhecida é o caso mais perigoso: nada sabe o custo de errar
    // nela. O padrão seguro é exigir aprovação, não presumir que é inofensiva.
    return {
      autonomy: 'APPROVAL',
      motivo: `Ação "${kind}" não está na régua de autonomia — exige aprovação até ser classificada.`,
    };
  }

  let nivel = regra.teto;
  const motivos: string[] = [];

  if (regra.limiteValor !== null && amount !== null && amount > regra.limiteValor) {
    nivel = subirUmDegrau(nivel);
    motivos.push(
      `valor de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} acima do limite de ` +
        `R$ ${regra.limiteValor.toLocaleString('pt-BR')}`,
    );
  }

  if (nivel === 'AUTO' && confidence < CONFIANCA_MINIMA_AUTO) {
    nivel = maisRestritivo(nivel, 'REVIEW');
    motivos.push(`confiança medida ${(confidence * 100).toFixed(0)}% abaixo de ${CONFIANCA_MINIMA_AUTO * 100}%`);
  }

  const motivo = motivos.length
    ? `${regra.porque} Elevado para ${nivel}: ${motivos.join('; ')}.`
    : regra.porque;

  return { autonomy: nivel, motivo };
}

/** A régua inteira, para a tela de configuração mostrar o que a IA pode fazer. */
export function reguaCompleta(): { kind: ActionKind; teto: Autonomy; limiteValor: number | null; porque: string }[] {
  return (Object.keys(REGRAS) as ActionKind[]).map((kind) => ({ kind, ...REGRAS[kind] }));
}
