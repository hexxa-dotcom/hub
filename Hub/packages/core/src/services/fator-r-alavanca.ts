import { TaxThermometerService } from './tax-thermometer.service';

/**
 * O FATOR R COMO DECISÃO, NÃO COMO DIAGNÓSTICO.
 *
 * O termômetro tributário já mostra o Fator R e o anexo. Isso é diagnóstico:
 * informa e não sugere ação. Para prestador de serviço, o Fator R é A alavanca
 * tributária — passar de 28% move a empresa do Anexo V para o III, e a
 * diferença de alíquota costuma ser de vários pontos.
 *
 * O que falta ao cliente é o número da decisão: "subindo o pró-labore em R$ X,
 * você economiza R$ Y por mês". Esta função produz esse par.
 *
 * ── O que entra e o que NÃO entra na conta ─────────────────────────────
 *
 * Entra a economia no DAS, calculada nas mesmas tabelas do termômetro —
 * alíquota efetiva do Anexo V contra a do III, sobre a receita do mês.
 *
 * NÃO entra o IRRF sobre o pró-labore adicional, que depende da situação
 * pessoal do sócio (dependentes, outras fontes, deduções). E o INSS de 11%
 * aparece separado porque não é perda: é contribuição do próprio sócio, que
 * volta como aposentadoria. Somá-lo como "custo" faria a alavanca parecer pior
 * do que é; omiti-lo faria parecer melhor. Por isso vai ao lado, nomeado.
 *
 * ── Fronteira com o ProlaboreAutopilotService ──────────────────────────
 *
 * Aquele serviço responde "quanto pagar de pró-labore ESTE mês", respeitando
 * o piso do salário mínimo e olhando os 11 meses anteriores — é operação,
 * roda todo mês. Este responde "quanto essa mudança vale em dinheiro" — é
 * argumento, e serve para o cliente decidir se vale a pena mexer. Os alvos
 * podem divergir em centavos pela margem de segurança que o autopilot usa
 * (28,01%); quem manda no pagamento é ele.
 */

export interface EntradasDaAlavanca {
  /** Receita bruta dos 12 meses anteriores. */
  rbt12: number;
  /** Folha total dos 12 meses (empregados + pró-labore). */
  folha12: number;
  /** Só empregados, sem pró-labore — é o que o sócio não controla. */
  folhaEmpregados12: number;
  /** Receita do mês sobre a qual a economia é calculada. */
  receitaDoMes: number;
}

export interface Alavanca {
  fatorR: number;
  /** `true` quando já está no Anexo III pelo Fator R — não há o que fazer. */
  jaFavoravel: boolean;
  /** Pró-labore mensal que leva o Fator R a 28%. */
  proLaboreAlvo: number;
  /** Quanto o pró-labore precisa subir por mês. */
  aumentoMensal: number;
  aliquotaHoje: number;
  aliquotaNoAnexoIII: number;
  /** Economia mensal no DAS, em reais. */
  economiaMensal: number;
  /** INSS de 11% sobre o aumento — contribuição do sócio, não perda. */
  inssSobreOAumento: number;
  /** Economia menos o INSS. Pode ser negativo: aí a alavanca não compensa. */
  sobraMensal: number;
  /** `true` quando subir o pró-labore devolve menos do que custa. */
  naoCompensa: boolean;
}

const INSS_CONTRIBUINTE_INDIVIDUAL = 0.11;

export function calcularAlavancaFatorR(e: EntradasDaAlavanca): Alavanca | null {
  // Sem receita nos 12 meses não há Fator R nem faixa — não há o que sugerir.
  if (!(e.rbt12 > 0)) return null;

  const servico = new TaxThermometerService();
  const fatorR = e.folha12 / e.rbt12;
  const jaFavoravel = fatorR >= 0.28;

  const noV = servico.simplesPosition({ rbt12: e.rbt12, payroll12: e.folha12, anexo: 'V' });
  const noIII = servico.simplesPosition({ rbt12: e.rbt12, payroll12: e.folha12, anexo: 'III' });

  /**
   * O pró-labore que zera a diferença.
   *
   * 28% do RBT12 é a folha total necessária. Tirando o que os empregados já
   * pagam, sobra o que o pró-labore precisa cobrir — dividido por 12 porque o
   * cliente decide um valor MENSAL, não anual.
   */
  const proLaboreAlvo = Math.max(0, (0.28 * e.rbt12 - e.folhaEmpregados12) / 12);
  const proLaboreHoje = Math.max(0, (e.folha12 - e.folhaEmpregados12) / 12);
  const aumentoMensal = Math.max(0, proLaboreAlvo - proLaboreHoje);

  const aliquotaHoje = jaFavoravel ? noIII.effectiveRate : noV.effectiveRate;
  const economiaMensal = jaFavoravel
    ? 0
    : Math.max(0, (e.receitaDoMes * (noV.effectiveRate - noIII.effectiveRate)) / 100);
  const inssSobreOAumento = aumentoMensal * INSS_CONTRIBUINTE_INDIVIDUAL;
  const sobra = economiaMensal - inssSobreOAumento;

  const cent = (n: number) => Math.round(n * 100) / 100;

  return {
    fatorR,
    jaFavoravel,
    proLaboreAlvo: cent(proLaboreAlvo),
    aumentoMensal: cent(aumentoMensal),
    aliquotaHoje,
    aliquotaNoAnexoIII: noIII.effectiveRate,
    economiaMensal: cent(economiaMensal),
    inssSobreOAumento: cent(inssSobreOAumento),
    sobraMensal: cent(sobra),
    naoCompensa: !jaFavoravel && sobra <= 0,
  };
}
