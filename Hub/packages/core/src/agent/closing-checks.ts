/**
 * VERIFICAÇÕES DE FECHAMENTO.
 *
 * O cron de fechamento que existia fazia `SUM()` por tipo, gravava
 * `status: 'CLOSED'` e emitia a guia do DAS. Sem conferir nada: não olhava se
 * o banco estava conciliado, se sobrou lançamento sem categoria, se a receita
 * batia com as notas emitidas. Ele **declarava fechado um mês que não tinha
 * conferido**.
 *
 * Fechar é afirmar que um período está correto. Um total sem conferência não é
 * afirmação, é aritmética — e uma IA que produzisse esse total mais rápido só
 * erraria mais rápido.
 *
 * Cada verificação aqui é uma função pura sobre dados já coletados. Puras
 * porque o valor delas está em serem exaustivamente testáveis: são elas que
 * decidem se um mês pode ser entregue à contabilidade.
 *
 * Três severidades, com significados distintos e não negociáveis:
 *
 * - `BLOQUEIO`: o mês não fecha. O número está errado, não incompleto.
 * - `ATENCAO`: fecha, mas alguém precisa saber. Provável erro, não certo.
 * - `INFO`: contexto para quem revisa. Não impede nada.
 *
 * O agente de fechamento NUNCA rebaixa uma severidade. Se pudesse, o caminho
 * mais curto para "fechar o mês" passaria a ser convencer-se de que o problema
 * é pequeno.
 */

export type Severidade = 'BLOQUEIO' | 'ATENCAO' | 'INFO';

export interface Ocorrencia {
  /** Identificador estável — vira chave de deduplicação e de tela. */
  id: string;
  /**
   * A IA consegue resolver isto sozinha, sem incomodar o cliente?
   *
   * O cliente desta ferramenta é um profissional autônomo: ele entende do
   * negócio dele, não de contabilidade. Ele faz UMA coisa — lança. Tudo que a
   * IA conseguir resolver a partir do lançamento, ela resolve, e ele nunca fica
   * sabendo que existia uma pendência.
   *
   * Marcar `false` aqui é dizer "isto é genuinamente impossível sem ele" — e
   * cada `false` a mais é um motivo a mais para ele abandonar a ferramenta.
   */
  resolvivelPorIA: boolean;
  /**
   * O que dizer ao cliente, na língua dele, quando `resolvivelPorIA` é falso.
   *
   * Nunca fala de categoria, partida, conta contábil ou competência. Se a
   * frase precisa dessas palavras, é porque o problema não era do cliente.
   */
  mensagemCliente?: string;
  severidade: Severidade;
  titulo: string;
  /** O que foi observado, com números. Vai para o contador ler. */
  detalhe: string;
  /** Quantos documentos, quando aplicável. */
  quantidade?: number;
  /** Valor envolvido, quando aplicável. */
  valor?: number;
  /** O que fazer a respeito — sem isto a ocorrência é só reclamação. */
  acao?: string;
  /** Ids dos documentos afetados, para a tela linkar. */
  documentos?: string[];
}

