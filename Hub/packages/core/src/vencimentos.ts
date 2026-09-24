/**
 * VENCIMENTOS DE UM CONTRATO MENSAL.
 *
 * Uma parcela por mês, no dia de vencimento, de início a fim da vigência. A
 * primeira é a do primeiro dia de vencimento a partir do início; em mês mais
 * curto que o dia (31 em fevereiro), vence no último dia do mês.
 */
/** Os dias de vencimento (AAAA-MM-DD) entre início e fim — no máximo 60. */
export function diasDeVencimento(inicio: string, fim: string, dia: number): string[] {
  const [ai, mi, di] = inicio.split('-').map(Number) as [number, number, number];
  const datas: string[] = [];
  let mes = mi - 1 + (dia < di ? 1 : 0);
  for (let n = 0; n < 60; n++, mes++) {
    const ultimo = new Date(Date.UTC(ai, mes + 1, 0)).getUTCDate();
    const d = new Date(Date.UTC(ai, mes, Math.min(dia, ultimo)));
    const iso = d.toISOString().slice(0, 10);
    if (iso > fim) break;
    datas.push(iso);
  }
  // Contrato curto que termina antes do primeiro vencimento: uma parcela no fim.
  return datas.length ? datas : [fim];
}

