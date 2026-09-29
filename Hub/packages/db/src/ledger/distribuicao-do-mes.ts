import { sql } from 'drizzle-orm';
import { ACCOUNTS } from '@hexxa/core';
import type { DbHandle } from '../client';
import { postJournal } from './repository';

/**
 * DECLARAÇÃO MENSAL DA DISTRIBUIÇÃO DE LUCROS.
 *
 * O Pix ao sócio (ou a familiar, por conta dele) sai do extrato como débito em
 * Lucros a Pagar. Sem a declaração — débito em Lucros Acumulados, crédito em
 * Lucros a Pagar — essa conta fica devedora e o balanço mostra um "direito"
 * contra o sócio que não existe. No fechamento, declara-se no último dia do
 * mês o que foi pago e ainda não estava declarado.
 *
 * Idempotente pela conta: compara o que o mês pagou com o que o mês já
 * declarou e lança só a diferença.
 */
export async function declararDistribuicaoDoMes(tx: DbHandle, companyId: string, referenceMonth: string): Promise<number> {
  const mes = `${referenceMonth.slice(0, 7)}-01`;
  const [r] = (await tx.execute(sql`
    SELECT
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'DEBIT'), 0)::float AS pago,
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'CREDIT'), 0)::float AS declarado,
      to_char((${mes}::date + interval '1 month' - interval '1 day'), 'YYYY-MM-DD') AS ultimo_dia
      FROM ledger_line l
      JOIN journal_entry j ON j.id = l.journal_entry_id
      JOIN chart_of_account a ON a.id = l.account_id
     WHERE l.company_id = ${companyId} AND j.status = 'POSTED'
       AND j.reference_month = ${mes}::date
       AND a.code = ${ACCOUNTS.LUCROS_A_PAGAR}
  `)) as unknown as { pago: number; declarado: number; ultimo_dia: string }[];
  const falta = Math.round(((r?.pago ?? 0) - (r?.declarado ?? 0)) * 100) / 100;
  if (falta <= 0) return 0;
  await postJournal(tx, companyId, {
    entryDate: r!.ultimo_dia,
    referenceMonth: mes,
    memo: 'Distribuição de lucros do mês — declarada pelo que foi pago aos sócios',
    source: 'PROFIT_DISTRIBUTION',
    sourceId: null,
    event: 'ACCRUAL',
    lines: [
      { accountCode: ACCOUNTS.LUCROS_ACUMULADOS, direction: 'DEBIT', amount: falta },
      { accountCode: ACCOUNTS.LUCROS_A_PAGAR, direction: 'CREDIT', amount: falta },
    ],
  });
  return falta;
}