/** Retrato do mês, coletado do banco e passado para as verificações. */
export interface DadosDoMes {
  referenceMonth: string;
  /** Débito e crédito acumulados do razão até o fim do mês. */
  razao: { debito: number; credito: number };
  /** Total em contas de resultado "a classificar". */
  aClassificar: { quantidade: number; valor: number; documentos: string[] };
  /** Transações do extrato ainda não conciliadas no mês. */
  extratoPendente: { quantidade: number; valor: number };
  /** Receita reconhecida no mês. */
  receita: number;
  /** Receita com nota fiscal emitida. */
  receitaComNota: number;
  /** Lançamentos de receita sem nota vinculada. */
  receitaSemNota: { quantidade: number; valor: number; documentos: string[] };
  /** Pares suspeitos de duplicidade: mesmo parceiro, valor e vencimento. */
  duplicidades: { descricao: string; valor: number; ids: string[] }[];
  /** Guia de imposto do mês, se provisionada. */
  temGuiaDoMes: boolean;
  /**
   * Saldo de banco pelo razão e pelo cadastro da conta bancária.
   *
   * `temFeed` diz se o saldo do cadastro vem de uma fonte que se mantém
   * sozinha (Open Finance, extrato importado) ou é um número que alguém
   * digitou uma vez. A distinção decide tudo: divergir de um extrato real é
   * erro contábil; divergir de um campo que ninguém atualiza não é informação
   * nenhuma.
   */
  saldoBanco: { peloRazao: number; peloCadastro: number | null; temFeed: boolean };
  /** Total de lançamentos no mês — zero é suspeito, não é "mês tranquilo". */
  totalLancamentos: number;
  /**
   * Saldo da conta transitória do extrato bancário.
   *
   * Movimento que entrou no razão sem se saber o que é. Diferente das outras
   * pendências, esta NÃO pode acompanhar o mês fechado: a transitória não
   * existe na ITG 1000, e entregar um balanço com saldo nela seria entregar
   * um balanço com uma linha que não significa nada.
   */
  transitoria: { saldo: number; quantidade: number };
  /** Despesa total do mês, para medir o PESO do que está sem classificação. */
  despesaTotal: number;
}

const BRL = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

/**
 * O razão fecha? Os triggers do banco deveriam tornar isto impossível de
 * falhar. A verificação existe justamente por isso: uma asserção barata sobre
 * um invariante que já deveria valer é o que detecta o dia em que ele deixou
 * de valer por um caminho que ninguém previu.
 */
function checarRazao(d: DadosDoMes): Ocorrencia | null {
  const diff = Math.round((d.razao.debito - d.razao.credito) * 100) / 100;
  if (diff === 0) return null;
  return {
    id: 'razao_nao_fecha',
    severidade: 'BLOQUEIO',
    // Nem a IA nem o cliente resolvem: é defeito de sistema, e o caminho é
    // investigação humana nossa. O cliente não pode nem saber que existe.
    resolvivelPorIA: false,
    titulo: 'O razão não fecha',
    detalhe:
      `Débito ${BRL(d.razao.debito)} contra crédito ${BRL(d.razao.credito)} — ` +
      `diferença de ${BRL(Math.abs(diff))}.`,
    valor: Math.abs(diff),
    acao:
      'Isto não deveria ser possível: há trigger no banco impedindo partida desbalanceada. ' +
      'Investigar antes de qualquer outra coisa.',
  };
}

/**
 * Despesa sem classificação contábil.
 *
 * Bloqueia acima de um quinto da despesa do mês: um balancete em que 20% do
 * custo está em "Despesas Diversas a Classificar" não é entregável — a DRE
 * sai sem sentido e a contabilidade devolve.
 */
export const LIMITE_SEM_CLASSIFICACAO = 0.2;

function checarClassificacao(d: DadosDoMes): Ocorrencia | null {
  if (d.aClassificar.quantidade === 0) return null;

  // O que decide é o PESO, não a contagem: vinte cafés sem categoria não
  // impedem um fechamento; uma folha de pagamento sozinha impede.
  const proporcao = d.despesaTotal > 0 ? d.aClassificar.valor / d.despesaTotal : 1;
  const grave = proporcao >= LIMITE_SEM_CLASSIFICACAO;

  return {
    id: 'sem_classificacao',
    severidade: grave ? 'BLOQUEIO' : 'ATENCAO',
    // O classificador resolve a partir da descrição do lançamento. Pedir ao
    // cliente que escolha uma conta do Anexo 7 seria transferir a ele o
    // trabalho que a ferramenta existe para fazer.
    resolvivelPorIA: true,
    titulo: 'Despesas sem classificação contábil',
    detalhe:
      `${d.aClassificar.quantidade} lançamento(s), somando ${BRL(d.aClassificar.valor)} ` +
      `(${(proporcao * 100).toFixed(1)}% da despesa do mês), ` +
      `caíram em "Despesas Diversas a Classificar".`,
    quantidade: d.aClassificar.quantidade,
    valor: d.aClassificar.valor,
    documentos: d.aClassificar.documentos.slice(0, 50),
    acao: 'Classificar cada lançamento na categoria correta antes de fechar.',
  };
}

