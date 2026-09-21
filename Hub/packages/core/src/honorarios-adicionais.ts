/**
 * OS ADICIONAIS DA FATURA DE HONORÁRIOS.
 *
 * O plano cobre o básico: contabilidade, obrigações e o pró-labore de até dois
 * sócios. O que passa disso é trabalho a mais todo mês — cada colaborador é
 * folha, guia e eSocial — e é cobrado à parte.
 *
 * ── O que NÃO é cobrado aqui, e por quê ────────────────────────────────
 *
 * Rescisão. O sistema não guarda data de desligamento: um colaborador some da
 * lista de ativos sem dizer quando. Cobrar por um evento cuja data é palpite
 * seria lançar na fatura do cliente uma dívida que ninguém consegue conferir
 * — e uma cobrança errada custa mais que a cobrança perdida.
 */

export interface EntradasDosAdicionais {
  /** Colaboradores CLT ativos no mês. */
  colaboradores: number;
  /** Sócios com pró-labore. */
  socios: number;
  /** Quantos sócios o plano já inclui. */
  sociosInclusos: number;
  /** Admissões ocorridas no mês de referência. */
  admissoes: number;
  valorPorColaborador: number;
  valorPorEvento: number;
}

export interface ItemAdicional {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
}

export interface Adicionais {
  itens: ItemAdicional[];
  total: number;
}

export function calcularAdicionais(e: EntradasDosAdicionais): Adicionais {
  const itens: ItemAdicional[] = [];

  const push = (descricao: string, quantidade: number, valorUnitario: number) => {
    if (quantidade <= 0 || valorUnitario <= 0) return;
    itens.push({
      descricao,
      quantidade,
      valorUnitario,
      total: Math.round(quantidade * valorUnitario * 100) / 100,
    });
  };

  push(
    e.colaboradores === 1 ? 'colaborador' : 'colaboradores',
    Math.max(0, e.colaboradores),
    e.valorPorColaborador,
  );

  // Sócio além do que o plano inclui custa o mesmo que um colaborador: o
  // trabalho é o mesmo — folha, guia, eSocial.
  const sociosExcedentes = Math.max(0, e.socios - e.sociosInclusos);
  push(
    sociosExcedentes === 1 ? 'sócio adicional' : 'sócios adicionais',
    sociosExcedentes,
    e.valorPorColaborador,
  );

  push(e.admissoes === 1 ? 'admissão' : 'admissões', Math.max(0, e.admissoes), e.valorPorEvento);

  return {
    itens,
    total: Math.round(itens.reduce((s, i) => s + i.total, 0) * 100) / 100,
  };
}

/** Como os adicionais se explicam na fatura, em uma linha. */
export function descricaoDosAdicionais(a: Adicionais): string {
  if (!a.itens.length) return '';
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return a.itens
    .map((i) => `${i.quantidade} ${i.descricao} × ${brl(i.valorUnitario)}`)
    .join(', ');
}
