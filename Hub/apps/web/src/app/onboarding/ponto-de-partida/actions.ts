'use server';

import { getDb, sql, withTenant, abrirSaldos } from '@hexxa/db';
import { ACCOUNTS } from '@hexxa/core';
import { getTenantContext } from '@/lib/server/tenant';
import { revalidatePath } from 'next/cache';

const ACCOUNTS_DE_ABERTURA = {
  BANCOS: ACCOUNTS.BANCOS,
  LUCROS_ACUMULADOS: ACCOUNTS.LUCROS_ACUMULADOS,
};

/**
 * O PONTO DE PARTIDA, EM DOIS NÚMEROS.
 *
 * ── Por que não um balancete ───────────────────────────────────────────
 *
 * `abrirSaldos` aceita um balancete inteiro, e é o caminho certo quando ele
 * existe — o contador já tem essa tela. Mas quem está abrindo o Hub sozinho,
 * cinco minutos depois de pagar, não tem balancete à mão; pedir um é o mesmo
 * que dizer "volte quando falar com seu contador". A pessoa não volta.
 *
 * Dois números ela sabe de cabeça: quanto tem na conta hoje e quanto faturou
 * no último ano. E os dois bastam para ligar o essencial — o saldo livre, o
 * termômetro de imposto, a previsão de caixa e o teto do Simples.
 *
 * ── Por que o saldo vira Lucros Acumulados ─────────────────────────────
 *
 * Toda partida precisa de contrapartida. O dinheiro que já estava na conta
 * antes de o Hub existir veio do resultado passado da empresa — não de
 * integralização de capital nova, que seria afirmar um ato societário que não
 * aconteceu. Lucros Acumulados é a conta honesta para "veio de antes", e o
 * contador reclassifica depois se for o caso.
 */
export type EstadoDoPontoDePartida = { ok: boolean; message: string };

export async function salvarPontoDePartida(
  _prev: EstadoDoPontoDePartida,
  formData: FormData,
): Promise<EstadoDoPontoDePartida> {
  const ctx = await getTenantContext();

  const numero = (v: FormDataEntryValue | null) => {
    const texto = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = Number(texto);
    return Number.isFinite(n) ? n : NaN;
  };

  const saldo = numero(formData.get('saldo'));
  const faturamento = numero(formData.get('faturamento'));
  const data = String(formData.get('data') ?? '').trim();

  if (!Number.isFinite(saldo)) {
    return { ok: false, message: 'Informe quanto há hoje na conta da empresa.' };
  }
  if (!Number.isFinite(faturamento) || faturamento < 0) {
    return { ok: false, message: 'Informe quanto a empresa faturou nos últimos 12 meses.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { ok: false, message: 'Informe a data do saldo.' };
  }

  try {
    await withTenant(ctx.companyId, async (tx) => {
      /**
       * Saldo zero também é resposta.
       *
       * Empresa recém-aberta tem conta zerada, e isso é informação: sem a
       * partida de abertura, o Hub não sabe se o saldo é zero ou se ninguém
       * contou — e é essa diferença que faz o card do caixa livre falar ou
       * se calar. Por isso grava-se a abertura mesmo com zero.
       */
      await abrirSaldos(
        tx,
        ctx.companyId,
        data,
        [
          { conta: ACCOUNTS.BANCOS, saldo },
          { conta: ACCOUNTS.LUCROS_ACUMULADOS, saldo },
        ],
        'Ponto de partida informado no primeiro acesso',
      );

      // O faturamento declarado é referência, não lançamento: ele não tem
      // nota, e receita sem nota nunca vira partida no razão. Fica no
      // cadastro para o termômetro ter de onde partir enquanto não há
      // histórico próprio.
      await tx.execute(sql`
        UPDATE company
           SET declared_revenue_12m = ${faturamento}, declared_revenue_at = ${data}::date
         WHERE id = ${ctx.companyId}
      `);
    });
  } catch (err) {
    console.error('[ponto-de-partida] falhou:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Não consegui gravar o ponto de partida.',
    };
  }

  revalidatePath('/cliente');
  return { ok: true, message: 'Pronto. Seu Hub já está funcionando.' };
}

/** O que já foi informado, para a tela não pedir de novo o que existe. */
export async function lerPontoDePartida(): Promise<{ saldo: number | null; faturamento: number | null }> {
  const ctx = await getTenantContext();
  const db = getDb();
  const [r] = (await db.execute(sql`
    SELECT
      (SELECT COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0)
         FROM ledger_line l
         JOIN journal_entry j ON j.id = l.journal_entry_id
         JOIN chart_of_account a ON a.id = l.account_id
        WHERE l.company_id = ${ctx.companyId} AND j.source = 'OPENING'
          AND a.code = ${'1.1.01.002'}) AS saldo,
      (SELECT declared_revenue_12m FROM company WHERE id = ${ctx.companyId}) AS faturamento
  `)) as unknown as { saldo: string | null; faturamento: string | null }[];

  return {
    saldo: r?.saldo === null || r?.saldo === undefined ? null : Number(r.saldo),
    faturamento: r?.faturamento === null || r?.faturamento === undefined ? null : Number(r.faturamento),
  };
}
