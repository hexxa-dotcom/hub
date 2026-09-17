import type { ActionKind, Autonomy } from './autonomy-policy';

/**
 * CONFIGURAÇÃO DE OPERAÇÃO — o que cada agente pode fazer, por empresa.
 *
 * Três camadas com herança:
 *
 *   PADRÃO DO SISTEMA  →  PERFIL DO TIPO  →  EXCEÇÃO DA EMPRESA
 *   (aqui, no código)     (SERVICE|HOLDING)   (só o que difere)
 *
 * A decisão central, e a que faz toda a diferença na prática: **cada camada
 * guarda apenas o que sobrescreve, nunca uma cópia da configuração inteira.**
 *
 * Se uma empresa nova copiasse a configuração toda no cadastro, melhorar o
 * padrão amanhã não chegaria a nenhuma das empresas já cadastradas — cada
 * ajuste viraria migração de banco em N linhas, e em um ano ninguém saberia
 * qual empresa está com qual versão. Guardando só o delta, empresa nova herda
 * tudo e nasce funcionando; melhorar o padrão melhora todo mundo que não
 * sobrescreveu; e o contador só toca no que é exceção.
 *
 * `resolverComOrigem` devolve, junto com o valor, de qual camada ele veio — é
 * o que permite a tela mostrar "herdado do perfil Prestadora" ao lado de cada
 * chave, com um botão de voltar ao padrão. Sem isso, o contador não consegue
 * distinguir o que ele configurou do que veio de graça.
 */

export type PerfilEmpresa = 'SERVICE' | 'HOLDING';
export type Camada = 'sistema' | 'perfil' | 'empresa';

/** Agentes que podem ser ligados e desligados por empresa. */
export interface AgentesLigados {
  /** Classifica lançamentos sem categoria. */
  classificador: boolean;
  /** Sugere pareamento entre extrato e lançamentos. */
  conciliador: boolean;
  /** Confere o mês e propõe fechamento. */
  fechamento: boolean;
  /** Escritura documentos no razão. Desligar isto para o razão da empresa. */
  escrituracao: boolean;
  /**
   * Traz guias apuradas e folha do OneFlow e as escritura.
   *
   * Interruptor próprio, e não parte de `escrituracao`, porque é uma decisão
   * diferente: escriturar é sobre o que já está no Hub; isto cria documento
   * novo a partir do que o sistema contábil apurou. Uma empresa cujo fiscal
   * ainda não está implantado lá deve ficar com isto desligado, senão a volta
   * só produz aviso de apuração zerada todo mês.
   */
  retornoOneflow: boolean;
  /** Dicas contextuais nas telas do portal. */
  insights: boolean;
}

export interface ConfigMotor {
  /** `null` = herda a credencial global da plataforma. */
  provider: 'anthropic' | 'gemini' | 'openai-compat' | null;
  model: string | null;
  baseUrl: string | null;
}

export interface ConfigAutonomia {
  /**
   * Teto por tipo de ação. Sobrepõe a régua do código — para mais restritivo
   * ou para menos, e é por isso que a tela precisa mostrar o padrão ao lado.
   */
  tetos: Partial<Record<ActionKind, Autonomy>>;
  /** Limite em R$ acima do qual a ação sobe um degrau. `null` = sem limite. */
  limites: Partial<Record<ActionKind, number | null>>;
  /** Abaixo disto, ação automática vira revisão. */
  confiancaMinimaAuto: number;
}

/**
 * Quando o mês fecha, e o que acontece depois que o contador libera.
 *
 * ── Por que é por empresa ───────────────────────────────────────────────
 *
 * Nem toda empresa tem o mesmo ritmo. Uma que fatura tudo no começo do mês
 * pode fechar cedo; uma que recebe documento de fornecedor atrasado precisa
 * de folga. Forçar uma data única faria o contador reabrir mês manualmente
 * todo mês nas empresas que não cabem nela — que é trabalho manual criado
 * por configuração, o oposto do que este sistema existe para fazer.
 */
export interface ConfigFechamento {
  /**
   * Dia em que o mês tranca para o cliente.
   *
   * Conta a partir do FIM do mês de referência: 1 = primeiro dia do mês
   * seguinte. `0` significa o último dia do próprio mês.
   *
   * O intervalo aceito é 0 a 20. Acima disso o fechamento invadiria o
   * vencimento do DAS (dia 20), e um mês que ainda não fechou não tem guia
   * apurada para pagar.
   */
  diaDoFechamento: number;
  /**
   * Depois que o contador CONFERE e libera, a saída para o OneFlow é
   * automática ou fica esperando um segundo comando?
   *
   * `true` — liberar já envia. Menos cliques para quem confia na conferência.
   * `false` — liberar deixa pronto na área do contador, e o envio é um ato
   *           separado. É o padrão, porque o envio é irreversível do lado de
   *           lá: lançamento que entra no OneFlow só sai por exclusão manual,
   *           e a listagem do razão de lá não devolve ids para automatizar
   *           isso.
   */
  envioAutomaticoAoLiberar: boolean;
}

