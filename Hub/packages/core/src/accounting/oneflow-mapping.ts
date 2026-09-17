/**
 * DE-PARA: razão do Hub → lançamento do OneFlow.
 *
 * O formato deles encaixa quase um a um no nosso, o que é sorte e conveniência:
 *
 *   journal_entry.entryDate   → data (DD/MM/AAAA, não ISO)
 *   ledger_line.direction     → d_c ('D' | 'C')
 *   ledger_line.amount        → valor
 *   memo / lineMemo           → historico
 *   chart_of_account.code     → classificacao
 *
 * O risco não está na forma, está na CONTA. O `classificacao` precisa existir
 * no plano do OneFlow daquela empresa. Se o plano deles usar numeração
 * diferente do Anexo 7, mandar o nosso código faria o lançamento ser recusado
 * — ou pior, aceito numa conta errada.
 *
 * Por isso este módulo trabalha com um mapa explícito e **falha quando uma
 * conta não tem correspondência**, em vez de mandar o código cru e torcer.
 * Uma partida que chega incompleta ao OneFlow é escrituração errada na
 * contabilidade oficial, e ninguém descobre até o balanço.
 */

export interface LinhaDoRazao {
  accountCode: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  lineMemo?: string | null;
  partnerDocument?: string | null;
  partnerName?: string | null;
  costCenterCode?: string | null;
}

export interface PartidaDoRazao {
  entryDate: string;
  memo: string;
  documento?: string | null;
  linhas: LinhaDoRazao[];
}

export interface PartidaOneflow {
  valor: number;
  d_c: 'D' | 'C';
  historico: string;
  classificacao?: string;
  cnpjCli?: string;
  cnpjForn?: string;
  razaoSocial?: string;
  rateios?: { CodCentroCusto: string; valor: number }[];
}

export interface LancamentoOneflow {
  data: string;
  valor: number;
  documento?: string;
  partidas: PartidaOneflow[];
}

/** Conta do Hub sem correspondência no plano do OneFlow. */
export class ContaSemMapeamentoError extends Error {
  constructor(public readonly codigos: string[]) {
    super(
      `Contas sem correspondência no plano do OneFlow: ${codigos.join(', ')}. ` +
        'Cadastre o de-para antes de enviar — mandar o código do Hub faria o lançamento ' +
        'cair numa conta errada ou ser recusado.',
    );
    this.name = 'ContaSemMapeamentoError';
  }
}

/** '2026-09-15' → '15/09/2026'. */
export function dataOneflow(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte uma partida do razão no formato do OneFlow.
 *
 * `mapaDeContas` traduz nosso código para a classificação deles. Quando ele
 * estiver vazio, o de-para é a identidade — o que só é seguro depois de
 * confirmar, chamando `planoDeContas`, que os dois planos usam a mesma
 * numeração. Até lá, passar um mapa explícito é a única forma segura.
 */
export function paraOneflow(
  partida: PartidaDoRazao,
  mapaDeContas: Map<string, string>,
): LancamentoOneflow {
  const semMapa: string[] = [];

  const partidas: PartidaOneflow[] = partida.linhas.map((l) => {
    const classificacao = mapaDeContas.size ? mapaDeContas.get(l.accountCode) : l.accountCode;
    if (!classificacao) semMapa.push(l.accountCode);

    // O OneFlow separa CNPJ de cliente e de fornecedor. Quem recebe é cliente,
    // quem paga é fornecedor — a direção da linha já diz qual.
    const doc = l.partnerDocument?.replace(/\D/g, '') || undefined;
    const ehCliente = l.direction === 'DEBIT' && l.accountCode.startsWith('1.1.02');

    return {
      valor: Number(l.amount.toFixed(2)),
      d_c: l.direction === 'DEBIT' ? ('D' as const) : ('C' as const),
      // O histórico é o que a contabilidade lê no razão deles. Cair no memo do
      // cabeçalho quando a linha não tem o próprio é melhor que mandar vazio:
      // `historico` é obrigatório, e um texto genérico ainda diz mais que nada.
      historico: (l.lineMemo || partida.memo).slice(0, 255),
      ...(classificacao ? { classificacao } : {}),
      ...(doc && ehCliente ? { cnpjCli: doc } : {}),
      ...(doc && !ehCliente ? { cnpjForn: doc } : {}),
      ...(l.partnerName ? { razaoSocial: l.partnerName.slice(0, 120) } : {}),
      ...(l.costCenterCode
        ? { rateios: [{ CodCentroCusto: l.costCenterCode, valor: Number(l.amount.toFixed(2)) }] }
        : {}),
    };
  });

  if (semMapa.length) throw new ContaSemMapeamentoError([...new Set(semMapa)]);

  // `valor` do cabeçalho é o total do lançamento — a soma de UM lado, não dos
  // dois. Somar débito e crédito dobraria o valor, e é o erro mais fácil de
  // cometer aqui porque os dois números existem e são iguais.
  const total = partidas
    .filter((p) => p.d_c === 'D')
    .reduce((s, p) => s + Math.round(p.valor * 100), 0);

  return {
    data: dataOneflow(partida.entryDate),
    valor: total / 100,
    ...(partida.documento ? { documento: partida.documento.slice(0, 60) } : {}),
    partidas,
  };
}

/**
 * Monta o de-para a partir do plano do OneFlow.
 *
 * Casa pelo código quando os dois planos usam a mesma numeração. Contas nossas
 * que não acharem par ficam de fora do mapa — e é `paraOneflow` que reclama
 * delas, na hora de converter, com o código na mensagem.
 */
export function montarDeParaPorCodigo(
  contasDoHub: { code: string }[],
  contasDoOneflow: { classificacao: string }[],
): { mapa: Map<string, string>; semCorrespondencia: string[] } {
  const deles = new Set(contasDoOneflow.map((c) => c.classificacao.trim()));
  const mapa = new Map<string, string>();
  const semCorrespondencia: string[] = [];

  for (const c of contasDoHub) {
    if (deles.has(c.code)) mapa.set(c.code, c.code);
    else semCorrespondencia.push(c.code);
  }

  return { mapa, semCorrespondencia };
}
