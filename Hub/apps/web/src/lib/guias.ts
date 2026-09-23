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

/**
 * O nome que o cliente lê. A guia do OneFlow chega só com o código do
 * tributo ("DAS", "DARF"...), que diz pouco a quem não é contador. Quando o
 * nome é só o código, troca pelo nome por extenso; quando o contador deu um
 * nome próprio ("DAS - Simples Nacional", "ISS de agosto"), fica o dele.
 */
const NOMES_POR_EXTENSO: Record<string, string> = {
  DAS: 'Guia do Simples Nacional',
  DARF: 'DARF — Receita Federal',
  ISS: 'ISS — Imposto sobre Serviços',
  FGTS: 'FGTS dos funcionários',
  INSS: 'INSS — Previdência',
  GPS: 'INSS — Previdência',
  DCTFWEB: 'INSS e retenções (DCTFWeb)',
};

export function nomeDaGuia(taxName: string): string {
  const codigo = taxName.trim().toUpperCase().replace(/[\s.-]/g, '');
  return NOMES_POR_EXTENSO[codigo] ?? taxName;
}

/** O rótulo curto da coluna à esquerda: o que é, não qual tributo. */
export function grupoDaGuia(categoria: GuiaCategoria): string {
  return categoria === 'PARCELAMENTO' ? 'Parcelamento' : categoria === 'DIVERSA' ? 'Guia' : 'Imposto';
}
