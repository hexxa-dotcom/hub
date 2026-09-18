/**
 * PLANO DE CONTAS PADRÃO — grupos 1 (Ativo), 2 (Passivo e PL) e as contas de
 * resultado (grupo 3) que a escrituração precisa nomear diretamente.
 *
 * Numeração do ANEXO 7 da ITG 1000 (CFC, Resolução 1.418/2012, redação de
 * 15/12/2022). É a mesma base de `seed-categories-anexo7.ts`, que cobriu só o
 * grupo 3 e registrou no próprio comentário que o restante ficaria "pra
 * quando o Hub tiver escrituração contábil de verdade". É agora.
 *
 * As contas de resultado NÃO são repetidas aqui em massa: elas entram no
 * plano derivadas do `accountingCode` das categorias já cadastradas da
 * empresa (ver `deriveResultAccounts`), para que categoria gerencial e conta
 * contábil não divirjam com o tempo. Só as poucas contas de resultado que a
 * escrituração referencia por nome fixo — imposto sobre faturamento, receita
 * de serviço, despesa bancária — aparecem na lista abaixo, como garantia de
 * que existem mesmo numa empresa sem categoria nenhuma.
 */

export type AccountType = 'ATIVO' | 'PASSIVO' | 'PATRIMONIO_LIQUIDO' | 'RECEITA' | 'DESPESA';
export type AccountNature = 'DEBIT' | 'CREDIT';

export interface AccountSeed {
  code: string;
  name: string;
  type: AccountType;
  /** Sintética agrupa; analítica recebe lançamento. */
  analytical: boolean;
}

/**
 * Natureza derivada do grupo, não declarada conta a conta: Ativo e Despesa
 * são devedoras, Passivo, PL e Receita são credoras. Declarar isso em cada
 * linha seria 80 oportunidades de errar uma.
 */
export function natureOf(type: AccountType): AccountNature {
  return type === 'ATIVO' || type === 'DESPESA' ? 'DEBIT' : 'CREDIT';
}

/** Conta imediatamente acima na hierarquia: '1.1.02.001' → '1.1.02'. */
export function parentCodeOf(code: string): string | null {
  const parts = code.split('.');
  return parts.length <= 1 ? null : parts.slice(0, -1).join('.');
}

/* ── Contas que a escrituração referencia por código fixo ──────────────────
 *
 * Toda regra de lançamento em `ledger-posting.service.ts` cita uma destas.
 * Mudar um código aqui quebra as regras de propósito — é melhor que a partida
 * falhe do que ser lançada numa conta errada em silêncio.
 */
