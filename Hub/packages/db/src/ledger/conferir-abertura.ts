import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { natureOf, type AccountType, type LinhaDeBalancete } from '@hexxa/core';
import { ensureChartOfAccounts } from './repository';
import { abrirSaldos, type ResultadoAbertura } from './abertura';

/**
 * CONFERÊNCIA DO BALANCETE ANTES DE ABRIR.
 *
 * ── Por que existe um ensaio ────────────────────────────────────────────
 *
 * Abrir saldos é irreversível na prática: corrigir uma abertura errada exige
 * estorno, e o estorno fica no histórico para sempre. Pior, uma abertura
 * errada costuma FECHAR — trocar duas contas de lugar não desequilibra nada —,
 * então o balanço não acusa e o erro só aparece meses depois.
 *
 * Por isso o caminho tem duas etapas separadas. `ensaiarAbertura` diz o que
 * vai acontecer sem gravar nada; `confirmarAbertura` grava. Quem aperta o
 * segundo botão já viu o resultado do primeiro.
 *
 * ── Por que a conta de origem quase nunca bate ──────────────────────────
 *
 * O plano de contas do escritório anterior é outro plano. `1.1.01.001` lá
 * pode ser Caixa, ou pode ser Banco, ou pode não existir. Casar por código é
 * então a exceção, não a regra, e o trabalho real do onboarding é o
 * de-para — que é justamente o que esta tela tem de tornar rápido.
 *
 * A sugestão por descrição não decide nada: ela ordena a lista para que o
 * contador confirme com um clique em vez de procurar entre cem contas.
 */

export interface ContaDoPlano {
  code: string;
  name: string;
  type: AccountType;
  /** 'DEBIT' ou 'CREDIT' — o lado em que a conta tem saldo normal. */
  nature: 'DEBIT' | 'CREDIT';
}

/** Contas analíticas da Hexx — as únicas que recebem saldo. */
export async function contasDoPlano(tx: DbHandle, companyId: string): Promise<ContaDoPlano[]> {
  await ensureChartOfAccounts(tx, companyId);
  const r = (await tx.execute(sql`
    SELECT code, name, type FROM chart_of_account
     WHERE company_id = ${companyId} AND analytical = true
     ORDER BY code
  `)) as unknown as { code: string; name: string; type: AccountType }[];
  return r.map((c) => ({ ...c, nature: natureOf(c.type) }));
}

export type SituacaoDaLinha =
  /** Conta resolvida — entra na abertura. */
  | 'PRONTA'
  /** Sem conta na Hexx e sem de-para: precisa da escolha do contador. */
  | 'SEM_CONTA'
  /** Saldo zero: não vira lançamento, e não é erro. */
  | 'ZERADA';

export interface LinhaConferida extends LinhaDeBalancete {
  situacao: SituacaoDaLinha;
  /** Conta da Hexx que vai receber o saldo, quando resolvida. */
  contaHub?: string;
  nomeHub?: string;
  /** Como foi resolvida — para a tela poder mostrar o que foi palpite. */
  por?: 'CODIGO' | 'DE_PARA' | 'DESCRICAO';
  /** Até três candidatas, ordenadas, para quem ainda precisa escolher. */
  sugestoes: ContaDoPlano[];
  /**
   * Lado final depois de aplicar a natureza da conta.
   *
   * É aqui que um passivo com saldo devedor aparece: o balancete marcou `D`,
   * a conta é credora, e a tela mostra isso em vez de esconder.
   */
  ladoFinal?: 'DEBIT' | 'CREDIT';
  /** Saldo com sinal, no formato que `abrirSaldos` espera. */
  saldoAssinado?: number;
  invertida?: boolean;
}

export interface EnsaioAbertura {
  linhas: LinhaConferida[];
  totalDebito: number;
  totalCredito: number;
  diferenca: number;
  fecha: boolean;
  /** Quantas ainda dependem de uma escolha. */
  pendentes: number;
  /** A empresa já tem abertura? Então nem adianta conferir. */
  jaAberta: string | null;
  avisos: string[];
}

/**
 * Confere o balancete contra o plano da Hexx, sem gravar nada.
 *
 * @param dePara código de origem → código na Hexx, escolhido na tela
 */