/**
 * Extrato não conciliado.
 *
 * Atenção e não bloqueio: o mês pode fechar com movimento bancário pendente de
 * conciliação — o que não pode é fechar sem que alguém saiba disso, porque é
 * o sintoma mais comum de receita ou despesa faltando na escrituração.
 */
function checarConciliacao(d: DadosDoMes): Ocorrencia | null {
  if (d.extratoPendente.quantidade === 0) return null;
  return {
    id: 'extrato_nao_conciliado',
    severidade: 'ATENCAO',
    resolvivelPorIA: true,
    titulo: 'Movimento bancário não conciliado',
    detalhe:
      `${d.extratoPendente.quantidade} transação(ões) do extrato, somando ${BRL(d.extratoPendente.valor)}, ` +
      'não foram casadas com nenhum lançamento.',
    quantidade: d.extratoPendente.quantidade,
    valor: d.extratoPendente.valor,
    acao: 'Conciliar. Transação sem par costuma ser lançamento que ninguém registrou.',
  };
}

/**
 * Receita sem nota fiscal.
 *
 * Bloqueia: receita reconhecida sem documento fiscal é o problema mais caro
 * que um fechamento pode esconder. Se a receita existe e a nota não, ou falta
 * emitir a nota, ou a receita está errada — e as duas hipóteses precisam ser
 * resolvidas antes de a apuração virar base de imposto.
 */
function checarReceitaSemNota(d: DadosDoMes): Ocorrencia | null {
  if (d.receitaSemNota.quantidade === 0) return null;
  const pct = d.receita > 0 ? (d.receitaSemNota.valor / d.receita) * 100 : 0;
  return {
    id: 'receita_sem_nota',
    severidade: 'BLOQUEIO',
    // A única pergunta que nenhuma IA responde: esse dinheiro entrou com nota
    // ou sem? Só quem prestou o serviço sabe. É o mínimo que a ferramenta
    // precisa exigir — e, por ser o mínimo, tem que ser a ÚNICA coisa exigida.
    resolvivelPorIA: false,
    mensagemCliente:
      `Entrou ${BRL(d.receitaSemNota.valor)} que não encontramos nota fiscal correspondente. ` +
      'Você emitiu a nota por fora do sistema, ou ainda precisa emitir? ' +
      'Sem essa resposta não conseguimos fechar o mês.',
    titulo: 'Receita reconhecida sem nota fiscal',
    detalhe:
      `${d.receitaSemNota.quantidade} lançamento(s) de receita somando ${BRL(d.receitaSemNota.valor)} ` +
      `(${pct.toFixed(1)}% da receita do mês) não têm nota fiscal vinculada.`,
    quantidade: d.receitaSemNota.quantidade,
    valor: d.receitaSemNota.valor,
    documentos: d.receitaSemNota.documentos.slice(0, 50),
    acao: 'Emitir a nota que falta, ou corrigir o lançamento se a receita não existiu.',
  };
}

/**
 * Duplicidade provável.
 *
 * Atenção e não bloqueio de propósito: duas parcelas iguais no mesmo dia é
 * legítimo com frequência. Acusar como erro treinaria o usuário a ignorar o
 * aviso — que é o pior resultado possível para um alerta.
 */
function checarDuplicidades(d: DadosDoMes): Ocorrencia | null {
  if (d.duplicidades.length === 0) return null;
  const total = d.duplicidades.reduce((s, x) => s + x.valor, 0);
  return {
    id: 'possivel_duplicidade',
    severidade: 'ATENCAO',
    resolvivelPorIA: false,
    mensagemCliente:
      `Vimos ${d.duplicidades.length} pagamento(s) repetido(s) — mesmo valor, mesmo dia, mesma pessoa. ` +
      'Foram dois pagamentos mesmo, ou é o mesmo lançado duas vezes?',
    titulo: 'Lançamentos possivelmente duplicados',
    detalhe:
      `${d.duplicidades.length} grupo(s) com mesmo parceiro, valor e vencimento, somando ${BRL(total)}. ` +
      `Ex.: "${d.duplicidades[0]!.descricao}" ${BRL(d.duplicidades[0]!.valor)}.`,
    quantidade: d.duplicidades.length,
    valor: total,
    documentos: d.duplicidades.flatMap((x) => x.ids).slice(0, 50),
    acao: 'Conferir se são parcelas legítimas ou lançamento repetido.',
  };
}

