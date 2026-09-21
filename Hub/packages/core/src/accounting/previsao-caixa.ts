/**
 * PARA ONDE O CAIXA VAI NOS PRÓXIMOS 90 DIAS.
 *
 * Renda de prestador de serviço é irregular: três meses bons, um seco. O
 * cliente não precisa de gráfico — precisa de uma data. "Dia 12 de novembro
 * você fica negativo" é acionável; "seu fluxo de caixa" não é.
 *
 * ── Por que 90 dias, e não 12 meses ────────────────────────────────────
 *
 * Porque só os 90 dias são conhecidos. Depois disso a projeção vira
 * extrapolação de receita que ainda não foi contratada — e uma linha bonita
 * que se baseia em faturamento imaginário é pior que nenhuma linha.
 *
 * ── O que entra ────────────────────────────────────────────────────────
 *
 * Só compromisso com data: a receber e a pagar já lançados, e as despesas
 * recorrentes até o horizonte. Nada de média histórica.
 */

export interface CompromissoFuturo {
  /** AAAA-MM-DD. */
  data: string;
  valor: number;
  descricao: string;
  /** `true` para entrada, `false` para saída. */
  entrada: boolean;
}

export interface EntradasDaPrevisao {
  saldoInicial: number;
  compromissos: CompromissoFuturo[];
  /** Hoje, em AAAA-MM-DD. */
  hoje: string;
  /** Quantos dias projetar. Padrão 90. */
  dias?: number;
}

export interface DiaDaPrevisao {
  data: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface PrevisaoDeCaixa {
  dias: DiaDaPrevisao[];
  saldoFinal: number;
  /** O pior dia do período — o que o cliente precisa ver. */
  piorDia: DiaDaPrevisao | null;
  /** Primeiro dia em que o saldo fica negativo, se houver. */
  primeiroDiaNegativo: string | null;
  totalAReceber: number;
  totalAPagar: number;
}

function somarDias(data: string, n: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function projetarCaixa(e: EntradasDaPrevisao): PrevisaoDeCaixa {
  const horizonte = somarDias(e.hoje, e.dias ?? 90);

  /**
   * Compromisso vencido e não pago entra no primeiro dia.
   *
   * A conta que venceu semana passada ainda vai ser paga; deixá-la no passado
   * a tiraria da projeção e mostraria um caixa melhor do que o real. Trazê-la
   * para hoje é o que mais se aproxima da verdade sem inventar data.
   */
  const porDia = new Map<string, { entradas: number; saidas: number }>();
  let totalAReceber = 0;
  let totalAPagar = 0;

  for (const c of e.compromissos) {
    if (c.data > horizonte) continue;
    const dia = c.data < e.hoje ? e.hoje : c.data;
    const at = porDia.get(dia) ?? { entradas: 0, saidas: 0 };
    if (c.entrada) {
      at.entradas += c.valor;
      totalAReceber += c.valor;
    } else {
      at.saidas += c.valor;
      totalAPagar += c.valor;
    }
    porDia.set(dia, at);
  }

  const dias: DiaDaPrevisao[] = [];
  let saldo = e.saldoInicial;
  let piorDia: DiaDaPrevisao | null = null;
  let primeiroDiaNegativo: string | null = null;

  for (const data of [...porDia.keys()].sort()) {
    const m = porDia.get(data)!;
    saldo += m.entradas - m.saidas;
    const d = {
      data,
      entradas: Math.round(m.entradas * 100) / 100,
      saidas: Math.round(m.saidas * 100) / 100,
      saldo: Math.round(saldo * 100) / 100,
    };
    dias.push(d);
    if (!piorDia || d.saldo < piorDia.saldo) piorDia = d;
    if (d.saldo < 0 && !primeiroDiaNegativo) primeiroDiaNegativo = d.data;
  }

  return {
    dias,
    saldoFinal: Math.round(saldo * 100) / 100,
    piorDia,
    primeiroDiaNegativo,
    totalAReceber: Math.round(totalAReceber * 100) / 100,
    totalAPagar: Math.round(totalAPagar * 100) / 100,
  };
}

/* ── Teto do Simples ─────────────────────────────────────────────────── */

export interface PosicaoNoTeto {
  rbt12: number;
  /** Média dos meses considerados — a base da projeção. */
  mediaMensal: number;
  /** Quanto falta para o limite. Negativo quando já passou. */
  folga: number;
  /** Em quantos meses o limite é atingido no ritmo atual. `null` = nunca. */
  mesesAteOLimite: number | null;
  /** Mês em que o limite é atingido (AAAA-MM), se dentro de 12 meses. */
  mesDoEstouro: string | null;
  limite: number;
}

/**
 * Quando o faturamento bate o teto, no ritmo de hoje.
 *
 * É o susto que o cliente costuma levar tarde demais — estourar o Simples
 * significa Lucro Presumido no ano seguinte, com outra carga e outras
 * obrigações. Dizer em março que o limite chega em outubro dá tempo de
 * decidir; dizer em outubro não dá.
 */
export function posicaoNoTeto(entradas: {
  rbt12: number;
  mediaMensal: number;
  limite: number;
  /** Mês corrente, AAAA-MM. */
  mesCorrente: string;
}): PosicaoNoTeto {
  const folga = entradas.limite - entradas.rbt12;
  const mesesAteOLimite =
    entradas.mediaMensal > 0 && folga > 0 ? Math.floor(folga / entradas.mediaMensal) : folga <= 0 ? 0 : null;

  let mesDoEstouro: string | null = null;
  if (mesesAteOLimite !== null && mesesAteOLimite <= 12) {
    const [ano, mes] = entradas.mesCorrente.split('-').map(Number);
    const d = new Date(Date.UTC(ano!, mes! - 1 + mesesAteOLimite, 1));
    mesDoEstouro = d.toISOString().slice(0, 7);
  }

  return {
    rbt12: entradas.rbt12,
    mediaMensal: entradas.mediaMensal,
    folga: Math.round(folga * 100) / 100,
    mesesAteOLimite,
    mesDoEstouro,
    limite: entradas.limite,
  };
}