export interface OperationSettings {
  agentes: AgentesLigados;
  motor: ConfigMotor;
  autonomia: ConfigAutonomia;
  fechamento: ConfigFechamento;
  /**
   * Instruções específicas da empresa, anexadas ao prompt dos agentes.
   *
   * Limite de tamanho deliberado: instrução em prompt não é aprendizado. Ela
   * funciona nos primeiros casos e dilui conforme cresce — a regra 12 de uma
   * lista de 12 é ignorada com frequência. Serve para o caso particular
   * ("Dr. Henrique é PJ, não cliente"), não para reescrever a régua.
   */
  diretrizes: string;
}

export const LIMITE_DIRETRIZES = 2000;

/** Camada 1 — o padrão do sistema. Vale para toda empresa que não sobrescreva. */
export const PADRAO_SISTEMA: OperationSettings = {
  agentes: {
    classificador: true,
    conciliador: true,
    fechamento: true,
    escrituracao: true,
    // Desligado por padrão: exige que o módulo fiscal da empresa esteja
    // implantado no OneFlow. Ligar sem isso não quebra nada, mas enche o
    // relatório de "apuração zerada" — e aviso que aparece sempre é aviso
    // que ninguém lê.
    retornoOneflow: false,
    insights: true,
  },
  motor: { provider: null, model: null, baseUrl: null },
  autonomia: { tetos: {}, limites: {}, confiancaMinimaAuto: 0.85 },
  fechamento: {
    // Dia 1: o mês tranca assim que vira. É o que o cliente espera — ele não
    // lança em mês passado — e dá ao contador o mês inteiro seguinte para
    // conferir antes do vencimento do DAS, no dia 20.
    diaDoFechamento: 1,
    envioAutomaticoAoLiberar: false,
  },
  diretrizes: '',
};

/** Limites do dia de fechamento. Ver `ConfigFechamento.diaDoFechamento`. */
export const DIA_FECHAMENTO_MIN = 0;
export const DIA_FECHAMENTO_MAX = 20;

/**
 * Data em que o mês de referência tranca, dado o dia configurado.
 *
 * @param referenceMonth 'AAAA-MM'
 */
export function dataDoFechamento(referenceMonth: string, dia: number): string {
  const [ano, mes] = referenceMonth.split('-').map(Number);
  // `dia = 0` é o último dia do próprio mês; a partir de 1, dias do mês
  // seguinte. `Date.UTC(ano, mes, 0)` já devolve o último dia de `mes`
  // (porque `mes` aqui é 1-based e o construtor é 0-based).
  const d = new Date(Date.UTC(ano!, mes!, dia));
  return d.toISOString().slice(0, 10);
}

/**
 * Camada 2 — o que muda por tipo de empresa.
 *
 * `company.type` já existia no sistema e é o discriminador natural. A diferença
 * é real, não cosmética: ligar emissão de nota numa holding faria o agente
 * propor NFSe para uma empresa que nunca prestou serviço, e o contador
 * aprenderia a ignorar a fila de aprovação.
 */
export const PADRAO_PERFIL: Record<PerfilEmpresa, Partial<OperationSettings>> = {
  SERVICE: {
    // Prestadora usa tudo: emite nota, cobra cliente, apura Fator R.
  },
  HOLDING: {
    autonomia: {
      tetos: {
        // Holding patrimonial não presta serviço. Deixar a ação disponível
        // seria convidar o agente a propor algo que nunca se aplica.
        EMITIR_NFSE: 'APPROVAL',
        CANCELAR_NFSE: 'APPROVAL',
        ENVIAR_COBRANCA: 'APPROVAL',
      },
      limites: {},
      confiancaMinimaAuto: 0.85,
    },
  },
};

/** Sobrescrita parcial, em qualquer profundidade. */
export type SettingsParcial = {
  agentes?: Partial<AgentesLigados>;
  motor?: Partial<ConfigMotor>;
  autonomia?: Partial<ConfigAutonomia>;
  fechamento?: Partial<ConfigFechamento>;
  diretrizes?: string;
};

/** De onde veio cada valor da configuração resolvida. */
export type Origem = {
  [K in keyof OperationSettings]: K extends 'diretrizes' ? Camada : Record<string, Camada>;
};

export interface ConfiguracaoResolvida {
  valores: OperationSettings;
  origem: Origem;
}

function aplicar<T extends object>(
  base: T,
  patch: Partial<T> | undefined,
  camada: Camada,
  origem: Record<string, Camada>,
): T {
  if (!patch) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    (out as Record<string, unknown>)[k] = v;
    origem[k] = camada;
  }
  return out;
}

