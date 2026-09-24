/**
 * LUCRO PRESUMIDO — estimativa dos tributos federais de uma prestadora de
 * serviços.
 *
 * Base presumida de 32% da receita (serviços em geral, Lei 9.249/95, art. 15
 * e 20). Sobre ela: IRPJ 15% e, no que passar de R$ 20 mil por mês (R$ 60 mil
 * no trimestre), o adicional de 10%; CSLL 9%. Sobre a receita: PIS 0,65% e
 * COFINS 3% (regime cumulativo). O ISS depende do município e fica de fora.
 *
 * IRPJ e CSLL são apurados por trimestre; aqui a conta é do mês, como
 * estimativa do que o mês "gera" de imposto.
 */
export interface EstimativaPresumido {
  pis: number;
  cofins: number;
  irpj: number;
  adicionalIrpj: number;
  csll: number;
  total: number;
  /** Total ÷ receita, em %. */
  aliquotaEfetiva: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function estimativaPresumido(receitaDoMes: number): EstimativaPresumido {
  const receita = Math.max(0, receitaDoMes);
  const base = receita * 0.32;
  const pis = r2(receita * 0.0065);
  const cofins = r2(receita * 0.03);
  const irpj = r2(base * 0.15);
  const adicionalIrpj = r2(Math.max(0, base - 20_000) * 0.1);
  const csll = r2(base * 0.09);
  const total = r2(pis + cofins + irpj + adicionalIrpj + csll);
  return { pis, cofins, irpj, adicionalIrpj, csll, total, aliquotaEfetiva: receita > 0 ? r2((total / receita) * 100) : 0 };
}
