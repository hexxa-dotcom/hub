import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * Os dados da Bússola Tributária que não vêm do cálculo do Simples: o
 * faturamento mês a mês e o regime da empresa.
 *
 * Faturamento é só o que tem NOTA — emitida pela Hexx (NFSE) ou trazida do
 * Emissor Nacional (DFE_SYNC) — a mesma regra de `getSimplesInputs`.
 */

export interface MesDeFaturamento {
  mes: string; // AAAA-MM
  valor: number;
  /** O mês corrente, ainda em andamento. */
  atual: boolean;
}

export async function faturamentoMensal(ctx: TenantContext): Promise<MesDeFaturamento[]> {
  const linhas = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT to_char(reference_month, 'YYYY-MM') AS mes, coalesce(sum(amount), 0) AS valor
        FROM financial_entry
       WHERE company_id = ${ctx.companyId}
         AND type = 'RECEIVABLE'
         AND status != 'CANCELED'
         AND source IN ('NFSE', 'DFE_SYNC')
         AND reference_month >= (date_trunc('month', now()) - interval '12 months')::date
       GROUP BY 1
    `),
  )) as unknown as { mes: string; valor: string }[];

  const porMes = new Map(linhas.map((l) => [l.mes, Number(l.valor)]));
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const meses: MesDeFaturamento[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    meses.push({ mes, valor: porMes.get(mes) ?? 0, atual: i === 0 });
  }
  return meses;
}

export async function regimeDaEmpresa(ctx: TenantContext): Promise<'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | null> {
  const [l] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`SELECT tax_regime::text AS regime FROM company WHERE id = ${ctx.companyId}`),
  )) as unknown as { regime: string | null }[];
  return (l?.regime as 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | null) ?? null;
}

/** A última guia de imposto que a contabilidade enviou (DAS no Simples) — o imposto real, não a estimativa. */
export async function ultimaGuiaDeImposto(
  ctx: TenantContext,
): Promise<{ nome: string; valor: number; mes: string; vencimento: string; paga: boolean } | null> {
  const [g] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT tax_name, amount, to_char(reference_month, 'YYYY-MM') AS mes, to_char(due_date, 'YYYY-MM-DD') AS vencimento, status::text AS status
        FROM tax_guide
       WHERE company_id = ${ctx.companyId}
         AND (tax_name ILIKE 'DAS%' OR tax_name ILIKE '%simples%' OR tax_name ILIKE 'DARF%')
       ORDER BY reference_month DESC, due_date DESC
       LIMIT 1
    `),
  )) as unknown as { tax_name: string; amount: string; mes: string; vencimento: string; status: string }[];
  if (!g) return null;
  return { nome: g.tax_name, valor: Number(g.amount), mes: g.mes, vencimento: g.vencimento, paga: g.status === 'PAID' };
}

/**
 * A alíquota que vale para o faturamento do mês — a mesma conta da Bússola,
 * para as Notas e a Bússola mostrarem o mesmo imposto. Apurada pela
 * contabilidade quando houver; senão a efetiva do Simples (ou a da faixa 1,
 * para quem ainda não faturou); no Presumido, a dos tributos federais.
 */
export async function aliquotaDoFaturamento(ctx: TenantContext): Promise<{ aliquota: number; apurada: boolean }> {
  const { getSimplesInputs, enquadramentoApurado, posicaoSimples } = await import('@/lib/server/fiscal');
  const [regime, apurado] = await Promise.all([regimeDaEmpresa(ctx), enquadramentoApurado(ctx)]);
  if (apurado) return { aliquota: apurado.aliquotaEfetiva, apurada: true };
  if (regime === 'LUCRO_PRESUMIDO') {
    const { estimativaPresumido } = await import('@hexxa/core/presumido');
    return { aliquota: estimativaPresumido(10_000).aliquotaEfetiva, apurada: false };
  }
  const entradas = await getSimplesInputs(ctx);
  const s = await posicaoSimples(ctx, { rbt12: entradas.rbt12, folha12: entradas.folha12 });
  return { aliquota: entradas.rbt12 > 0 ? s.effectiveRate : s.nominalRate, apurada: false };
}