/** Faturamento sem guia provisionada — o imposto do mês não foi apurado. */
function checarGuia(d: DadosDoMes): Ocorrencia | null {
  if (d.receita <= 0 || d.temGuiaDoMes) return null;
  return {
    id: 'guia_nao_provisionada',
    severidade: 'BLOQUEIO',
    // A IA apura sozinha: tem o faturamento, o RBT12 e a faixa do Simples.
    // Perguntar ao cliente quanto de imposto ele deve é o avesso do produto.
    resolvivelPorIA: true,
    titulo: 'Imposto do mês não provisionado',
    detalhe: `Houve ${BRL(d.receita)} de receita e nenhuma guia foi provisionada para o mês.`,
    valor: d.receita,
    acao: 'Apurar e provisionar o DAS antes de fechar.',
  };
}

/**
 * Saldo do razão contra o saldo do banco.
 *
 * É a única verificação que confronta o sistema com o mundo. Todas as outras
 * checam a coerência interna — esta pergunta se a coerência corresponde ao
 * dinheiro que existe.
 */
function checarSaldo(d: DadosDoMes): Ocorrencia | null {
  // Sem extrato ligado, não existe saldo bancário com o que confrontar — e
  // isso é uma lacuna a relatar, não uma divergência a acusar.
  //
  // O caminho oposto seria pior do que inútil: `bank_account.current_balance`
  // é um campo que alguém digita uma vez e ninguém atualiza. Bloquear contra
  // ele faria TODO fechamento travar para sempre, e um bloqueio que sempre
  // aparece é um bloqueio que todo mundo aprende a ignorar — inclusive nos
  // dias em que ele estiver certo.
  if (d.saldoBanco.peloCadastro === null || !d.saldoBanco.temFeed) {
    return {
      id: 'saldo_banco_sem_fonte',
      severidade: 'ATENCAO',
      resolvivelPorIA: false,
      titulo: 'Nada confronta a escrituração com o dinheiro real',
      detalhe:
        `O razão diz ${BRL(d.saldoBanco.peloRazao)} em banco. ` +
        (d.saldoBanco.peloCadastro === null
          ? 'Não há conta bancária cadastrada.'
          : `O cadastro diz ${BRL(d.saldoBanco.peloCadastro)}, mas é um valor digitado, sem extrato ligado.`),
      acao:
        'Conectar o extrato bancário (Open Finance). Todas as outras verificações checam coerência interna; ' +
        'só esta pergunta se a coerência corresponde ao dinheiro que existe.',
    };
  }

  const diff = Math.round((d.saldoBanco.peloRazao - d.saldoBanco.peloCadastro) * 100) / 100;
  if (Math.abs(diff) < 0.01) return null;

  return {
    id: 'saldo_divergente',
    severidade: 'BLOQUEIO',
    resolvivelPorIA: false,
    mensagemCliente:
      'O que registramos não bate com o extrato do banco. ' +
      'Pode ter faltado lançar alguma entrada ou saída — dá uma conferida no mês.',
    titulo: 'Saldo do razão diverge do extrato bancário',
    detalhe:
      `Razão: ${BRL(d.saldoBanco.peloRazao)}. Extrato: ${BRL(d.saldoBanco.peloCadastro)}. ` +
      `Diferença de ${BRL(Math.abs(diff))}.`,
    valor: Math.abs(diff),
    acao: 'Conciliar. A diferença é movimento que existe no banco e não na escrituração, ou o contrário.',
  };
}

