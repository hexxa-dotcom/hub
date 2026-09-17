import { ACCOUNTS } from './chart-of-accounts';

/**
 * DE-PARA: plano do Hub (ITG 1000, Anexo 7) → plano do OneFlow.
 *
 * Os dois planos têm esqueleto parecido e numeração diferente a partir do
 * terceiro nível. O Hub segue a norma do CFC; o OneFlow tem padrão comercial
 * próprio, com grupos separados para Custo (4) e Despesa (5).
 *
 * Mantivemos o Anexo 7 no Hub porque é o que a ITG 1000 determina — e porque
 * o plano do OneFlow não tem onde lançar tributo sobre o lucro nem dedução da
 * receita bruta, que a norma exige separados. A tradução acontece só na saída.
 *
 * Duas particularidades do OneFlow que este módulo precisa respeitar:
 *
 * 1. **Conta "por participante"** — algumas sintéticas (banco, cliente,
 *    fornecedor) aceitam lançamento se você informar o CNPJ; o OneFlow cria a
 *    analítica sozinho. Marcadas com `exigeParticipante`.
 *
 * 2. **Conta "totalizadora"** — só agrupa, recusa lançamento. É preciso usar
 *    a filha analítica. O de-para já aponta para a filha.
 */

export interface DestinoOneflow {
  /** Classificação no plano do OneFlow. */
  classificacao: string;
  /**
   * A conta exige CNPJ de cliente/fornecedor na partida. Sem ele o OneFlow
   * recusa com "Conta Contábil identificada por participante".
   */
  exigeParticipante?: boolean;
  /** Por que este destino, quando não é óbvio. */
  nota?: string;
}

/**
 * Mapa explícito, conta a conta.
 *
 * Deliberadamente escrito à mão e não derivado por heurística: casar plano de
 * contas por semelhança de nome erra em silêncio, e o erro só aparece no
 * balanço. Uma conta sem entrada aqui faz a conversão FALHAR — que é o
 * comportamento certo.
 */
