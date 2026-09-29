import { ACCOUNTS } from './chart-of-accounts';

/**
 * DE-PARA: plano da Hexx (ITG 1000, Anexo 7) → plano do OneFlow.
 *
 * Os dois planos têm esqueleto parecido e numeração diferente a partir do
 * terceiro nível. A Hexx segue a norma do CFC; o OneFlow tem padrão comercial
 * próprio, com grupos separados para Custo (4) e Despesa (5).
 *
 * Mantivemos o Anexo 7 na Hexx porque é o que a ITG 1000 determina — e porque
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
  /**
   * A conta é "por participante" de um lado fixo: Fornecedores sempre com
   * `cnpjForn`, Clientes sempre com `cnpjCli` — débito ou crédito. Sem o
   * CNPJ do parceiro a partida fica retida (nunca vai com o da própria
   * empresa: criaria no livro de lá um fornecedor que é a empresa).
   */
  participante?: 'cliente' | 'fornecedor';
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
 * Contas da Hexx que NÃO têm destino no plano padrão do OneFlow.
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
 * Traduz uma conta da Hexx. `null` quando não há destino mapeado.
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
/** O plano PADRÃO do OneFlow é o do sistema (decisão de 28/09/2026); o Dinâmico só para quem ainda está nele. */
export function traduzirConta(codigoDoHub: string, plano: PlanoOneflow = 'PADRAO'): DestinoOneflow | null {
  return (plano === 'PADRAO' ? DE_PARA_ONEFLOW_PADRAO : DE_PARA_ONEFLOW)[codigoDoHub] ?? null;
}

/** Qual modelo de plano a empresa usa no OneFlow — decide o de-para. */
export type PlanoOneflow = 'DINAMICO' | 'PADRAO';

/** O modelo pelo nome que o OneFlow devolve em `nomeModelo` ("Plano de Contas Padrão OneFlow"…). */
export function planoPeloNome(nomeModelo: string | null | undefined): PlanoOneflow | null {
  if (!nomeModelo) return null;
  if (/din.mico/i.test(nomeModelo)) return 'DINAMICO';
  if (/padr.o/i.test(nomeModelo)) return 'PADRAO';
  return null;
}

/**
 * DE-PARA para o PLANO DE CONTAS PADRÃO ONEFLOW (766 contas).
 *
 * Analisado em 28/09/2026 contra o plano real da Gateway: o Padrão é mais
 * completo que o Dinâmico e casa com o Hub (ITG 1000) conta por conta —
 * tem dedução da receita por tributo, Provisões de IRPJ/CSLL, Pró-labore e
 * Pró-labore a Pagar, INSS e FGTS a Recolher separados e Dividendos a Pagar,
 * que no Dinâmico não existem. Mesma regra do outro mapa: só destino exato;
 * o que não tem par fica retido, nunca "o mais parecido".
 */
