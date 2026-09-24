/**
 * FOLHA E PRÓ-LABORE — as contas de 2026, num lugar só.
 *
 * Fontes (conferir com a contabilidade a cada virada de ano):
 *   INSS 2026   — teto R$ 8.475,55; faixas do empregado 7,5% / 9% / 12% / 14%
 *                 (Portaria Interministerial MPS/MF, reajuste de 3,9%).
 *                 Pró-labore (contribuinte individual): 11% até o teto.
 *   IRRF        — tabela mensal vigente desde maio/2025 (isenta até R$ 2.428,80,
 *                 desconto simplificado de R$ 607,20, R$ 189,59 por dependente)
 *                 e, desde jan/2026, o redutor da Lei 15.270/2025: quem ganha
 *                 até R$ 5.000 não paga; de R$ 5.000,01 a R$ 7.350 o imposto
 *                 cai por R$ 978,62 − 0,133145 × rendimento.
 *   FGTS        — 8% sobre salário, férias e 13º (pago pela empresa).
 *
 * São estimativas para o empresário planejar — a folha oficial (eSocial,
 * holerite, guias) é feita pela contabilidade.
 */

export const SALARIO_MINIMO_2026 = 1621;
export const TETO_INSS_2026 = 8475.55;

// Meio centavo arredonda para cima (121,575 → 121,58), sem o erro do ponto flutuante.
const r2 = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

/** INSS do empregado CLT: progressivo por faixa. */
export function inssEmpregado(salario: number): number {
  const faixas: [number, number][] = [
    [1621.0, 0.075],
    [2902.84, 0.09],
    [4354.27, 0.12],
    [TETO_INSS_2026, 0.14],
  ];
  let total = 0;
  let anterior = 0;
  const base = Math.min(Math.max(0, salario), TETO_INSS_2026);
  for (const [limite, aliquota] of faixas) {
    if (base <= anterior) break;
    total += (Math.min(base, limite) - anterior) * aliquota;
    anterior = limite;
  }
  return r2(total);
}

/** INSS do pró-labore: 11% até o teto. */
export function inssProLabore(proLabore: number): number {
  return r2(Math.min(Math.max(0, proLabore), TETO_INSS_2026) * 0.11);
}

/** IRRF mensal, com o redutor de 2026. `rendimento` é o bruto do mês. */
export function irrfMensal(rendimento: number, inss: number, dependentes = 0): number {
  const deducoesLegais = inss + dependentes * 189.59;
  const base = rendimento - Math.max(deducoesLegais, 607.2);
  let imposto = 0;
  if (base > 4664.68) imposto = base * 0.275 - 908.73;
  else if (base > 3751.05) imposto = base * 0.225 - 675.49;
  else if (base > 2826.65) imposto = base * 0.15 - 394.16;
  else if (base > 2428.8) imposto = base * 0.075 - 182.16;
  imposto = Math.max(0, imposto);
  // Redutor da Lei 15.270/2025.
  if (rendimento <= 5000) imposto = 0;
  else if (rendimento <= 7350) imposto = Math.max(0, imposto - (978.62 - 0.133145 * rendimento));
  return r2(imposto);
}

export interface ProLaboreDoMes {
  bruto: number;
  inss: number;
  irrf: number;
  liquido: number;
}

export function proLaboreDoMes(bruto: number): ProLaboreDoMes {
  const inss = inssProLabore(bruto);
  const irrf = irrfMensal(bruto, inss);
  return { bruto: r2(bruto), inss, irrf, liquido: r2(bruto - inss - irrf) };
}

export interface CustoDoColaborador {
  salario: number;
  inssRetido: number;
  irrfRetido: number;
  liquido: number;
  fgts: number;
  provisaoFerias: number;
  provisao13: number;
  fgtsProvisoes: number;
  /** O que o colaborador custa por mês à empresa, com as provisões. */
  custoMensal: number;
}

/**
 * Custo mensal de um CLT para a empresa no Simples (Anexos I a III e V): a
 * contribuição patronal já está no DAS, então entram salário, FGTS e as
 * provisões de férias (+1/3) e 13º — o que a empresa precisa guardar por mês.
 */
export function custoDoColaborador(salario: number, dependentes = 0): CustoDoColaborador {
  const s = Math.max(0, salario);
  const inssRetido = inssEmpregado(s);
  const irrfRetido = irrfMensal(s, inssRetido, dependentes);
  const provisaoFerias = r2((s * (4 / 3)) / 12);
  const provisao13 = r2(s / 12);
  const fgts = r2(s * 0.08);
  const fgtsProvisoes = r2((provisaoFerias + provisao13) * 0.08);
  return {
    salario: r2(s),
    inssRetido,
    irrfRetido,
    liquido: r2(s - inssRetido - irrfRetido),
    fgts,
    provisaoFerias,
    provisao13,
    fgtsProvisoes,
    custoMensal: r2(s + fgts + provisaoFerias + provisao13 + fgtsProvisoes),
  };
}
