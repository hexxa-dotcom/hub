import 'server-only';
import type { TenantContext } from '@hexxa/core';
import { TaxThermometerService } from '@hexxa/core';
import { withTenant, getDb, sql } from '@hexxa/db';
import { getSimplesInputs, posicaoSimples } from './fiscal';
import type { ReportCompanyIdentity } from './pdf/report-pdf';

/**
 * Cálculo dos relatórios financeiros — extraído das páginas
 * (meu-negocio/relatorios/*) pra ser a MESMA fonte usada tanto na tela
 * quanto no PDF gerado pra download/assinatura. Sem isso, tela e PDF podiam
 * divergir com o tempo (cada um evoluindo a query separadamente).
 */

export async function getCompanyIdentity(ctx: TenantContext): Promise<ReportCompanyIdentity> {
  const [row] = await getDb().execute(sql`
    SELECT legal_name, trade_name, use_trade_name, cnpj, address_line1, address_number, neighborhood, city, state, zipcode
    FROM company WHERE id = ${ctx.companyId} LIMIT 1
  `);
  const legalName: string =
    (row?.use_trade_name ? (row?.trade_name as string | null) : null) || (row?.legal_name as string | null) || 'Empresa';
  const cnpjRaw = row?.cnpj as string | undefined;
  const cnpj = cnpjRaw ? cnpjRaw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : null;
  const address = [row?.address_line1, row?.address_number, row?.neighborhood, row?.city, row?.state]
    .filter(Boolean)
    .join(', ') || null;
  return { legalName, cnpj, address };
}

// ── Balanço e DRE ────────────────────────────────────────────────────────────

export type BalancoEntry = { amount: number; type: string; status: string; reference_month: string; description: string | null; category_name: string | null };

export type BalancoMonthSummary = {
  month: string;
  receita: number;
  despesasOperacionais: number;
  prolabore: number;
  impostoEstimado: number;
  lucroLiquido: number;
};