export async function ensaiarAbertura(
  tx: DbHandle,
  companyId: string,
  linhas: LinhaDeBalancete[],
  dePara: Record<string, string> = {},
): Promise<EnsaioAbertura> {
  const plano = await contasDoPlano(tx, companyId);
  const porCodigo = new Map(plano.map((c) => [c.code, c]));

  const [jaAberta] = (await tx.execute(sql`
    SELECT to_char(entry_date, 'DD/MM/YYYY') AS quando
      FROM journal_entry
     WHERE company_id = ${companyId} AND source = 'OPENING' AND reversed_by IS NULL
     LIMIT 1
  `)) as unknown as { quando: string }[];

  const avisos: string[] = [];
  const conferidas: LinhaConferida[] = [];

  for (const l of linhas) {
    const sugestoes = sugerir(l, plano);

    if (Math.round(l.valor * 100) === 0) {
      conferidas.push({ ...l, situacao: 'ZERADA', sugestoes: [] });
      continue;
    }

    /**
     * Ordem de resolução: escolha do contador, código idêntico, e só então
     * descrição. O de-para vem primeiro de propósito — se ele escolheu,
     * nenhuma heurística tem o direito de discordar.
     */
    let conta: ContaDoPlano | undefined;
    let por: LinhaConferida['por'];

    const escolhido = dePara[l.conta] ?? dePara[chaveDe(l)];
    if (escolhido && porCodigo.has(escolhido)) {
      conta = porCodigo.get(escolhido);
      por = 'DE_PARA';
    } else if (porCodigo.has(l.conta)) {
      conta = porCodigo.get(l.conta);
      por = 'CODIGO';
    }

    if (!conta) {
      conferidas.push({ ...l, situacao: 'SEM_CONTA', sugestoes });
      continue;
    }

    /**
     * Do lado marcado no balancete para o saldo com sinal que `abrirSaldos`
     * espera — que é relativo à NATUREZA da conta.
     *
     * Quando o balancete não marcou lado, o sinal do número é tudo o que há,
     * e ele já vem no formato certo. Quando marcou, a marca manda: `D` numa
     * conta credora é saldo invertido, e vira negativo.
     */
    let saldoAssinado: number;
    if (l.lado) {
      const desejado = l.lado === 'D' ? 'DEBIT' : 'CREDIT';
      saldoAssinado = desejado === conta.nature ? Math.abs(l.valor) : -Math.abs(l.valor);
    } else {
      saldoAssinado = l.valor;
    }

    const ladoFinal: 'DEBIT' | 'CREDIT' =
      saldoAssinado >= 0
        ? conta.nature
        : conta.nature === 'DEBIT'
          ? 'CREDIT'
          : 'DEBIT';

    conferidas.push({
      ...l,
      situacao: 'PRONTA',
      contaHub: conta.code,
      nomeHub: conta.name,
      por,
      sugestoes,
      ladoFinal,
      saldoAssinado,
      invertida: saldoAssinado < 0,
    });
  }

  const prontas = conferidas.filter((l) => l.situacao === 'PRONTA');
  const totalDebito = somar(prontas.filter((l) => l.ladoFinal === 'DEBIT'));
  const totalCredito = somar(prontas.filter((l) => l.ladoFinal === 'CREDIT'));
  const diferenca = Number((totalDebito - totalCredito).toFixed(2));

  /**
   * Duas linhas na mesma conta da Hexx não são erro — o plano de origem é mais
   * detalhado que o nosso, e várias contas dele caem numa só aqui. Mas vale
   * dizer, porque é a diferença entre um de-para deliberado e um clique
   * repetido por engano.
   */
  const usos = new Map<string, number>();
  for (const l of prontas) usos.set(l.contaHub!, (usos.get(l.contaHub!) ?? 0) + 1);
  const agrupadas = [...usos.entries()].filter(([, q]) => q > 1);
  if (agrupadas.length) {
    avisos.push(
      `${agrupadas.length} conta(s) da Hexx recebem saldo de mais de uma conta do balancete — ` +
        'os valores serão somados.',
    );
  }

  const invertidas = prontas.filter((l) => l.invertida);
  if (invertidas.length) {
    avisos.push(
      `${invertidas.length} conta(s) com saldo invertido (devedor onde se espera credor, ou o ` +
        'contrário). Acontece de verdade, mas confira: é o sintoma de coluna trocada na leitura.',
    );
  }

  const pendentes = conferidas.filter((l) => l.situacao === 'SEM_CONTA').length;

  return {
    linhas: conferidas,
    totalDebito,
    totalCredito,
    diferenca,
    fecha: Math.abs(diferenca) < 0.01 && prontas.length > 0,
    pendentes,
    jaAberta: jaAberta?.quando ?? null,
    avisos,
  };
}