export const ACCOUNTS = {
  CAIXA: '1.1.01.001',
  BANCOS: '1.1.01.002',
  CLIENTES: '1.1.02.001',
  ADIANTAMENTO_FORNECEDOR: '1.1.03.001',
  IMPOSTOS_A_RECUPERAR: '1.1.04.001',
  /**
   * TRANSITÓRIA do extrato bancário. Tem que estar zerada no fechamento.
   *
   * Movimento bancário que ainda não se sabe o que é. Diferente de uma nota
   * sem classificação — que pode esperar, porque é competência —, o dinheiro
   * do extrato JÁ saiu da conta: não lançar faria o saldo do razão divergir do
   * saldo real do banco, e a conciliação inteira perderia o sentido.
   *
   * Então lança-se aqui, o caixa bate, e o mês NÃO FECHA enquanto sobrar
   * saldo. É uma fila com alarme, não um balde: a ITG 1000 não tem conta "a
   * classificar", e deixá-la com saldo num balanço entregue seria esconder o
   * problema em vez de mostrá-lo.
   */
  VALORES_A_CLASSIFICAR: '1.1.09.001',

  FORNECEDORES: '2.1.01.001',
  SALARIOS_A_PAGAR: '2.1.02.001',
  ENCARGOS_A_RECOLHER: '2.1.02.002',
  /** Pró-labore é obrigação trabalhista com conta própria no Anexo 7. */
  PRO_LABORE_A_PAGAR: '2.1.02.003',
  IMPOSTOS_A_RECOLHER: '2.1.03.001',
  /** ITG 1000 chama de "Lucros a Pagar", sob Obrigações com Sócios. */
  LUCROS_A_PAGAR: '2.1.04.001',
  ADIANTAMENTO_CLIENTE: '2.1.05.001',
  /**
   * Descontos de folha que o recibo não discrimina (assistência, sindical,
   * vale). Existe para o resíduo ser NOMEADO em vez de somado a um encargo
   * que não é dele — e o relatório da importação sempre o aponta.
   */
  OUTRAS_OBRIGACOES: '2.1.05.003',

  CAPITAL_SOCIAL: '2.3.01.001',
  CAPITAL_A_INTEGRALIZAR: '2.3.01.002',
  LUCROS_ACUMULADOS: '2.3.04.001',
  RESULTADO_DO_EXERCICIO: '2.3.05.001',

  RECEITA_SERVICOS: '3.1.1.01.01',

  /* ── Deduções da receita bruta (ITG 1000, Anexo 7 § 3.1.2.01) ──────────
   *
   * O DAS não é um tributo: é uma guia que embute vários. A ITG 1000 manda
   * PIS, COFINS, ISS e ICMS para dedução da receita bruta, IRPJ e CSLL para
   * tributos sobre o LUCRO (abaixo da linha) e a CPP para despesa com
   * pessoal. Lançar a guia inteira como dedução infla a dedução, some com o
   * IRPJ da DRE e distorce a margem — era o que o sistema fazia.
   */
  IMPOSTO_PIS: '3.1.2.01.01',
  IMPOSTO_COFINS: '3.1.2.01.02',
  IMPOSTO_ISS: '3.1.2.01.03',
  IMPOSTO_ICMS: '3.1.2.01.04',
  IMPOSTO_SIMPLES: '3.1.2.01.05',
  IMPOSTO_OUTROS: '3.1.2.01.99',

  /** Tributos sobre o lucro — vêm DEPOIS do resultado financeiro na DRE. */
  IRPJ: '3.8.1.01.01',
  CSLL: '3.8.1.01.02',
  DESPESA_PESSOAL: '3.3.2.01.01',
  /**
   * Pró-labore é remuneração de SÓCIO, não salário de empregado.
   *
   * Conta própria porque a ITG 1000 as separa na DRE e porque o Fator R do
   * Simples soma as duas — somá-las numa linha só esconderia de qual delas
   * veio a folha, que é a pergunta quando o Fator R fica perto de 28%.
   */
  PRO_LABORE: '3.3.2.01.02',
  /** CPP (INSS patronal) embutida no DAS — encargo, não dedução de receita. */
  ENCARGOS_PESSOAL: '3.3.2.01.05',
  /**
   * Conta usada quando a descrição não permite escolher outra.
   *
   * A ITG 1000 NÃO tem conta "a classificar" — o Anexo 7 nomeia todas as 14
   * Despesas Gerais. O balde era invenção nossa e produzia balanço de perna
   * quebrada: um terço da despesa numa linha que não diz nada.
   *
   * Agora lançamento sem conta resolvível NÃO é escriturado: fica pendente,
   * visível, e vai para a fila do contador. Documento sem classificação não
   * entra no razão — é assim que a contabilidade sempre funcionou.
   */
  SERVICOS_PROFISSIONAIS: '3.3.2.02.06',

  JUROS_PASSIVOS: '3.4.1.01.01',
  DESPESA_BANCARIA: '3.4.1.01.02',
  DESCONTOS_CONCEDIDOS: '3.4.1.01.04',
  JUROS_ATIVOS: '3.4.1.02.02',
  DESCONTOS_OBTIDOS: '3.4.1.02.03',

  DAS_A_RECOLHER: '2.1.03.002',
} as const;