export function monthLabel(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function monthLabelShort(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

export function lastNMonths(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }
  return out;
}

export function summarizeBalanco(entries: BalancoEntry[], effectiveRate: number) {
  const receita = entries.filter((e) => e.type === 'RECEIVABLE').reduce((s, e) => s + Number(e.amount), 0);
  const prolabore = entries
    .filter((e) => e.type === 'PAYABLE' && String(e.description || '').startsWith('Pró-labore'))
    .reduce((s, e) => s + Number(e.amount), 0);
  const despesasOperacionais = entries
    .filter((e) => e.type === 'PAYABLE' && !String(e.description || '').startsWith('Pró-labore'))
    .reduce((s, e) => s + Number(e.amount), 0);
  const impostoEstimado = receita * (effectiveRate / 100);
  const lucroLiquido = receita - despesasOperacionais - prolabore - impostoEstimado;
  return { receita, prolabore, despesasOperacionais, impostoEstimado, lucroLiquido };
}

export interface BalancoDreData {
  periodoLabel: string;
  deOrdered: string;
  ateOrdered: string;
  options: string[];
  hasData: boolean;
  receita: number;
  prolabore: number;
  despesasOperacionais: number;
  impostoEstimado: number;
  lucroLiquido: number;
  despesasTotais: number;
  margem: number;
  categorias: [string, number][];
  monthly: BalancoMonthSummary[];
  simples: { effectiveRate: number; anexo: string; fatorR: number; fatorRFavorable: boolean; fonte: 'APURADO' | 'ESTIMADO' };
  rbt12: number;
}

export async function getBalancoDreData(ctx: TenantContext, params: { de?: string; ate?: string }): Promise<BalancoDreData> {
  const options = lastNMonths(12);
  const curMonth = options[0]!;
  const oldestMonth = options[options.length - 1]!;
  const de = params.de && options.includes(params.de) ? params.de : curMonth;
  const ate = params.ate && options.includes(params.ate) ? params.ate : curMonth;
  const [deOrdered, ateOrdered] = de <= ate ? [de, ate] : [ate, de];

  const { rbt12, folha12 } = await getSimplesInputs(ctx);
  const simples = await posicaoSimples(ctx, { rbt12, folha12 });

  const allEntries = await withTenant(ctx.companyId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT fe.amount, fe.type, fe.status, fe.reference_month, fe.description,
             c.name AS category_name
      FROM financial_entry fe
      LEFT JOIN category c ON c.id = fe.category_id
      WHERE fe.company_id = ${ctx.companyId}
        AND fe.status != 'CANCELED'
        AND fe.reference_month >= ${oldestMonth}
        AND fe.reference_month <= ${curMonth}
    `);
    return rows as unknown as BalancoEntry[];
  });

  const entries = allEntries.filter((e) => e.reference_month >= deOrdered && e.reference_month <= ateOrdered);
  const { receita, prolabore, despesasOperacionais, impostoEstimado, lucroLiquido } = summarizeBalanco(entries, simples.effectiveRate);
  const despesasTotais = despesasOperacionais + prolabore + impostoEstimado;
  const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

  const byCat = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'PAYABLE') continue;
    if (String(e.description || '').startsWith('Pró-labore')) continue;
    const key = e.category_name?.trim() || 'Sem categoria';
    byCat.set(key, (byCat.get(key) ?? 0) + Number(e.amount));
  }
  const categorias = [...byCat.entries()].sort(([, a], [, b]) => b - a);

  const monthly: BalancoMonthSummary[] = [...options]
    .reverse()
    .map((m) => ({ month: m, ...summarizeBalanco(allEntries.filter((e) => e.reference_month === m), simples.effectiveRate) }));

  const periodoLabel = deOrdered === ateOrdered ? monthLabel(deOrdered) : `${monthLabel(deOrdered)} a ${monthLabel(ateOrdered)}`;

  return {
    periodoLabel, deOrdered, ateOrdered, options, hasData: entries.length > 0,
    receita, prolabore, despesasOperacionais, impostoEstimado, lucroLiquido, despesasTotais, margem,
    categorias, monthly, simples, rbt12,
  };
}

// ── Faturamento (mensal/anual) ──────────────────────────────────────────────

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface FaturamentoData {
  ano: string;
  anosDisponiveis: string[];
  meses: { label: string; valor: number }[];
  totalAnoMensal: number;
  anual: { ano: string; receita: number; despesas: number; impostoEstimado: number; lucroLiquido: number; margem: number }[];
}

export async function getFaturamentoData(ctx: TenantContext, params: { ano?: string }): Promise<FaturamentoData> {
  const { receitaPorMes, despesaPorAno } = await withTenant(ctx.companyId, async (tx) => {
    const receitaRows = await tx.execute(sql`
      SELECT to_char(reference_month, 'YYYY') AS ano, to_char(reference_month, 'YYYY-MM') AS mes, coalesce(sum(amount), 0) AS total
      FROM financial_entry
      WHERE company_id = ${ctx.companyId} AND type = 'RECEIVABLE' AND status != 'CANCELED'
      GROUP BY 1, 2
      ORDER BY 2
    `);
    const despesaRows = await tx.execute(sql`
      SELECT to_char(reference_month, 'YYYY') AS ano, coalesce(sum(amount), 0) AS total
      FROM financial_entry
      WHERE company_id = ${ctx.companyId} AND type = 'PAYABLE' AND status != 'CANCELED'
      GROUP BY 1
    `);
    return {
      receitaPorMes: receitaRows as unknown as { ano: string; mes: string; total: string }[],
      despesaPorAno: new Map(despesaRows.map((r) => [r.ano as string, Number(r.total)])),
    };
  });

  const anoAtual = String(new Date().getFullYear());
  const anosDisponiveis = Array.from(new Set([anoAtual, ...receitaPorMes.map((r) => r.ano)])).sort().reverse();
  const ano = params.ano && anosDisponiveis.includes(params.ano) ? params.ano : anoAtual;

  const { rbt12, folha12 } = await getSimplesInputs(ctx);
  const simples = await posicaoSimples(ctx, { rbt12, folha12 });

  const receitaPorMesDoAno = new Map(
    receitaPorMes.filter((r) => r.ano === ano).map((r) => [r.mes.slice(5, 7), Number(r.total)]),
  );
  const meses = MESES_CURTO.map((label, i) => ({
    label,
    valor: receitaPorMesDoAno.get(String(i + 1).padStart(2, '0')) ?? 0,
  }));
  const totalAnoMensal = meses.reduce((s, m) => s + m.valor, 0);

  const anual = anosDisponiveis
    .map((a) => {
      const receita = receitaPorMes.filter((r) => r.ano === a).reduce((s, r) => s + Number(r.total), 0);
      const despesas = despesaPorAno.get(a) ?? 0;
      const impostoEstimado = receita * (simples.effectiveRate / 100);
      const lucroLiquido = receita - despesas - impostoEstimado;
      const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
      return { ano: a, receita, despesas, impostoEstimado, lucroLiquido, margem };
    })
    .filter((r) => r.receita > 0 || r.ano === anoAtual);

  return { ano, anosDisponiveis, meses, totalAnoMensal, anual };
}

// ── Faturamento por Cliente ──────────────────────────────────────────────────

export const SEM_CLIENTE = 'Outros / sem cliente identificado';

export interface FaturamentoPorClienteData {
  ano: string;
  anos: string[];
  receitaTotal: number;
  margemLiquidaAno: number;
  clientes: { nome: string; receita: number; participacao: number; margemEstimada: number }[];
}

export async function getFaturamentoPorClienteData(ctx: TenantContext, params: { ano?: string }): Promise<FaturamentoPorClienteData> {
  const { porCliente, despesaPorAno } = await withTenant(ctx.companyId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT
        to_char(fe.reference_month, 'YYYY') AS ano,
        coalesce(c.name, ndd.tomador_nome, ${SEM_CLIENTE}) AS cliente,
        fe.amount AS amount
      FROM financial_entry fe
      LEFT JOIN service_invoice si ON fe.source = 'NFSE' AND si.id = fe.source_id
      LEFT JOIN customer c ON c.id = si.customer_id
      LEFT JOIN nfse_distribuicao_doc ndd ON fe.source = 'DFE_SYNC' AND ndd.company_id = fe.company_id AND ndd.chave_acesso = fe.external_id
      WHERE fe.company_id = ${ctx.companyId} AND fe.type = 'RECEIVABLE' AND fe.status != 'CANCELED'
    `);
    const despesaRows = await tx.execute(sql`
      SELECT to_char(reference_month, 'YYYY') AS ano, coalesce(sum(amount), 0) AS total
      FROM financial_entry
      WHERE company_id = ${ctx.companyId} AND type = 'PAYABLE' AND status != 'CANCELED'
      GROUP BY 1
    `);
    return {
      porCliente: rows as unknown as { ano: string; cliente: string; amount: string }[],
      despesaPorAno: new Map(despesaRows.map((r) => [r.ano as string, Number(r.total)])),
    };
  });

  const anoAtual = String(new Date().getFullYear());
  const anos = Array.from(new Set([anoAtual, ...porCliente.map((r) => r.ano)])).sort().reverse();
  const ano = params.ano && anos.includes(params.ano) ? params.ano : anoAtual;

  const { rbt12, folha12 } = await getSimplesInputs(ctx);
  const simples = await posicaoSimples(ctx, { rbt12, folha12 });

  const doAno = porCliente.filter((r) => r.ano === ano);
  const receitaTotal = doAno.reduce((s, r) => s + Number(r.amount), 0);
  const despesasAno = despesaPorAno.get(ano) ?? 0;
  const impostoEstimado = receitaTotal * (simples.effectiveRate / 100);
  const lucroLiquidoAno = receitaTotal - despesasAno - impostoEstimado;
  const margemLiquidaAno = receitaTotal > 0 ? lucroLiquidoAno / receitaTotal : 0;

  const porClienteAgrupado = new Map<string, number>();
  for (const r of doAno) {
    porClienteAgrupado.set(r.cliente, (porClienteAgrupado.get(r.cliente) ?? 0) + Number(r.amount));
  }
  const clientes = Array.from(porClienteAgrupado.entries())
    .map(([nome, receita]) => ({
      nome,
      receita,
      participacao: receitaTotal > 0 ? (receita / receitaTotal) * 100 : 0,
      margemEstimada: receita * margemLiquidaAno,
    }))
    .sort((a, b) => b.receita - a.receita);

  return { ano, anos, receitaTotal, margemLiquidaAno, clientes };
}