export const DE_PARA_ONEFLOW: Record<string, DestinoOneflow> = {
  /* ── Ativo ───────────────────────────────────────────────────────────── */
  [ACCOUNTS.CAIXA]: { classificacao: '1.1.1.01.00001', nota: 'Caixinha' },
  [ACCOUNTS.BANCOS]: {
    classificacao: '1.1.1.02',
    exigeParticipante: true,
    nota: 'Banco Conta Corrente — o OneFlow cria a analítica por banco',
  },
  [ACCOUNTS.CLIENTES]: { classificacao: '1.1.2.01.00001' },
  [ACCOUNTS.ADIANTAMENTO_FORNECEDOR]: { classificacao: '5.1.1.05.00003' },
  [ACCOUNTS.IMPOSTOS_A_RECUPERAR]: { classificacao: '1.1.5.01', exigeParticipante: false },

  /* ── Passivo ─────────────────────────────────────────────────────────── */
  [ACCOUNTS.FORNECEDORES]: { classificacao: '2.1.1.01.00001' },
  [ACCOUNTS.DAS_A_RECOLHER]: { classificacao: '2.1.2.01.00001', nota: 'Simples Nacional a Recolher' },
  [ACCOUNTS.IMPOSTOS_A_RECOLHER]: { classificacao: '2.1.2.01.00001' },
  [ACCOUNTS.SALARIOS_A_PAGAR]: { classificacao: '2.1.1.05', nota: 'Outras Contas a Pagar' },
  [ACCOUNTS.ENCARGOS_A_RECOLHER]: { classificacao: '2.1.2.01.00001' },

  /* ── Patrimônio líquido ──────────────────────────────────────────────── */
  [ACCOUNTS.CAPITAL_SOCIAL]: { classificacao: '2.3.1.01.00001' },
  [ACCOUNTS.CAPITAL_A_INTEGRALIZAR]: { classificacao: '2.3.1.01.00002' },
  [ACCOUNTS.LUCROS_ACUMULADOS]: { classificacao: '2.3.1.03.00002' },
  [ACCOUNTS.RESULTADO_DO_EXERCICIO]: { classificacao: '2.3.1.02.00003' },

  /* ── Receita ─────────────────────────────────────────────────────────── */
  [ACCOUNTS.RECEITA_SERVICOS]: { classificacao: '3.1.1.01.00002', nota: 'Clientes - Serviços Prestados' },

  /* ── Resultado financeiro ────────────────────────────────────────────── */
  [ACCOUNTS.JUROS_PASSIVOS]: { classificacao: '5.2.1.01.00001' },
  [ACCOUNTS.DESPESA_BANCARIA]: { classificacao: '5.2.1.04.00003' },
  [ACCOUNTS.DESCONTOS_CONCEDIDOS]: { classificacao: '5.2.1.03.00001' },
  [ACCOUNTS.JUROS_ATIVOS]: { classificacao: '5.2.2.01.00001' },
  [ACCOUNTS.DESCONTOS_OBTIDOS]: { classificacao: '5.2.2.03.00001' },

  /* ── Pessoal ─────────────────────────────────────────────────────────── */
  [ACCOUNTS.DESPESA_PESSOAL]: { classificacao: '5.1.1.02.00001', nota: 'Salários' },

  /* ── Despesas Gerais (Anexo 7, 3.3.2.02) → Administrativas do OneFlow ── */
  '3.3.2.02.01': { classificacao: '5.1.1.01.00001', nota: 'Aluguel' },
  '3.3.2.02.02': { classificacao: '5.1.1.01.00002', nota: 'Condomínio' },
  '3.3.2.02.04': { classificacao: '5.1.2.01.00001', nota: 'Depreciação' },
  '3.3.2.02.05': { classificacao: '5.1.2.02.00001', nota: 'Amortização' },
  [ACCOUNTS.SERVICOS_PROFISSIONAIS]: { classificacao: '5.1.1.01.00010', nota: 'Contabilidade / serviços' },
  '3.3.2.02.07': { classificacao: '5.1.1.01.00004', nota: 'Energia Elétrica' },
  '3.3.2.02.08': { classificacao: '5.1.1.01.00003', nota: 'Água e Esgoto' },
  '3.3.2.02.09': { classificacao: '5.1.1.01.00005', nota: 'Telefonia' },
  '3.3.2.02.11': { classificacao: '5.1.1.01.00008', nota: 'Seguros' },
  '3.3.2.02.12': { classificacao: '5.2.1.02.00001', nota: 'Multas Pagas' },
  '3.3.2.02.14': { classificacao: '5.1.1.01.00006', nota: 'Material de Escritório' },
  /**
   * Software e assinaturas (SaaS) — categoria que o Anexo 7 não nomeia, mas
   * que o seed do sistema criou porque é a maior despesa de uma prestadora de
   * serviço digital. No OneFlow cai em Utilidades e Serviços, que é o grupo
   * das despesas administrativas de infraestrutura.
   */
  /**
   * Software e assinaturas → Compra de Serviços (grupo 4, CUSTO).
   *
   * A primeira versão mandava para Telefonia, que é o tipo de aproximação por
   * semelhança que este módulo diz não fazer. O erro chegou ao balanço: R$ 10,8
   * mil — quase toda a despesa da HEXX — apareceram como conta de telefone.
   *
   * `Compra de Serviços` é a única conta do plano do OneFlow que nomeia
   * serviço contratado de terceiro de forma genérica, e está no grupo de CUSTO:
   * é o que a empresa gasta para ENTREGAR o serviço que vende, não para
   * existir. Para uma contabilidade digital, NIBO e OneFlow são exatamente
   * isso — a ferramenta com que o serviço é prestado.
   *
   * A distinção muda a margem bruta, e para melhor: passa a mostrar quanto
   * sobra da receita depois do que custou entregá-la.
   */
  '3.3.2.02.15': { classificacao: '4.1.2.01.00001', nota: 'Compra de Serviços (custo)' },
  '3.3.2.02.03': { classificacao: '5.1.1.05.00002', nota: 'Despesas com Veículos → Viagens' },
  [ACCOUNTS.ENCARGOS_PESSOAL]: { classificacao: '5.1.1.02.00006', nota: 'INSS' },
};

/**
 * Contas do Hub que NÃO têm destino no plano padrão do OneFlow.
 *
 * Não são esquecimento: são contas que a ITG 1000 exige e o plano comercial do
 * OneFlow não traz. Precisam ser criadas lá, uma vez, na tela — a API do
 * OneFlow só lê plano de contas, não cria.
 *
 * Enquanto não existirem, qualquer mês com faturamento ou distribuição de
 * lucro não consegue ser enviado. Por isso a lista vive aqui, com o nome e o
 * lugar sugerido de cada uma.
 */
