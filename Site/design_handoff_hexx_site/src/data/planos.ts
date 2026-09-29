// Fonte única de verdade para preços e planos da Hexx Digital.
// Usada por: seção de planos da home, /planos (comparação) e /checkout.

export type Cobranca = 'anual' | 'mensal';
export type MetodoPagamento = 'cartao' | 'pix' | 'boleto';

export type PlanoId = 'mei' | 'sem-movimento' | 'simples-light' | 'simples-completo' | 'presumido';

export interface Plano {
  id: PlanoId;
  nome: string;
  categoria: string;          // rótulo mono acima do nome
  anual: number;              // R$ por mês no plano anual
  mensal: number;             // R$ no mês a mês (valor cheio)
  descricao: string;
  itens: string[];
  destaque?: boolean;         // "Mais escolhido"
  rodape?: { texto: string; href: string };
}

export const WHATSAPP = '5547984935695';
export const waLink = (texto: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;

export const PLANOS: Record<PlanoId, Plano> = {
  mei: {
    id: 'mei', nome: 'MEI', categoria: 'Microempreendedor', anual: 79, mensal: 99,
    descricao: 'Para o microempreendedor individual.',
    itens: [
      'DAS-MEI mensal em dia, com guia e lembrete de vencimento',
      'Declaração anual (DASN-SIMEI)',
      'Emissão de notas fiscais pelo Hub',
      'Aviso antes de estourar o limite do MEI, e a migração para o Simples com a gente',
      'Empregado do MEI: R$ 50/mês',
    ],
  },
  'sem-movimento': {
    id: 'sem-movimento', nome: 'Sem movimento', categoria: 'Sem movimento', anual: 169, mensal: 199,
    descricao: 'Para empresa aberta, sem faturamento nem movimentação no mês.',
    itens: ['Obrigações em dia mesmo sem movimento', 'Declarações e entregas obrigatórias', 'Pró-labore de até 2 sócios'],
  },
  'simples-light': {
    id: 'simples-light', nome: 'Simples Light', categoria: 'Simples Nacional', anual: 249, mensal: 299,
    descricao: 'Para quem está começando no Simples: o essencial, com preço de início.',
    itens: ['Até 10 notas fiscais por mês', 'Faturamento de até R$ 10 mil por mês', 'Contabilidade e obrigações em dia', 'Pró-labore de 1 sócio', 'Cresceu? Passa para o Completo quando quiser'],
  },
  'simples-completo': {
    id: 'simples-completo', nome: 'Simples Completo', categoria: 'Simples Nacional', anual: 449, mensal: 499, destaque: true,
    descricao: 'Prestador de serviço com faturamento. Preço fixo, sem surpresa no fim do mês.',
    itens: ['Emissão de notas fiscais sem limite', 'Contabilidade completa e obrigações em dia', 'Pró-labore de até 2 sócios', 'Todas as funções do Hub: contratos, propostas, departamento pessoal, patrimonial e relatórios avançados'],
  },
  presumido: {
    id: 'presumido', nome: 'Presumido', categoria: 'Lucro Presumido', anual: 649, mensal: 699,
    descricao: 'Prestadora de serviço ou holding patrimonial no Lucro Presumido.',
    itens: ['IRPJ e CSLL trimestrais, PIS e COFINS mensais', 'Holding patrimonial ou empresa de serviço', 'Receita de aluguel e distribuição de lucros', 'Emissão de notas fiscais sem limite', 'Pró-labore de até 2 sócios', 'Todas as funções do Hub'],
    rodape: { texto: 'Holding com vários imóveis ou operação maior? Montamos sob medida →', href: waLink('Olá, quero um plano sob medida para holding') },
  },
};

// Home mostra 3 cartões: Sem movimento, Simples (chave Completo | Light, começa no Completo), Presumido.
// MEI fica num bloco separado abaixo ("Você é MEI? Temos uma condição especial pra você.").
export const CARTOES_HOME = ['sem-movimento', 'simples', 'presumido'] as const;
export const VARIANTES_SIMPLES: PlanoId[] = ['simples-completo', 'simples-light'];

// Tabela /planos: 4 colunas, destaque na 3ª.
export const COLUNAS_COMPARACAO: PlanoId[] = ['sem-movimento', 'simples-light', 'simples-completo', 'presumido'];

export const ADICIONAIS = [
  { item: 'Colaborador ou sócio adicional', valor: 'R$ 50/mês cada' },
  { item: 'Admissão ou rescisão', valor: 'R$ 150 por evento' },
];
export const ADICIONAIS_MEI = [{ item: 'Empregado do MEI', valor: 'R$ 50/mês' }];

export const REGRAS_PAGAMENTO = [
  { item: 'Anual', valor: '12× no cartão, pelo valor do anual' },
  { item: 'Mês a mês', valor: 'Boleto ou Pix, valor cheio' },
  { item: 'Mês a mês no cartão', valor: '5% de desconto' },
];

export const DESCONTO_CARTAO_MENSAL = 0.05;

export function metodosPermitidos(c: Cobranca): MetodoPagamento[] {
  return c === 'anual' ? ['cartao'] : ['pix', 'boleto', 'cartao'];
}

/** Valor cobrado por mês/parcela. */
export function valorMensal(p: Plano, c: Cobranca, m: MetodoPagamento): number {
  if (c === 'anual') return p.anual;                       // 12 parcelas de p.anual no cartão
  return m === 'cartao' ? +(p.mensal * (1 - DESCONTO_CARTAO_MENSAL)).toFixed(2) : p.mensal;
}

export const totalAnual = (p: Plano) => p.anual * 12;
export const economiaAno = (p: Plano) => (p.mensal - p.anual) * 12; // MEI 240 · Sem mov. 360 · demais 600

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const EMPRESA = {
  nome: 'Hexx Digital',
  cnpj: '62.414.421/0001-16',
  crcContador: 'SC-047967/0-2',
  telefone: '(47) 98493-5695',
  email: 'contato@hexxdigital.com.br',
  dominio: 'hexxdigital.com.br',
};
