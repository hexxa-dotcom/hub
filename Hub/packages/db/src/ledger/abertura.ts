import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import {
  openingBalance,
  natureOf,
  type SaldoDeAbertura,
  type Direction,
  type AccountType,
} from '@hexxa/core';
import { ensureChartOfAccounts, postJournal } from './repository';
import { conferirBalanco } from './apuracao';

/**
 * ABERTURA DE UMA EMPRESA QUE CHEGA NO MEIO DO CAMINHO.
 *
 * O cliente que troca de contabilidade não traz lançamentos — traz um
 * balancete do escritório anterior. Esta é a porta por onde esse balancete
 * entra: uma única partida, datada no último dia do período que veio pronto,
 * com os saldos de cada conta.
 *
 * Daí em diante a Hexx escritura normalmente, e o balanço já nasce com o
 * passado da empresa dentro dele.
 *
 * ── O que NÃO é ────────────────────────────────────────────────────────
 *
 * Não é importação de histórico. Os lançamentos que produziram esses saldos
 * ficaram com quem os fez, e é assim que deve ser: reconstruí-los a partir de
 * um balancete seria inventar detalhe que ninguém verificou.
 */

export interface LinhaDeAbertura {
  /** Código no plano de contas da Hexx. */
  conta: string;
  /**
   * Saldo COM SINAL segundo a natureza da conta.
   *
   * Positivo = saldo normal (devedor no ativo, credor no passivo). Negativo
   * inverte o lado — banco a descoberto, adiantamento de cliente já
   * consumido. É o mesmo jeito que um balancete apresenta, e por isso é o
   * jeito que o contador vai digitar.
   */
  saldo: number;
}

export interface ResultadoAbertura {
  journalEntryId: string | null;
  linhas: number;
  debito: number;
  credito: number;
  /** Contas do balancete que não existem no plano de contas da Hexx. */
  desconhecidas: string[];
  /** Depois de abrir: Ativo = Passivo + PL? */
  balancoFecha: boolean;
  diferenca: number;
}

/**
 * Grava os saldos de abertura de uma empresa.
 *
 * @param data último dia do período que veio pronto (ex.: '2025-12-31')
 * @param origem de onde veio o balancete, para ficar no histórico da partida
 */
export async function abrirSaldos(
  tx: DbHandle,
  companyId: string,
  data: string,
  linhas: LinhaDeAbertura[],
  origem?: string,
): Promise<ResultadoAbertura> {
  await ensureChartOfAccounts(tx, companyId);

  const existentes = (await tx.execute(sql`
    SELECT code, type FROM chart_of_account
     WHERE company_id = ${companyId} AND analytical = true
  `)) as unknown as { code: string; type: AccountType }[];
  const conhecidas = new Map(existentes.map((c) => [c.code, c.type]));

  const desconhecidas: string[] = [];
  const saldos: SaldoDeAbertura[] = [];

  for (const l of linhas) {
    const tipo = conhecidas.get(l.conta);
    if (!tipo) {
      // Conta que a Hexx não tem é informação perdida, não linha a descartar.
      // Nomeá-la deixa a decisão com quem tem o balancete: mapear para outra
      // conta, ou criar a conta que falta.
      desconhecidas.push(l.conta);
      continue;
    }
    if (Math.round(l.saldo * 100) === 0) continue;

    /**
     * O lado vem da NATUREZA da conta, não de quem digitou.
     *
     * Ativo e despesa são devedoras; passivo, patrimônio líquido e receita
     * são credoras. Saldo negativo inverte. Derivar assim evita o erro mais
     * comum na transcrição de um balancete — trocar a coluna —, que produz um
     * balanço que fecha e está errado.
     */
    const normal: Direction = natureOf(tipo);
    const invertido: Direction = normal === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    saldos.push({
      accountCode: l.conta,
      amount: Math.abs(l.saldo),
      direction: l.saldo >= 0 ? normal : invertido,
    });
  }

  const debito = saldos.filter((s) => s.direction === 'DEBIT').reduce((t, s) => t + s.amount, 0);
  const credito = saldos.filter((s) => s.direction === 'CREDIT').reduce((t, s) => t + s.amount, 0);

  if (desconhecidas.length) {
    return {
      journalEntryId: null, linhas: saldos.length, debito, credito,
      desconhecidas, balancoFecha: false, diferenca: debito - credito,
    };
  }

  /**
   * Uma empresa abre UMA vez.
   *
   * A checagem é explícita porque a chave de idempotência do razão cobre
   * apenas `ACCRUAL` e `SETTLEMENT` — de propósito, para que estornos possam
   * se repetir. A abertura é `ADJUSTMENT` e escapava dela: na primeira versão
   * deste arquivo, rodar duas vezes DOBROU todos os saldos, e o balanço
   * continuou fechando, porque dobrar os dois lados fecha.
   *
   * Corrigir uma abertura errada é por estorno, como qualquer outra partida —
   * não por rodar de novo com os números certos.
   */
  const [jaAberta] = (await tx.execute(sql`
    SELECT to_char(entry_date, 'DD/MM/YYYY') AS quando
      FROM journal_entry
     WHERE company_id = ${companyId} AND source = 'OPENING' AND reversed_by IS NULL
     LIMIT 1
  `)) as unknown as { quando: string }[];

  if (jaAberta) {
    throw new Error(
      `Esta empresa já tem saldos de abertura, lançados em ${jaAberta.quando}. ` +
        'Para corrigi-los, estorne a abertura existente — reabrir por cima ' +
        'somaria os saldos aos que já estão lá, e o balanço continuaria fechando.',
    );
  }

  const id = uuidDe(`abertura:${companyId}:${data}`);
  const draft = openingBalance({ id, date: data, saldos, origem });
  const r = await postJournal(tx, companyId, draft);

  const conf = await conferirBalanco(tx, companyId, '2999-12-01');

  return {
    journalEntryId: r.journalEntryId ?? null,
    linhas: saldos.length,
    debito,
    credito,
    desconhecidas: [],
    balancoFecha: conf.fecha,
    diferenca: conf.diff,
  };
}

function uuidDe(chave: string): string {
  const h = createHash('sha1').update(chave).digest('hex');
  return [
    h.slice(0, 8), h.slice(8, 12), '5' + h.slice(13, 16),
    ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
}
