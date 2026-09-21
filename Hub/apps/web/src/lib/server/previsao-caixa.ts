import { withTenant, sql } from '@hexxa/db';
import {
  projetarCaixa,
  posicaoNoTeto,
  type PrevisaoDeCaixa,
  type PosicaoNoTeto,
  type CompromissoFuturo,
  type TenantContext,
} from '@hexxa/core';
import { getCaixaLivre } from './caixa-livre';
import { getSimplesInputs } from './fiscal';

const HORIZONTE_DIAS = 90;

/**
 * A previsão de 90 dias com os compromissos reais da empresa.
 *
 * A projeção em si é pura e testada em `projetarCaixa`. Aqui se busca o que
 * ela pede: saldo de partida, o que está lançado a pagar e a receber, e as
 * despesas recorrentes que ainda não viraram lançamento.
 */
export interface PrevisaoDaEmpresa extends PrevisaoDeCaixa {
  /** `false` quando o razão ainda não conhece o saldo bancário. */
  saldoConhecido: boolean;
  saldoInicial: number;
}

export async function getPrevisaoCaixa(ctx: TenantContext): Promise<PrevisaoDaEmpresa> {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  /**
   * O ponto de partida é o LIVRE, não o saldo do banco.
   *
   * Projetar a partir do saldo bruto contaria duas vezes o que já está
   * provisionado: o DAS de setembro sairia do saldo agora e de novo quando a
   * guia for lançada com vencimento em outubro. O livre já está líquido de
   * tudo que o razão conhece — o que entra na projeção daqui para a frente é
   * só o que ainda não foi reconhecido.
   */
  const caixa = await getCaixaLivre(ctx);

  const compromissos = await withTenant(ctx.companyId, async (tx) => {
    const [lancamentos, recorrentes] = await Promise.all([
      tx.execute(sql`
        SELECT to_char(due_date, 'YYYY-MM-DD') AS data, amount, description, type
        FROM financial_entry
        WHERE company_id = ${ctx.companyId}
          AND status = 'PENDING'
          AND due_date <= (now() + interval '${sql.raw(String(HORIZONTE_DIAS))} days')::date
        ORDER BY due_date
      `),
      tx.execute(sql`
        SELECT description, amount, due_day, type
        FROM recurring_expense
        WHERE company_id = ${ctx.companyId}
          AND active = true
          AND (end_month IS NULL OR end_month >= date_trunc('month', now())::date)
      `),
    ]);
    return { lancamentos, recorrentes };
  });

  const lista: CompromissoFuturo[] = (
    compromissos.lancamentos as unknown as {
      data: string;
      amount: string;
      description: string;
      type: string;
    }[]
  ).map((l) => ({
    data: l.data,
    valor: Number(l.amount),
    descricao: l.description,
    entrada: l.type === 'RECEIVABLE',
  }));

  /**
   * Recorrente que ainda não virou lançamento.
   *
   * O aluguel de novembro só existe como regra até alguém gerá-lo. Ignorá-lo
   * mostraria novembro folgado, que é justamente o mês que a projeção existe
   * para avisar. Só se acrescenta o que NÃO tem lançamento no mesmo mês, para
   * não contar duas vezes o que já foi gerado.
   */
  const mesesComLancamento = new Set(lista.map((l) => l.data.slice(0, 7)));
  for (const r of compromissos.recorrentes as unknown as {
    description: string;
    amount: string;
    due_day: number;
    type: string;
  }[]) {
    for (let i = 0; i <= 3; i++) {
      const base = new Date(`${hoje}T12:00:00Z`);
      base.setUTCMonth(base.getUTCMonth() + i, 1);
      const mes = base.toISOString().slice(0, 7);
      const data = `${mes}-${String(r.due_day).padStart(2, '0')}`;
      if (data < hoje) continue;
      if (mesesComLancamento.has(mes)) continue;
      lista.push({
        data,
        valor: Number(r.amount),
        descricao: r.description,
        entrada: r.type === 'RECEIVABLE',
      });
    }
  }

  return {
    ...projetarCaixa({
      saldoInicial: caixa.livre,
      compromissos: lista,
      hoje,
      dias: HORIZONTE_DIAS,
    }),
    saldoConhecido: caixa.saldoConhecido,
    saldoInicial: caixa.livre,
  };
}

/* ── Teto do Simples ─────────────────────────────────────────────────── */

export interface TetoDaEmpresa extends PosicaoNoTeto {
  /** `true` quando o RBT12 veio da apuração do contábil, não de estimativa. */
  apurado: boolean;
}

export async function getPosicaoNoTeto(ctx: TenantContext): Promise<TetoDaEmpresa | null> {
  const entradas = await getSimplesInputs(ctx);
  if (!(entradas.rbt12 > 0)) return null;

  const [limiteRow] = (await withTenant(ctx.companyId, async (tx) =>
    tx.execute(sql`
      SELECT parameters FROM tax_regime_setting
      WHERE setting_code = 'SIMPLES_NACIONAL_LIMITS' AND valid_from <= now()::date
      ORDER BY valid_from DESC LIMIT 1
    `),
  )) as unknown as { parameters: { revenueCeiling?: number } }[];

  const limite = Number(limiteRow?.parameters?.revenueCeiling ?? 4_800_000);
  const mesCorrente = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    .slice(0, 7);

  return {
    ...posicaoNoTeto({
      rbt12: entradas.rbt12,
      mediaMensal: entradas.rbt12 / 12,
      limite,
      mesCorrente,
    }),
    apurado: entradas.rbt12Fonte === 'APURADO',
  };
}