/** Mês sem lançamento nenhum — é ausência de dado, não empresa parada. */
function checarMovimento(d: DadosDoMes): Ocorrencia | null {
  if (d.totalLancamentos > 0) return null;
  return {
    id: 'mes_sem_movimento',
    severidade: 'ATENCAO',
    resolvivelPorIA: false,
    mensagemCliente:
      'Não vimos nenhuma movimentação neste mês. Se a empresa não teve entrada nem saída, ' +
      'está tudo certo. Se teve, faltou lançar.',
    titulo: 'Nenhum lançamento no mês',
    detalhe: 'Não há receita nem despesa registrada neste mês de referência.',
    acao:
      'Confirmar se a empresa realmente não movimentou. Mês vazio quase sempre é dado que não chegou, ' +
      'não empresa parada.',
  };
}

const VERIFICACOES = [
  checarRazao,
  checarClassificacao,
  checarConciliacao,
  checarReceitaSemNota,
  checarDuplicidades,
  checarGuia,
  checarSaldo,
  checarMovimento,
];

export interface ResultadoFechamento {
  referenceMonth: string;
  podeFechar: boolean;
  ocorrencias: Ocorrencia[];
  bloqueios: Ocorrencia[];
  atencoes: Ocorrencia[];
  /**
   * O que a IA vai resolver sozinha, sem incomodar ninguém. O cliente não vê
   * esta lista — ela existe para o agente saber o que fazer e para o contador
   * conferir depois que foi feito.
   */
  resolverSozinha: Ocorrencia[];
  /**
   * O que só o cliente responde. É a lista que vira tela para ele, e cada item
   * a mais aqui é um motivo a mais para ele abandonar a ferramenta.
   */
  precisaDoCliente: Ocorrencia[];
  /** Frase única para quem só vai ler o título. */
  resumo: string;
  /**
   * O que dizer ao cliente, na língua dele. `null` quando não há nada a
   * pedir — que é o caso normal e o objetivo do produto.
   */
  recadoAoCliente: string | null;
}

/**
 * Roda todas as verificações e decide se o mês pode fechar.
 *
 * A decisão é mecânica: existe bloqueio, não fecha. Não há ponderação, nem
 * "bloqueio pequeno". Foi assim de propósito — no momento em que fechar passa
 * a depender de julgamento, ele passa a depender de quem está com pressa.
 */
export function verificarFechamento(d: DadosDoMes): ResultadoFechamento {
  const ocorrencias = VERIFICACOES.map((f) => f(d)).filter((o): o is Ocorrencia => o !== null);

  const bloqueios = ocorrencias.filter((o) => o.severidade === 'BLOQUEIO');
  const atencoes = ocorrencias.filter((o) => o.severidade === 'ATENCAO');
  const resolverSozinha = ocorrencias.filter((o) => o.resolvivelPorIA);
  const precisaDoCliente = ocorrencias.filter((o) => !o.resolvivelPorIA && o.mensagemCliente);

  const podeFechar = bloqueios.length === 0;

  const resumo = podeFechar
    ? atencoes.length
      ? `Mês pode fechar, com ${atencoes.length} ponto(s) de atenção.`
      : 'Mês conferido, sem pendências.'
    : `Mês NÃO pode fechar: ${bloqueios.length} bloqueio(s) — ${bloqueios.map((b) => b.titulo.toLowerCase()).join('; ')}.`;

  // Só o que bloqueia vira pedido. Pendência que não impede o fechamento não
  // merece interromper alguém que está tocando uma empresa — avisar por
  // avisar treina o cliente a ignorar todo aviso, inclusive o que importa.
  const pedidos = precisaDoCliente.filter((o) => o.severidade === 'BLOQUEIO');
  const recadoAoCliente = pedidos.length
    ? pedidos.map((o) => o.mensagemCliente!).join('\n\n')
    : null;

  return {
    referenceMonth: d.referenceMonth,
    podeFechar,
    ocorrencias,
    bloqueios,
    atencoes,
    resolverSozinha,
    precisaDoCliente,
    resumo,
    recadoAoCliente,
  };
}
