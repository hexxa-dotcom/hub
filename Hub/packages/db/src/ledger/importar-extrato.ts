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
  /** Anteriores ao início da janela — ver `inicioDaJanelaDeExtrato`. */
  foraDaJanela: number;
  /** Primeiro dia aceito, 'AAAA-MM-DD'. */
  janelaDesde: string;
}

/**
 * Primeiro dia aceito num extrato: 1º de janeiro do ano corrente.
 *
 * Regra do escritório: a operação lança só a competência do ano vigente.
 * Cliente que chega no meio do ano entra com o balanço de 31/12 do ano
 * anterior (saldos de abertura) e o extrato de janeiro em diante — o que
 * ficou antes disso é do exercício anterior, fechado, e não recebe
 * lançamento daqui.
 *
 * A única folga é janeiro: o fechamento de dezembro acontece em janeiro, e
 * sem ela o extrato de dezembro seria recusado justamente no mês em que ele
 * é fechado. Em janeiro, portanto, dezembro do ano anterior ainda entra.
 *
 * @param hoje 'AAAA-MM-DD' no fuso de São Paulo (padrão: agora).
 */
export function inicioDaJanelaDeExtrato(hoje?: string): string {
  const dia = hoje ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const ano = Number(dia.slice(0, 4));
  const mes = Number(dia.slice(5, 7));
  return mes === 1 ? `${ano - 1}-12-01` : `${ano}-01-01`;
}

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
  opts: { hoje?: string } = {},
): Promise<ResultadoImportacao> {
  const lido: ResultadoLeitura = lerExtrato(conteudo);

  const dataCorte = inicioDaJanelaDeExtrato(opts.hoje);

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
    janelaDesde: dataCorte,
  };
}
