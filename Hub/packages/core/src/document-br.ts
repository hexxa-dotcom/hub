/**
 * CPF/CNPJ — inclui suporte ao CNPJ ALFANUMÉRICO (Receita Federal, obrigatório
 * pra novos CNPJs a partir de jul/2026: os 12 primeiros caracteres passam a
 * poder ser letras A-Z maiúsculas OU dígitos; só os 2 últimos — os dígitos
 * verificadores — continuam sempre numéricos). CPF continua 100% numérico.
 *
 * Regra de ouro deste módulo: NUNCA descartar letras de um CPF/CNPJ. Um
 * `replace(/\D/g, '')` (comum em código legado) destrói um CNPJ alfanumérico
 * silenciosamente. Toda normalização aqui preserva A-Z, só remove máscara
 * (pontos, barra, hífen, espaços).
 */

export type DocumentKind = 'CPF' | 'CNPJ';

/** Remove máscara (pontuação/espaços) e uppercasa — preserva letras A-Z. */
export function normalizeDocument(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * CPF é sempre 100% numérico (11 dígitos) — qualquer letra ou mais de 11
 * caracteres só pode ser CNPJ. Funciona também com entrada parcial (em
 * digitação), pra já trocar a máscara pro formato certo assim que a
 * primeira letra aparecer, sem esperar completar os 14 caracteres.
 */
export function documentKind(normalizedOrRaw: string): DocumentKind {
  const v = normalizeDocument(normalizedOrRaw);
  return v.length > 11 || /[A-Z]/.test(v) ? 'CNPJ' : 'CPF';
}

/** true se já tem o comprimento completo do tipo de documento (11 ou 14). */
export function isCompleteDocument(raw: string | null | undefined): boolean {
  const v = normalizeDocument(raw);
  return documentKind(v) === 'CNPJ' ? v.length === 14 : v.length === 11;
}

function maskByGroups(value: string, groupLens: number[], seps: string[]): string {
  let out = '';
  let idx = 0;
  for (let i = 0; i < groupLens.length; i++) {
    const chunk = value.slice(idx, idx + groupLens[i]!);
    if (!chunk) break;
    out += chunk;
    idx += groupLens[i]!;
    if (idx < value.length) out += seps[i] ?? '';
  }
  return out;
}

/**
 * Máscara de exibição — funciona por POSIÇÃO, não por regex de dígitos, pra
 * não quebrar com letras no meio do CNPJ. CPF: XXX.XXX.XXX-XX. CNPJ (numérico
 * ou alfanumérico): XX.XXX.XXX/XXXX-XX. Incremental: formata o que já foi
 * digitado, sem exigir o valor completo.
 */
export function formatDocument(raw: string | null | undefined): string {
  const v = normalizeDocument(raw).slice(0, 14);
  if (documentKind(v) === 'CPF') {
    return maskByGroups(v, [3, 3, 3, 2], ['.', '.', '-']);
  }
  return maskByGroups(v, [2, 3, 3, 4, 2], ['.', '.', '/', '-']);
}

/** CPF com dígitos verificadores corretos (rejeita sequências iguais). */
export function cpfValido(raw: string | null | undefined): boolean {
  const v = normalizeDocument(raw);
  if (!/^\d{11}$/.test(v) || /^(\d)\1{10}$/.test(v)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(v[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(v[9]) && dv(10) === Number(v[10]);
}

/**
 * CNPJ com dígitos verificadores corretos — numérico ou alfanumérico. No
 * alfanumérico cada caractere vale o código ASCII menos 48 (Receita, 2026).
 */
export function cnpjValido(raw: string | null | undefined): boolean {
  const v = normalizeDocument(raw);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(v) || /^(\d)\1{13}$/.test(v)) return false;
  const val = (c: string) => c.charCodeAt(0) - 48;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + val(v[i]!) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(v[12]) && dv(13) === Number(v[13]);
}
