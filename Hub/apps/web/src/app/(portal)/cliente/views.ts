/**
 * Definição das vistas em módulo neutro (sem 'use client').
 *
 * Precisa ficar separado do ViewSwitcher: valor exportado de um módulo client
 * chega ao servidor como proxy de referência, não como o dado em si — o
 * servidor lia `VIEWS` e recebia algo sem `.some()`. Constante compartilhada
 * entre os dois lados mora num módulo que nenhum dos dois marca.
 */
export const VIEWS = [
  { id: 'resumo', label: 'Resumo do mês' },
  { id: 'detalhes', label: 'Detalhes' },
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

/** Vista aberta quando não há `?v=` na URL. */
export const DEFAULT_VIEW: ViewId = 'resumo';
