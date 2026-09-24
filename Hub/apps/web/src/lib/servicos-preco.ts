/** Como o preço de um serviço do catálogo aparece para o cliente. Usado no servidor e na tela. */
export type TipoDePreco = 'INCLUSO' | 'A_PARTIR' | 'FIXO' | 'ORCAMENTO';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function textoDoPreco(tipo: TipoDePreco, preco: number | null): string {
  if (tipo === 'INCLUSO') return 'Incluso no seu plano';
  if (tipo === 'FIXO' && preco != null) return BRL.format(preco);
  if (tipo === 'A_PARTIR' && preco != null) return `A partir de ${BRL.format(preco)}`;
  return 'Sob orçamento';
}
