/**
 * O nome do cliente para LER, não o da nota.
 *
 * O nome chega cru da nota fiscal e do cadastro da Receita: o MEI vem com a
 * raiz do CNPJ na frente ("26.531.672 ROGERIO ALVES SILVEIRA") ou o CPF no
 * fim ("ALEXSANDRO JESUINO 00437529932"), quase tudo em maiúsculas, um ou
 * outro todo em minúsculas. Aqui ele vira "Rogerio Alves Silveira". O nome
 * oficial continua guardado e aparece nos detalhes e nos documentos.
 */

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com']);
const SIGLAS = new Set(['LTDA', 'ME', 'EPP', 'MEI', 'SA', 'S.A.', 'S/A', 'EIRELI', 'SS', 'CIA']);

export function nomeDeExibicao(bruto: string): string {
  let n = (bruto ?? '').trim().replace(/\s+/g, ' ');
  // Raiz do CNPJ do MEI na frente, CPF ou CNPJ colado no fim.
  n = n.replace(/^\d{2}\.?\d{3}\.?\d{3}\s+/, '').replace(/\s+\d{11}$/, '').replace(/\s+\d{14}$/, '').trim();
  if (!n) return (bruto ?? '').trim();

  const tudoMaiusculo = n === n.toUpperCase();
  const tudoMinusculo = n === n.toLowerCase();
  // Nome já escrito com maiúsculas e minúsculas: quem escreveu escolheu assim.
  if (!tudoMaiusculo && !tudoMinusculo) return n;

  return n
    .split(' ')
    .map((p, i) => {
      const up = p.toUpperCase();
      if (SIGLAS.has(up)) return up === 'SA' ? 'S.A.' : up;
      // Sigla com número ou curtinha sem vogal: BM3, B2C, JLC.
      if (/\d/.test(p) || (p.length <= 3 && !/[AEIOUÁÉÍÓÚÂÊÔÃÕ]/i.test(p))) return up;
      const lower = p.toLowerCase();
      if (i > 0 && MINUSCULAS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Duas iniciais para o monograma: "BM3 Gestão em Saúde" → "BG". */
export function iniciais(nome: string): string {
  const partes = nome.split(' ').filter((p) => p && !MINUSCULAS.has(p.toLowerCase()) && !SIGLAS.has(p.toUpperCase()));
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}