export const DEFAULT_CHART: AccountSeed[] = [
  /* ── 1. ATIVO ─────────────────────────────────────────────────────────── */
  { code: '1', name: 'Ativo', type: 'ATIVO', analytical: false },
  { code: '1.1', name: 'Ativo Circulante', type: 'ATIVO', analytical: false },

  { code: '1.1.01', name: 'Caixa e Equivalentes de Caixa', type: 'ATIVO', analytical: false },
  { code: ACCOUNTS.CAIXA, name: 'Caixa', type: 'ATIVO', analytical: true },
  { code: ACCOUNTS.BANCOS, name: 'Bancos Conta Movimento', type: 'ATIVO', analytical: true },
  { code: '1.1.01.003', name: 'Aplicações de Liquidez Imediata', type: 'ATIVO', analytical: true },

  { code: '1.1.02', name: 'Contas a Receber', type: 'ATIVO', analytical: false },
  { code: ACCOUNTS.CLIENTES, name: 'Clientes', type: 'ATIVO', analytical: true },
  { code: '1.1.02.002', name: '(-) Perdas Estimadas com Créditos de Liquidação Duvidosa', type: 'ATIVO', analytical: true },

  { code: '1.1.03', name: 'Adiantamentos', type: 'ATIVO', analytical: false },
  { code: ACCOUNTS.ADIANTAMENTO_FORNECEDOR, name: 'Adiantamentos a Fornecedores', type: 'ATIVO', analytical: true },
  { code: '1.1.03.002', name: 'Adiantamentos a Empregados', type: 'ATIVO', analytical: true },

  { code: '1.1.04', name: 'Tributos a Recuperar', type: 'ATIVO', analytical: false },
  { code: ACCOUNTS.IMPOSTOS_A_RECUPERAR, name: 'Impostos a Recuperar', type: 'ATIVO', analytical: true },

  { code: '1.1.09', name: 'Contas Transitórias', type: 'ATIVO', analytical: false },
  { code: ACCOUNTS.VALORES_A_CLASSIFICAR, name: 'Valores a Classificar (transitória)', type: 'ATIVO', analytical: true },
  { code: '1.1.05', name: 'Estoques', type: 'ATIVO', analytical: false },
  { code: '1.1.05.001', name: 'Mercadorias para Revenda', type: 'ATIVO', analytical: true },

  { code: '1.2', name: 'Ativo Não Circulante', type: 'ATIVO', analytical: false },
  { code: '1.2.03', name: 'Imobilizado', type: 'ATIVO', analytical: false },
  { code: '1.2.03.001', name: 'Imóveis', type: 'ATIVO', analytical: true },
  { code: '1.2.03.002', name: 'Máquinas e Equipamentos', type: 'ATIVO', analytical: true },
  { code: '1.2.03.003', name: 'Móveis e Utensílios', type: 'ATIVO', analytical: true },
  { code: '1.2.03.004', name: 'Veículos', type: 'ATIVO', analytical: true },
  { code: '1.2.03.005', name: 'Computadores e Periféricos', type: 'ATIVO', analytical: true },
  { code: '1.2.03.099', name: '(-) Depreciação Acumulada', type: 'ATIVO', analytical: true },
  { code: '1.2.04', name: 'Intangível', type: 'ATIVO', analytical: false },
  { code: '1.2.04.001', name: 'Softwares e Licenças', type: 'ATIVO', analytical: true },
  { code: '1.2.04.099', name: '(-) Amortização Acumulada', type: 'ATIVO', analytical: true },

  /* ── 2. PASSIVO ───────────────────────────────────────────────────────── */
  { code: '2', name: 'Passivo', type: 'PASSIVO', analytical: false },
  { code: '2.1', name: 'Passivo Circulante', type: 'PASSIVO', analytical: false },

  { code: '2.1.01', name: 'Fornecedores', type: 'PASSIVO', analytical: false },
  { code: ACCOUNTS.FORNECEDORES, name: 'Fornecedores Nacionais', type: 'PASSIVO', analytical: true },

  { code: '2.1.02', name: 'Obrigações Trabalhistas', type: 'PASSIVO', analytical: false },
  { code: ACCOUNTS.SALARIOS_A_PAGAR, name: 'Salários e Ordenados a Pagar', type: 'PASSIVO', analytical: true },
  { code: ACCOUNTS.ENCARGOS_A_RECOLHER, name: 'Encargos Sociais a Recolher', type: 'PASSIVO', analytical: true },
  { code: ACCOUNTS.PRO_LABORE_A_PAGAR, name: 'Pró-labore a Pagar', type: 'PASSIVO', analytical: true },
  { code: '2.1.02.004', name: 'Provisão de Férias e 13º', type: 'PASSIVO', analytical: true },

  { code: '2.1.03', name: 'Obrigações Tributárias', type: 'PASSIVO', analytical: false },
  { code: ACCOUNTS.IMPOSTOS_A_RECOLHER, name: 'Impostos e Contribuições a Recolher', type: 'PASSIVO', analytical: true },
  { code: ACCOUNTS.DAS_A_RECOLHER, name: 'Simples Nacional (DAS) a Recolher', type: 'PASSIVO', analytical: true },
  { code: '2.1.03.003', name: 'Parcelamentos Tributários', type: 'PASSIVO', analytical: true },

  { code: '2.1.04', name: 'Obrigações com Sócios', type: 'PASSIVO', analytical: false },
  { code: ACCOUNTS.LUCROS_A_PAGAR, name: 'Lucros a Pagar', type: 'PASSIVO', analytical: true },

  { code: '2.1.05', name: 'Outras Obrigações', type: 'PASSIVO', analytical: false },
  { code: ACCOUNTS.ADIANTAMENTO_CLIENTE, name: 'Adiantamentos de Clientes', type: 'PASSIVO', analytical: true },
  { code: '2.1.05.002', name: 'Empréstimos e Financiamentos', type: 'PASSIVO', analytical: true },
  { code: ACCOUNTS.OUTRAS_OBRIGACOES, name: 'Outras Obrigações a Pagar', type: 'PASSIVO', analytical: true },

  /* ── 2.3 PATRIMÔNIO LÍQUIDO ───────────────────────────────────────────── */
  { code: '2.3', name: 'Patrimônio Líquido', type: 'PATRIMONIO_LIQUIDO', analytical: false },
  { code: '2.3.01', name: 'Capital Social', type: 'PATRIMONIO_LIQUIDO', analytical: false },
  { code: ACCOUNTS.CAPITAL_SOCIAL, name: 'Capital Social Subscrito', type: 'PATRIMONIO_LIQUIDO', analytical: true },
  // Fica devedora dentro de um grupo credor — reduz o PL. O sinal vem do lado
  // do lançamento, não do tipo da conta, então não há conflito com natureOf().
  { code: ACCOUNTS.CAPITAL_A_INTEGRALIZAR, name: '(-) Capital Social a Integralizar', type: 'PATRIMONIO_LIQUIDO', analytical: true },
  { code: '2.3.04', name: 'Lucros ou Prejuízos Acumulados', type: 'PATRIMONIO_LIQUIDO', analytical: false },
  { code: ACCOUNTS.LUCROS_ACUMULADOS, name: 'Lucros Acumulados', type: 'PATRIMONIO_LIQUIDO', analytical: true },
  { code: '2.3.05', name: 'Resultado do Exercício', type: 'PATRIMONIO_LIQUIDO', analytical: false },
  { code: ACCOUNTS.RESULTADO_DO_EXERCICIO, name: 'Resultado do Exercício', type: 'PATRIMONIO_LIQUIDO', analytical: true },

  /* ── 3. RESULTADO — só o mínimo citado pelas regras de lançamento ─────── */
  { code: '3', name: 'Resultado', type: 'RECEITA', analytical: false },
  { code: '3.1', name: 'Receita Operacional', type: 'RECEITA', analytical: false },
  { code: '3.1.1', name: 'Receita Bruta Operacional', type: 'RECEITA', analytical: false },
  { code: '3.1.1.01', name: 'Receitas de Vendas e Serviços', type: 'RECEITA', analytical: false },
  { code: ACCOUNTS.RECEITA_SERVICOS, name: 'Serviços Prestados', type: 'RECEITA', analytical: true },

  { code: '3.1.2', name: 'Deduções da Receita Bruta', type: 'DESPESA', analytical: false },
  { code: '3.1.2.01', name: 'Impostos sobre Faturamento', type: 'DESPESA', analytical: false },
  { code: ACCOUNTS.IMPOSTO_PIS, name: 'PIS s/ Faturamento', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.IMPOSTO_COFINS, name: 'COFINS s/ Faturamento', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.IMPOSTO_ISS, name: 'ISS', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.IMPOSTO_ICMS, name: 'ICMS', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.IMPOSTO_SIMPLES, name: 'Simples Nacional (DAS)', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.IMPOSTO_OUTROS, name: 'Outros Tributos sobre Faturamento', type: 'DESPESA', analytical: true },

  // Tributos sobre o lucro — grupo próprio na ITG 1000, fora das deduções.
  { code: '3.8', name: 'Tributos sobre o Lucro', type: 'DESPESA', analytical: false },
  { code: '3.8.1', name: 'Tributos sobre o Lucro', type: 'DESPESA', analytical: false },
  { code: '3.8.1.01', name: 'Provisão para IRPJ e CSLL', type: 'DESPESA', analytical: false },
  { code: ACCOUNTS.IRPJ, name: 'IRPJ Corrente', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.CSLL, name: 'CSLL Corrente', type: 'DESPESA', analytical: true },

  { code: '3.3', name: 'Despesas Operacionais', type: 'DESPESA', analytical: false },
  { code: '3.3.2', name: 'Despesas Administrativas', type: 'DESPESA', analytical: false },
  { code: '3.3.2.01', name: 'Despesas com Pessoal', type: 'DESPESA', analytical: false },
  { code: ACCOUNTS.DESPESA_PESSOAL, name: 'Salários (Administrativo)', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.PRO_LABORE, name: 'Pró-labore', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.ENCARGOS_PESSOAL, name: 'INSS (Administrativo)', type: 'DESPESA', analytical: true },
  // As 14 Despesas Gerais do Anexo 7, na íntegra. Quanto mais contas reais o
  // classificador tem para escolher, menos ele precisa hesitar — e a norma já
  // cobre praticamente tudo que uma prestadora de serviço gasta.
  { code: '3.3.2.02', name: 'Despesas Gerais', type: 'DESPESA', analytical: false },
  { code: '3.3.2.02.01', name: 'Aluguéis e Arrendamentos', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.02', name: 'Condomínios e Estacionamentos', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.03', name: 'Despesas com Veículos', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.04', name: 'Depreciação', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.05', name: 'Amortização', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.SERVICOS_PROFISSIONAIS, name: 'Serviços Profissionais Contratados', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.07', name: 'Energia', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.08', name: 'Água e Esgoto', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.09', name: 'Telefone e Internet', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.10', name: 'Correios e Malotes', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.11', name: 'Seguros', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.12', name: 'Multas', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.13', name: 'Bens de Pequeno Valor', type: 'DESPESA', analytical: true },
  { code: '3.3.2.02.14', name: 'Material de Escritório', type: 'DESPESA', analytical: true },

  // Resultado financeiro. Juros e descontos precisam de conta própria: sem
  // elas, pagar R$ 1.030 numa conta de R$ 1.000 obrigaria a "baixar" R$ 1.030
  // de um passivo de R$ 1.000 — a partida fecharia e o balanço mentiria.
  { code: '3.4', name: 'Resultado Financeiro', type: 'DESPESA', analytical: false },
  { code: '3.4.1', name: 'Receitas e Despesas Financeiras', type: 'DESPESA', analytical: false },
  { code: '3.4.1.01', name: 'Despesas Financeiras', type: 'DESPESA', analytical: false },
  { code: ACCOUNTS.JUROS_PASSIVOS, name: 'Juros Passivos', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.DESPESA_BANCARIA, name: 'Despesas Bancárias', type: 'DESPESA', analytical: true },
  { code: ACCOUNTS.DESCONTOS_CONCEDIDOS, name: 'Descontos Concedidos', type: 'DESPESA', analytical: true },
  { code: '3.4.1.02', name: 'Receitas Financeiras', type: 'RECEITA', analytical: false },
  { code: ACCOUNTS.JUROS_ATIVOS, name: 'Juros Ativos', type: 'RECEITA', analytical: true },
  { code: ACCOUNTS.DESCONTOS_OBTIDOS, name: 'Descontos Obtidos', type: 'RECEITA', analytical: true },
];

/**
 * Converte o `accountingCode` de uma categoria gerencial numa conta contábil
 * de resultado, junto com as sintéticas que faltarem no caminho.
 *
 * O de-para é o próprio código: as categorias já foram semeadas com a
 * numeração do Anexo 7. Derivar em vez de manter uma segunda lista é o que
 * impede categoria e conta de divergirem quando uma das duas for editada.
 */
export function deriveResultAccounts(
  categories: { name: string; accountingCode: string | null; kind: 'INCOME' | 'EXPENSE' }[],
): AccountSeed[] {
  const bySeed = new Map<string, AccountSeed>();
  const jaNoPlano = new Set(DEFAULT_CHART.map((a) => a.code));

  for (const cat of categories) {
    const code = cat.accountingCode?.trim();
    if (!code || !/^3(\.\d+)+$/.test(code)) continue;
    if (jaNoPlano.has(code) || bySeed.has(code)) continue;

    const type: AccountType = cat.kind === 'INCOME' ? 'RECEITA' : 'DESPESA';

    // As sintéticas acima dela: sem elas o balanço não teria como somar o
    // grupo, e `parentCode` apontaria para uma conta inexistente.
    for (const ancestral of ancestorsOf(code)) {
      if (jaNoPlano.has(ancestral) || bySeed.has(ancestral)) continue;
      bySeed.set(ancestral, {
        code: ancestral,
        name: `Grupo ${ancestral}`,
        type,
        analytical: false,
      });
    }

    bySeed.set(code, { code, name: cat.name, type, analytical: true });
  }

  return [...bySeed.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function ancestorsOf(code: string): string[] {
  const parts = code.split('.');
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('.'));
  return out;
}