/**
 * Resolve a configuração efetiva de uma empresa, com a origem de cada valor.
 *
 * A ordem é fixa e a última camada ganha. Só isso — não há ponderação nem
 * mesclagem "inteligente": configuração que se resolve por regra sutil é
 * configuração que ninguém consegue prever, e prever é o ponto de configurar.
 */
export function resolverConfiguracao(
  perfil: PerfilEmpresa,
  sistema?: SettingsParcial,
  empresa?: SettingsParcial,
): ConfiguracaoResolvida {
  const origem: Origem = {
    agentes: {},
    motor: {},
    autonomia: {},
    fechamento: {},
    diretrizes: 'sistema',
  };

  for (const k of Object.keys(PADRAO_SISTEMA.agentes)) origem.agentes[k] = 'sistema';
  for (const k of Object.keys(PADRAO_SISTEMA.motor)) origem.motor[k] = 'sistema';
  for (const k of Object.keys(PADRAO_SISTEMA.autonomia)) origem.autonomia[k] = 'sistema';
  for (const k of Object.keys(PADRAO_SISTEMA.fechamento)) origem.fechamento[k] = 'sistema';

  const doPerfil = PADRAO_PERFIL[perfil];

  let agentes = aplicar(PADRAO_SISTEMA.agentes, sistema?.agentes, 'sistema', origem.agentes);
  agentes = aplicar(agentes, doPerfil?.agentes, 'perfil', origem.agentes);
  agentes = aplicar(agentes, empresa?.agentes, 'empresa', origem.agentes);

  let motor = aplicar(PADRAO_SISTEMA.motor, sistema?.motor, 'sistema', origem.motor);
  motor = aplicar(motor, doPerfil?.motor, 'perfil', origem.motor);
  motor = aplicar(motor, empresa?.motor, 'empresa', origem.motor);

  let autonomia = aplicar(PADRAO_SISTEMA.autonomia, sistema?.autonomia, 'sistema', origem.autonomia);
  autonomia = aplicar(autonomia, doPerfil?.autonomia, 'perfil', origem.autonomia);
  autonomia = aplicar(autonomia, empresa?.autonomia, 'empresa', origem.autonomia);

  let fechamento = aplicar(PADRAO_SISTEMA.fechamento, sistema?.fechamento, 'sistema', origem.fechamento);
  fechamento = aplicar(fechamento, doPerfil?.fechamento, 'perfil', origem.fechamento);
  fechamento = aplicar(fechamento, empresa?.fechamento, 'empresa', origem.fechamento);

  // Dia fora do intervalo é recusado em silêncio, voltando ao padrão: um
  // fechamento no dia 45 não existe, e aceitá-lo travaria o mês para sempre.
  if (
    !Number.isInteger(fechamento.diaDoFechamento) ||
    fechamento.diaDoFechamento < DIA_FECHAMENTO_MIN ||
    fechamento.diaDoFechamento > DIA_FECHAMENTO_MAX
  ) {
    fechamento = { ...fechamento, diaDoFechamento: PADRAO_SISTEMA.fechamento.diaDoFechamento };
    origem.fechamento.diaDoFechamento = 'sistema';
  }

  let diretrizes = PADRAO_SISTEMA.diretrizes;
  for (const [patch, camada] of [
    [sistema, 'sistema'],
    [doPerfil, 'perfil'],
    [empresa, 'empresa'],
  ] as const) {
    if (patch && typeof patch.diretrizes === 'string') {
      diretrizes = patch.diretrizes;
      origem.diretrizes = camada;
    }
  }

  // Corta no limite em vez de recusar: diretriz longa demais é erro de quem
  // escreveu, e derrubar a resolução inteira por causa disso deixaria a
  // empresa sem configuração nenhuma — pior que a diretriz truncada.
  if (diretrizes.length > LIMITE_DIRETRIZES) diretrizes = diretrizes.slice(0, LIMITE_DIRETRIZES);

  return { valores: { agentes, motor, autonomia, fechamento, diretrizes }, origem };
}

/** A empresa sobrescreveu algo, ou está inteiramente no padrão? */
export function temExcecao(origem: Origem): boolean {
  const camadas = [
    ...Object.values(origem.agentes),
    ...Object.values(origem.motor),
    ...Object.values(origem.autonomia),
    ...Object.values(origem.fechamento),
    origem.diretrizes,
  ];
  return camadas.includes('empresa');
}

/** Lista legível do que esta empresa tem de diferente — para a tela. */
export function excecoes(origem: Origem): string[] {
  const out: string[] = [];
  for (const [grupo, mapa] of [
    ['agentes', origem.agentes],
    ['motor', origem.motor],
    ['autonomia', origem.autonomia],
  ] as const) {
    for (const [chave, camada] of Object.entries(mapa)) {
      if (camada === 'empresa') out.push(`${grupo}.${chave}`);
    }
  }
  if (origem.diretrizes === 'empresa') out.push('diretrizes');
  return out;
}
