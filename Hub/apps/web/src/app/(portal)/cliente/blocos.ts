/**
 * Blocos da Início e os perfis de visualização.
 *
 * Módulo neutro (sem 'use client'): servidor e cliente leem a mesma lista.
 *
 * - BASICO: o essencial, para quem é leigo — quanto entrou, quanto sobrou,
 *   o imposto e a lista do que pede a pessoa hoje. Padrão de cliente novo.
 * - PERSONALIZADO: a pessoa marca os blocos que quer.
 * - COMPLETO: tudo.
 */

export type PerfilDoInicio = 'BASICO' | 'PERSONALIZADO' | 'COMPLETO';

export const PERFIS: { id: PerfilDoInicio; rotulo: string }[] = [
  { id: 'BASICO', rotulo: 'Básico' },
  { id: 'PERSONALIZADO', rotulo: 'Personalizado' },
  { id: 'COMPLETO', rotulo: 'Completo' },
];

export const BLOCOS = [
  { id: 'faturamento', rotulo: 'Faturamento do mês' },
  { id: 'resultado', rotulo: 'Resultado do mês' },
  { id: 'imposto', rotulo: 'Imposto' },
  { id: 'pendencias', rotulo: 'O que pede você (lista)' },
  { id: 'pede-hoje', rotulo: 'Pede você hoje (resumo)' },
  { id: 'ticket', rotulo: 'Ticket médio' },
  { id: 'despesas', rotulo: 'Despesas do mês' },
  { id: 'atrasados', rotulo: 'Recebimentos atrasados' },
  { id: 'proximos-14', rotulo: 'Próximos 14 dias' },
  { id: 'financeiro', rotulo: 'Financeiro do mês' },
  { id: 'clientes', rotulo: 'Clientes' },
  { id: 'notas', rotulo: 'Notas do mês' },
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'ano', rotulo: 'O ano em espiral' },
  { id: 'propostas', rotulo: 'Propostas' },
  { id: 'contratos', rotulo: 'Contratos' },
  { id: 'pessoas', rotulo: 'Pessoas' },
] as const;

export type BlocoId = (typeof BLOCOS)[number]['id'];

const BASICO: BlocoId[] = ['faturamento', 'resultado', 'imposto', 'pendencias'];

export function ehPerfil(v: unknown): v is PerfilDoInicio {
  return v === 'BASICO' || v === 'PERSONALIZADO' || v === 'COMPLETO';
}

/** Os blocos visíveis no perfil. Personalizado sem escolha nenhuma cai no Básico. */
export function blocosDoPerfil(perfil: PerfilDoInicio, escolhidos: string[] | null | undefined): BlocoId[] {
  if (perfil === 'COMPLETO') return BLOCOS.map((b) => b.id);
  if (perfil === 'PERSONALIZADO') {
    const validos = (escolhidos ?? []).filter((id): id is BlocoId => BLOCOS.some((b) => b.id === id));
    if (validos.length) return validos;
  }
  return BASICO;
}