export const DE_PARA_ONEFLOW_PADRAO: Record<string, DestinoOneflow> = {
  /* ── Ativo ───────────────────────────────────────────────────────────── */
  '1.1.01.001': { classificacao: '1.1.01.001.001', nota: 'Caixa' },
  /**
   * Banco: no Padrão a conta é uma por banco (ex.: "1.1.01.003.001 Unicred"
   * na Gateway). A sintética com o CNPJ do participante é o mesmo caminho que
   * funciona no Dinâmico — conferido no primeiro envio real.
   */
  '1.1.01.002': { classificacao: '1.1.01.003', exigeParticipante: true, nota: 'Banco Conta Movimento' },
  '1.1.01.003': { classificacao: '1.1.01.005.007', nota: 'Aplicações - Renda Fixa' },
  '1.1.02.001': { classificacao: '1.1.02.001', participante: 'cliente', nota: 'Clientes Nacionais' },
  '1.1.03.001': { classificacao: '1.1.02.007.004', participante: 'fornecedor', nota: 'Adiantamentos a Fornecedores Nacionais' },
  '1.1.03.002': { classificacao: '1.1.02.009.006', nota: 'Adiantamentos de Salários' },
  '1.1.05.001': { classificacao: '1.1.02.013.014', nota: 'Mercadorias para Revenda' },
  '1.2.03.001': { classificacao: '1.2.05.001.004', nota: 'Imóveis' },
  '1.2.03.002': { classificacao: '1.2.05.003.010', nota: 'Máquinas e Equipamentos' },
  '1.2.03.003': { classificacao: '1.2.05.003.002', nota: 'Móveis e Utensílios' },
  '1.2.03.004': { classificacao: '1.2.05.003.001', nota: 'Veículos' },
  '1.2.03.005': { classificacao: '1.2.05.003.008', nota: 'Computadores e Periféricos' },
  '1.2.04.001': { classificacao: '1.2.06.001.003', nota: 'Licença de Uso de Software' },
  '1.2.04.099': { classificacao: '1.2.06.002.001', nota: '(-) Amortiz. Lic. de Uso de Software' },

  /* ── Passivo ─────────────────────────────────────────────────────────── */
  // Visto em 28/09/2026: "Conta Contábil identificada por participante, sem informar o fornecedor [2.1.01.001]".
  '2.1.01.001': { classificacao: '2.1.01.001', participante: 'fornecedor', nota: 'Fornecedores Nacionais' },
  '2.1.02.001': { classificacao: '2.1.05.003.005', nota: 'Salários e Ordenados a Pagar' },
  // No Hub, "Encargos a recolher" recebe o INSS retido da folha (accrueFolha) e a DCTFWeb.
  '2.1.02.002': { classificacao: '2.1.05.003.010', nota: 'Inss a Recolher' },
  '2.1.02.003': { classificacao: '2.1.05.003.006', nota: 'Pró Labore a Pagar' },
  // No Hub, "Impostos a recolher" recebe o IRRF retido da folha e as guias fora do DAS.
  '2.1.03.001': { classificacao: '2.1.05.001.010', nota: 'Irrf Retido a Recolher' },
  '2.1.03.002': { classificacao: '2.1.05.001.002', nota: 'Simples a Recolher' },
  '2.1.04.001': { classificacao: '2.1.09.001', nota: 'Dividendos a Pagar (Obrigações com Sócios)' },
  '2.1.05.001': { classificacao: '2.1.06.001.002', participante: 'cliente', nota: 'Adiantamentos de Clientes' },
  '2.1.05.003': { classificacao: '2.1.06.001.006', nota: 'Contas a Pagar' },

  /* ── Patrimônio líquido ──────────────────────────────────────────────── */
  '2.3.01.001': { classificacao: '2.3.01.001.001', nota: 'Capital Social' },
  '2.3.01.002': { classificacao: '2.3.01.001.002', nota: '(-) Capital a Integralizar' },
  '2.3.04.001': { classificacao: '2.3.01.005.002', nota: 'Lucros Acumulados' },
  '2.3.05.001': { classificacao: '2.3.01.004.003', nota: 'Lucros do Exercício' },

  /* ── Receita e deduções (serviços) ───────────────────────────────────── */
  '3.1.1.01.01': { classificacao: '3.1.01.007.001.001', nota: 'Serviços Prestados a Terceiros - Mercado Interno' },
  '3.1.2.01.01': { classificacao: '3.1.01.007.002.004', nota: '(-) Pis sobre serviços' },
  '3.1.2.01.02': { classificacao: '3.1.01.007.002.003', nota: '(-) Cofins sobre serviços' },
  '3.1.2.01.03': { classificacao: '3.1.01.007.002.005', nota: '(-) Iss sobre serviços' },
  '3.1.2.01.05': { classificacao: '3.1.01.007.002.001', nota: '(-) Simples Nacional sobre serviços' },

  /* ── Tributos sobre o lucro ──────────────────────────────────────────── */
  '3.8.1.01.01': { classificacao: '5.9.01.001.001', nota: 'Provisão IRPJ' },
  '3.8.1.01.02': { classificacao: '5.9.01.001.002', nota: 'Provisão CSLL' },

  /* ── Pessoal ─────────────────────────────────────────────────────────── */
  '3.3.2.01.01': { classificacao: '5.1.01.001.001.009', nota: 'Salários e Ordenados' },
  '3.3.2.01.02': { classificacao: '5.1.01.001.001.008', nota: 'Pró Labore' },
  '3.3.2.01.05': { classificacao: '5.1.01.001.001.011', nota: 'Inss' },

  /* ── Despesas administrativas ────────────────────────────────────────── */
  '3.3.2.02.01': { classificacao: '5.1.01.004.001.012', nota: 'Aluguéis de Imóveis' },
  '3.3.2.02.02': { classificacao: '5.1.01.004.001.011', nota: 'Despesas com Condomínio' },
  '3.3.2.02.03': { classificacao: '5.1.01.006.001.020', nota: 'Despesas c/ Veículos' },
  // O Padrão põe depreciação e amortização no grupo de custos (4.9) — é a escolha do plano deles.
  '3.3.2.02.04': { classificacao: '4.9.01.001.001.003', nota: 'Depreciações' },
  '3.3.2.02.05': { classificacao: '4.9.01.001.001.002', nota: 'Amortizações' },
  '3.3.2.02.06': { classificacao: '5.1.01.006.001.008', nota: 'Serviços de Terceiros' },
  '3.3.2.02.07': { classificacao: '5.1.01.004.001.003', nota: 'Energia Elétrica' },
  '3.3.2.02.08': { classificacao: '5.1.01.004.001.002', nota: 'Água e Esgoto' },
  '3.3.2.02.09': { classificacao: '5.1.01.004.001.007', nota: 'Telefonia' },
  '3.3.2.02.10': { classificacao: '5.1.01.006.001.019', nota: 'Correios' },
  '3.3.2.02.11': { classificacao: '5.1.01.0002.001.045', nota: 'Seguro de Bens' },
  '3.3.2.02.12': { classificacao: '5.1.01.007.001.007', nota: 'Multas de Mora' },
  '3.3.2.02.13': { classificacao: '5.1.01.0002.001.054', nota: 'Bens de Pequeno Valor' },
  '3.3.2.02.14': { classificacao: '5.1.01.0002.001.015', nota: 'Material de Escritório' },
  // Software e assinaturas: no Padrão há conta própria de informática — despesa, não custo.
  '3.3.2.02.15': { classificacao: '5.1.01.0002.001.008', nota: 'Despesas com Informática' },
  '3.3.1.02.01': { classificacao: '5.1.01.006.001.018', nota: 'Comissões s/Vendas - PJ' },
  '3.3.1.02.02': { classificacao: '5.1.01.0002.001.038', nota: 'Propaganda e Publicidade' },
  '3.3.1.02.03': { classificacao: '5.1.01.006.001.014', nota: 'Serviços Gráficos (material promocional impresso)' },
  '3.3.2.02.16': { classificacao: '5.1.01.0002.001.043', nota: 'Lanches, Refeições' },
  '3.3.2.02.17': { classificacao: '5.1.01.0002.001.033', nota: 'Material de Consumo' },
  '3.3.2.02.18': { classificacao: '5.1.01.0002.001.050', nota: 'Viagens e Estadias' },
  '3.3.2.02.19': { classificacao: '5.1.01.0002.001.046', nota: 'Combustíveis e Lubrificantes' },
  '3.3.2.03.01': { classificacao: '5.1.01.0003.001.007', nota: 'Impostos e Taxas Diversas' },

  /* ── Resultado financeiro ────────────────────────────────────────────── */
  '3.4.1.01.01': { classificacao: '5.1.01.007.001.001', nota: 'Juros Passivos' },
  '3.4.1.01.02': { classificacao: '5.1.01.007.001.004', nota: 'Despesas Bancárias Diversas' },
  '3.4.1.01.04': { classificacao: '5.1.01.007.001.005', nota: 'Descontos Concedidos' },
  '3.4.1.02.02': { classificacao: '3.1.02.001.001.007', nota: 'Juros Ativos' },
  '3.4.1.02.03': { classificacao: '3.2.01.001.002.004', nota: 'Descontos Obtidos' },
};

/**
 * Quais contas de um conjunto ainda não têm destino.
 *
 * É o que o ensaio de envio usa para produzir a lista exata do que criar no
 * OneFlow, em vez de descobrir uma conta faltando por vez a cada tentativa.
 */
export function contasSemDestino(codigosDoHub: string[], plano: PlanoOneflow = 'PADRAO'): {
  codigo: string;
  aCriar: (typeof CONTAS_A_CRIAR_NO_ONEFLOW)[number] | null;
}[] {
  const vistos = new Set<string>();
  const out: { codigo: string; aCriar: (typeof CONTAS_A_CRIAR_NO_ONEFLOW)[number] | null }[] = [];

  for (const c of codigosDoHub) {
    if (vistos.has(c) || traduzirConta(c, plano)) continue;
    vistos.add(c);
    out.push({ codigo: c, aCriar: CONTAS_A_CRIAR_NO_ONEFLOW.find((x) => x.contaDoHub === c) ?? null });
  }
  return out;
}