export const CONTAS_A_CRIAR_NO_ONEFLOW: {
  contaDoHub: string;
  nome: string;
  sugestaoDePai: string;
  natureza: 'devedora' | 'credora';
  porque: string;
}[] = [
  {
    contaDoHub: ACCOUNTS.IMPOSTO_SIMPLES,
    nome: 'Simples Nacional (DAS)',
    sugestaoDePai: '3.1.2.01 (-) Impostos sobre Vendas',
    natureza: 'devedora',
    porque:
      'A ITG 1000 (Anexo 3) põe tributo sobre receita como DEDUÇÃO da receita bruta. ' +
      'O OneFlow tem só a sintética 3.1.2.01, sem analítica — e sintética recusa lançamento.',
  },
  {
    contaDoHub: ACCOUNTS.IMPOSTO_PIS,
    nome: 'PIS s/ Faturamento',
    sugestaoDePai: '3.1.2.01 (-) Impostos sobre Vendas',
    natureza: 'devedora',
    porque: 'Componente do DAS que a norma manda deduzir da receita bruta.',
  },
  {
    contaDoHub: ACCOUNTS.IMPOSTO_COFINS,
    nome: 'COFINS s/ Faturamento',
    sugestaoDePai: '3.1.2.01 (-) Impostos sobre Vendas',
    natureza: 'devedora',
    porque: 'Componente do DAS que a norma manda deduzir da receita bruta.',
  },
  {
    contaDoHub: ACCOUNTS.IMPOSTO_ISS,
    nome: 'ISS',
    sugestaoDePai: '3.1.2.01 (-) Impostos sobre Vendas',
    natureza: 'devedora',
    porque: 'Componente do DAS que a norma manda deduzir da receita bruta.',
  },
  {
    contaDoHub: ACCOUNTS.IRPJ,
    nome: 'IRPJ Corrente',
    sugestaoDePai: '5.1.1.04 Despesas Tributárias',
    natureza: 'devedora',
    porque:
      'Tributo sobre o LUCRO: a ITG 1000 o põe depois do resultado financeiro, ' +
      'não como dedução de receita. O plano do OneFlow não tem grupo para isso.',
  },
  {
    contaDoHub: ACCOUNTS.CSLL,
    nome: 'CSLL Corrente',
    sugestaoDePai: '5.1.1.04 Despesas Tributárias',
    natureza: 'devedora',
    porque: 'Mesma razão do IRPJ.',
  },
  {
    contaDoHub: ACCOUNTS.LUCROS_A_PAGAR,
    nome: 'Lucros a Pagar',
    sugestaoDePai: '2.1.1.05 Outras Contas a Pagar',
    natureza: 'credora',
    porque:
      'ITG 1000, Anexo 7: "2.1.6.01 Obrigações com Sócios → Lucros a Pagar". ' +
      'Só importa quando o lucro é declarado num mês e pago em outro.',
  },
];

/**
 * Traduz uma conta do Hub. `null` quando não há destino mapeado.
 *
 * REGRA: sem correspondência HONESTA, devolve `null` e a partida fica retida.
 * Nunca "a conta mais parecida".
 *
 * Isso não é rigor decorativo. Foi exatamente a aproximação por semelhança que
 * mandou R$ 10,8 mil de software para a conta de Telefonia, e o erro só
 * apareceu quando alguém leu o balancete — porque nada no caminho reclamou.
 * Partida retida com o nome da conta faltando é visível; partida na conta
 * errada parece certa.
 */
export function traduzirConta(codigoDoHub: string): DestinoOneflow | null {
  return DE_PARA_ONEFLOW[codigoDoHub] ?? null;
}

/**
 * Quais contas de um conjunto ainda não têm destino.
 *
 * É o que o ensaio de envio usa para produzir a lista exata do que criar no
 * OneFlow, em vez de descobrir uma conta faltando por vez a cada tentativa.
 */
export function contasSemDestino(codigosDoHub: string[]): {
  codigo: string;
  aCriar: (typeof CONTAS_A_CRIAR_NO_ONEFLOW)[number] | null;
}[] {
  const vistos = new Set<string>();
  const out: { codigo: string; aCriar: (typeof CONTAS_A_CRIAR_NO_ONEFLOW)[number] | null }[] = [];

  for (const c of codigosDoHub) {
    if (vistos.has(c) || traduzirConta(c)) continue;
    vistos.add(c);
    out.push({ codigo: c, aCriar: CONTAS_A_CRIAR_NO_ONEFLOW.find((x) => x.contaDoHub === c) ?? null });
  }
  return out;
}
