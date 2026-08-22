export type GuiaCategoria = 'DAS' | 'DARF' | 'ISS' | 'PARCELAMENTO' | 'FGTS' | 'DIVERSA';

/** Classifica uma guia pelo nome do tributo. Fonte única — antes duplicada
 * (e desatualizada, sem PARCELAMENTO/FGTS) em api/guias/resumo/route.ts. */
export function categoriaDe(taxName: string): GuiaCategoria {
  const n = taxName.toUpperCase();
  if (n.includes('DAS')) return 'DAS';
  if (n.includes('DARF')) return 'DARF';
  if (n.includes('ISS')) return 'ISS';
  if (n.includes('PARCEL')) return 'PARCELAMENTO';
  if (n.includes('FGTS')) return 'FGTS';
  return 'DIVERSA';
}
