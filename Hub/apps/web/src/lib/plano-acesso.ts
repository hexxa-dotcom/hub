/**
 * MÓDULOS QUE UM PLANO PODE DEIXAR DE FORA.
 *
 * Módulo neutro (sem 'use client'): o layout do portal, o menu e as telas
 * leem a mesma lista. O plano diz quais estão fora em
 * `plan.features.modulosBloqueados` — hoje só o Simples Light usa.
 *
 * Função fora do plano não some: fica no menu com cadeado e, ao abrir, mostra
 * o que faz e o convite para mudar de plano.
 */

export type ModuloDoPlano = 'contratos' | 'propostas' | 'colaboradores' | 'patrimonial' | 'relatorios-avancados';

export const MODULOS: Record<ModuloDoPlano, { nome: string; rotas: string[]; oQueFaz: string }> = {
  contratos: {
    nome: 'Contratos',
    rotas: ['/meu-negocio/contratos'],
    oQueFaz: 'Crie contratos com clientes e fornecedores, assine sem sair da Hexx e deixe as parcelas entrarem sozinhas no financeiro.',
  },
  propostas: {
    nome: 'Propostas',
    rotas: ['/meu-negocio/propostas'],
    oQueFaz: 'Monte propostas comerciais com a sua marca, envie por link e acompanhe quem abriu e aceitou.',
  },
  colaboradores: {
    nome: 'Colaboradores',
    rotas: ['/minha-contabilidade/departamento-pessoal'],
    oQueFaz: 'Folha de pagamento, admissões, férias e rescisões dos seus funcionários, com as guias prontas todo mês.',
  },
  patrimonial: {
    nome: 'Bens',
    rotas: ['/patrimonial'],
    oQueFaz: 'Controle os bens da empresa e dos sócios, aluguéis recebidos e a depreciação, tudo ligado à contabilidade.',
  },
  'relatorios-avancados': {
    nome: 'Relatórios avançados',
    rotas: ['/meu-negocio/relatorios/faturamento-por-cliente', '/meu-negocio/relatorios/informe-rendimentos'],
    oQueFaz: 'Faturamento por cliente e informe de rendimentos dos sócios, além dos relatórios básicos.',
  },
};

/** O módulo a que uma rota pertence, ou null se é livre em qualquer plano. */
export function moduloDaRota(href: string): ModuloDoPlano | null {
  for (const [id, m] of Object.entries(MODULOS) as [ModuloDoPlano, (typeof MODULOS)[ModuloDoPlano]][]) {
    if (m.rotas.some((r) => href === r || href.startsWith(`${r}/`))) return id;
  }
  return null;
}