/**
 * Grava a abertura, repetindo a conferência antes.
 *
 * Refazer o ensaio aqui não é redundância: entre a tela conferir e o contador
 * confirmar, o plano de contas pode ter mudado, e é este lado que responde
 * pelo que entra no razão.
 */
export async function confirmarAbertura(
  tx: DbHandle,
  companyId: string,
  data: string,
  linhas: LinhaDeBalancete[],
  dePara: Record<string, string>,
  origem?: string,
): Promise<ResultadoAbertura> {
  const ensaio = await ensaiarAbertura(tx, companyId, linhas, dePara);

  if (ensaio.pendentes > 0) {
    throw new Error(
      `${ensaio.pendentes} conta(s) do balancete ainda não têm destino no plano da Hexx. ` +
        'Escolha o destino de cada uma antes de abrir — deixar de fora desequilibra a abertura.',
    );
  }
  if (!ensaio.fecha) {
    throw new Error(
      `O balancete não fecha: débito ${moeda(ensaio.totalDebito)} contra crédito ` +
        `${moeda(ensaio.totalCredito)}, diferença de ${moeda(Math.abs(ensaio.diferenca))}. ` +
        'Confira se alguma linha ficou de fora da leitura ou se o arquivo já vinha assim.',
    );
  }

  const paraAbrir = ensaio.linhas
    .filter((l) => l.situacao === 'PRONTA')
    .map((l) => ({ conta: l.contaHub!, saldo: l.saldoAssinado! }));

  /**
   * Várias linhas na mesma conta viram uma só. `abrirSaldos` monta uma
   * partida, e uma partida com a mesma conta repetida é legal mas ilegível no
   * razão — somar aqui deixa o histórico limpo.
   */
  const somadas = new Map<string, number>();
  for (const l of paraAbrir) somadas.set(l.conta, Number(((somadas.get(l.conta) ?? 0) + l.saldo).toFixed(2)));

  return abrirSaldos(
    tx,
    companyId,
    data,
    [...somadas.entries()].map(([conta, saldo]) => ({ conta, saldo })),
    origem,
  );
}

/* ── Sugestão por descrição ─────────────────────────────────────────────── */

const RUIDO = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'e', 'em', 'para', 'com',
  'conta', 'contas', 'geral', 'outras', 'outros', 'diversos', 'diversas',
]);

/** Sem acento, sem pontuação, em minúsculas — para comparar palavra a palavra. */
function palavras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2 && !RUIDO.has(p));
}

/**
 * Candidatas ordenadas por palavras em comum com a descrição de origem.
 *
 * É deliberadamente simples. Uma medida melhor de similaridade daria uma
 * ordem um pouco melhor, mas a decisão continua sendo do contador — o ganho
 * está em pôr a conta certa entre as três primeiras, e contar palavras já faz
 * isso para "Caixa Geral", "Fornecedores" e "Capital Social", que são a
 * maioria das linhas de um balancete pequeno.
 */
function sugerir(linha: LinhaDeBalancete, plano: ContaDoPlano[]): ContaDoPlano[] {
  const origem = new Set(palavras(linha.descricao));
  if (!origem.size) return [];

  const notas = plano.map((c) => {
    const destino = palavras(c.name);
    const comuns = destino.filter((p) => origem.has(p)).length;
    // Normaliza pelo tamanho para que "Caixa" não perca para uma conta longa
    // que por acaso contém a palavra.
    const nota = comuns === 0 ? 0 : comuns / Math.max(origem.size, destino.length);
    return { conta: c, nota };
  });

  return notas
    .filter((n) => n.nota > 0)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, 3)
    .map((n) => n.conta);
}

/** Identidade de uma linha sem código — descrição serve de chave no de-para. */
function chaveDe(l: LinhaDeBalancete): string {
  return l.conta || `#${l.descricao}`;
}

function somar(linhas: LinhaConferida[]): number {
  return Number(linhas.reduce((t, l) => t + Math.abs(l.saldoAssinado ?? 0), 0).toFixed(2));
}

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
