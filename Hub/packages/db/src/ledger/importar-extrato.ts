import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { lerExtrato, type LinhaDeExtrato, type ResultadoLeitura } from '@hexxa/core';

/**
 * IMPORTAÇÃO DO EXTRATO PARA `bank_transaction`.
 *
 * Esta camada faz UMA coisa: transformar o arquivo em linhas de extrato
 * guardadas, sem duplicar. Classificar e escriturar vem depois, e é de
 * propósito que venha depois — o que entrou na conta é fato, e a conta
 * contábil de cada linha é interpretação. Misturar os dois faria um erro de
 * classificação obrigar a reimportar o extrato.
 */

export interface ResultadoImportacao {
  lidas: number;
  novas: number;
  /** Já estavam lá — reimportar o mesmo extrato é seguro e comum. */
  repetidas: number;
  de: string | null;
  ate: string | null;
  banco: string | null;
  conta: string | null;
  /** Linhas do arquivo que não viraram transação, com o motivo. */
  ignoradas: { linha: string; motivo: string }[];
  /** Fora da janela permitida — ver `MESES_DE_HISTORICO`. */
  foraDaJanela: number;
}

/**
 * Até quando para trás um extrato pode trazer lançamento.
 *
 * Cliente novo traz o que tem, e às vezes isso é o extrato do ano inteiro.
 * Mas o que ficou para trás pertence a quem cuidava da empresa antes: o saldo
 * daquele período entra por `abrirSaldos`, não como centenas de lançamentos
 * que ninguém aqui conferiu e que ninguém aqui vai conseguir explicar.
 *
 * Seis meses cobre a troca de contabilidade no meio do ano sem transformar a
 * importação num resgate de arqueologia.
 */
export const MESES_DE_HISTORICO = 6;

/**
 * Lê o arquivo e grava as transações que ainda não existem.
 *
 * ── Como a duplicidade é evitada ────────────────────────────────────────
 *
 * Reimportar o mesmo extrato é normal: o cliente sobe de novo porque não tem
 * certeza se subiu, ou sobe o mês fechado depois de ter subido o parcial. Se
 * isso duplicasse lançamento, o saldo do razão dobraria e ninguém saberia
 * dizer qual das duas linhas é a boa.
 *
 * Quando o arquivo traz identificador do banco (FITID, no OFX), ele é a
 * chave — é exato. Sem ele, a chave é data + valor + descrição, que é bom o
 * bastante na prática: duas transações idênticas no mesmo dia, com a mesma
 * descrição e o mesmo valor, são indistinguíveis até para quem olha o
 * extrato.
 */
export async function importarExtrato(
  tx: DbHandle,
  companyId: string,
  bankAccountId: string,
  conteudo: string,
  opts: { limiteDeMeses?: number } = {},
): Promise<ResultadoImportacao> {
  const lido: ResultadoLeitura = lerExtrato(conteudo);

  const meses = opts.limiteDeMeses ?? MESES_DE_HISTORICO;
  const corte = new Date();
  corte.setUTCMonth(corte.getUTCMonth() - meses);
  const dataCorte = corte.toISOString().slice(0, 10);

  const dentro: LinhaDeExtrato[] = [];
  let foraDaJanela = 0;
  for (const l of lido.linhas) {
    if (l.data < dataCorte) { foraDaJanela++; continue; }
    dentro.push(l);
  }

  let novas = 0;
  let repetidas = 0;

  for (const l of dentro) {
    const [existente] = (await tx.execute(
      l.idExterno
        ? sql`
            SELECT id FROM bank_transaction
             WHERE company_id = ${companyId}
               AND bank_account_id = ${bankAccountId}
               AND external_id = ${l.idExterno}
             LIMIT 1
          `
        : sql`
            SELECT id FROM bank_transaction
             WHERE company_id = ${companyId}
               AND bank_account_id = ${bankAccountId}
               AND posted_at = ${l.data}::date
               AND amount = ${l.valor.toFixed(2)}::numeric
               AND description = ${l.descricao}
             LIMIT 1
          `,
    )) as unknown as { id: string }[];

    if (existente) { repetidas++; continue; }

    await tx.execute(sql`
      INSERT INTO bank_transaction
        (company_id, bank_account_id, external_id, posted_at, amount, description)
      VALUES (${companyId}, ${bankAccountId}, ${l.idExterno},
              ${l.data}::date, ${l.valor.toFixed(2)}::numeric, ${l.descricao})
    `);
    novas++;
  }

  return {
    lidas: lido.linhas.length,
    novas,
    repetidas,
    de: lido.de,
    ate: lido.ate,
    banco: lido.banco,
    conta: lido.conta,
    ignoradas: lido.ignoradas,
    foraDaJanela,
  };
}
