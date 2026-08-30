import { GlassCard } from '@/components/ui/GlassCard';
import { LABELS } from '@hexxa/core/language';
import { TaxThermometerService } from '@hexxa/core';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Percent,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  DollarSign,
  Wallet,
  Building2,
  Users,
  Coins,
  ArrowUpRight,
} from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { withTenant, sql } from '@hexxa/db';
import { RevenueChart } from './RevenueChart';
import { DueDatesTimeline } from './DueDatesTimeline';
import { HealthScoreCard } from './HealthScoreCard';
import { CashflowForecast, type CashflowDay } from './CashflowForecast';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import Link from 'next/link';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number, d = 1) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: d })}%`;
const rate = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

type Entry = {
  id?: string;
  amount: number | string;
  type: string;
  status: string;
  reference_month: string;
  due_date: string | null;
  description?: string;
  category_name?: string | null;
  created_at: string | Date;
};

const CAT_COLORS = ['#2F4A3C', '#A2C1CD', '#5F6E46', '#8FA85B'];
const OUTROS_COLOR = '#C5BBAA';

function buildCategorias(receivables: Entry[]) {
  const byCat = new Map<string, number>();
  for (const r of receivables) {
    const key = r.category_name?.trim() || 'Sem categoria';
    byCat.set(key, (byCat.get(key) ?? 0) + Number(r.amount));
  }
  const total = [...byCat.values()].reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  const sorted = [...byCat.entries()].sort(([, a], [, b]) => b - a);
  const top = sorted.slice(0, CAT_COLORS.length);
  const tail = sorted.slice(CAT_COLORS.length);
  const items = top.map(([label, value], i) => ({
    label,
    value,
    pct: (value / total) * 100,
    color: CAT_COLORS[i]!,
  }));
  const tailSum = tail.reduce((s, [, v]) => s + v, 0);
  if (tailSum > 0) {
    items.push({ label: 'Outros', value: tailSum, pct: (tailSum / total) * 100, color: OUTROS_COLOR });
  }
  return items;
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(now);
  const todayIso = now.toISOString().slice(0, 10);

  let entries: Entry[] = [];
  let rbt12 = 0;
  let folha12 = 0;
  let issuingCount = 0;
  let lastClosureDate: string | null = null;
  let openDasGuide: { amount: number; dueDate: string } | null = null;
  let loadError = false;
  let companyId = '';
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const ctx = await getTenantContext();
    companyId = ctx.companyId;
    const simples12 = await getSimplesInputs(ctx);
    rbt12 = simples12.rbt12;
    folha12 = simples12.folha12;
    const data = await withTenant(ctx.companyId, async (tx) => {
      const fe = await tx.execute(sql`
        SELECT fe.id, fe.amount, fe.type, fe.status, fe.reference_month, fe.due_date, fe.description,
               fe.created_at, c.name AS category_name
        FROM financial_entry fe
        LEFT JOIN category c ON c.id = fe.category_id
        WHERE fe.company_id = ${ctx.companyId} AND fe.status != 'CANCELED'
      `);
      const issuing = await tx.execute(sql`
        SELECT count(*)::int AS n FROM service_invoice
        WHERE company_id = ${ctx.companyId} AND status = 'ISSUING'
      `);
      const closure = await tx.execute(sql`
        SELECT id FROM monthly_closure
        WHERE company_id = ${ctx.companyId} AND reference_month = ${lastMonthStr}
        LIMIT 1
      `);
      const dasGuide = await tx.execute(sql`
        SELECT amount, due_date FROM tax_guide
        WHERE company_id = ${ctx.companyId} AND tax_name = 'DAS - Simples Nacional' AND status = 'OPEN'
        ORDER BY due_date DESC
        LIMIT 1
      `);
      return {
        entries: fe as unknown as Entry[],
        issuing: Number(issuing[0]?.n ?? 0),
        hasClosure: closure.length > 0,
        dasGuide: dasGuide[0] ? { amount: Number(dasGuide[0].amount), dueDate: String(dasGuide[0].due_date) } : null,
      };
    });
    entries = data.entries;
    issuingCount = data.issuing;
    if (data.hasClosure) lastClosureDate = lastMonthStr;
    openDasGuide = data.dasGuide;
  } catch (err) {
    console.error('[dashboard/page] falha ao carregar dados do dashboard:', err);
    loadError = true;
  }

  // Cálculos financeiros do mês corrente
  const receivables = entries.filter((e) => e.type === 'RECEIVABLE');
  const faturamentoMes = receivables
    .filter((e) => e.reference_month === curMonth)
    .reduce((s, e) => s + Number(e.amount), 0);
  const despesasMes = entries
    .filter((e) => e.type === 'PAYABLE' && e.reference_month === curMonth)
    .reduce((s, e) => s + Number(e.amount), 0);
  const lucro = faturamentoMes - despesasMes;
  const margem = faturamentoMes > 0 ? lucro / faturamentoMes : 0;

  // Provisão de Imposto (DAS)
  const provisao = entries
    .filter((e) => e.type === 'PAYABLE' && e.reference_month === curMonth && String(e.description || '').includes('Provisão de Imposto'))
    .reduce((s, e) => s + Number(e.amount), 0);

  // Métrica Estratégica 1: Saldo Líquido Projetado do Mês (O que realmente sobra no bolso)
  const saldoProjetado = faturamentoMes - despesasMes - provisao;
  const margemLiquidaFinal = faturamentoMes > 0 ? saldoProjetado / faturamentoMes : 0;

  // Métrica Estratégica 2: Lucro Isento para Sócios (Consultoria Hexx)
  // Com escrituração contábil regular, todo o lucro contábil apurado é isento de IRPF
  const lucroIsentoDisponivel = Math.max(0, saldoProjetado);
  const economiaIRPF = lucroIsentoDisponivel * 0.275;

  // Métrica Estratégica 3: Radar de Inadimplência / Dinheiro na Rua
  const recebiveisInadimplentes = receivables.filter((e) => e.status === 'PENDING' && e.due_date && e.due_date < todayIso);
  const totalInadimplente = recebiveisInadimplentes.reduce((s, e) => s + Number(e.amount), 0);
  const qtdInadimplentes = recebiveisInadimplentes.length;

  // Métrica Estratégica 4: Projeção de Fluxo de Caixa (14 dias)
  const cashflowDays: CashflowDay[] = [];
  let totalInflow14 = 0;
  let totalOutflow14 = 0;
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dIso = d.toISOString().slice(0, 10);
    const dayInflow = receivables
      .filter((e) => e.due_date === dIso && e.status !== 'CANCELED')
      .reduce((s, e) => s + Number(e.amount), 0);
    const dayOutflow = entries
      .filter((e) => e.type === 'PAYABLE' && e.due_date === dIso && e.status !== 'CANCELED')
      .reduce((s, e) => s + Number(e.amount), 0);

    totalInflow14 += dayInflow;
    totalOutflow14 += dayOutflow;

    cashflowDays.push({
      date: dIso,
      dayLabel: dayNames[d.getDay()]!,
      dayNumber: String(d.getDate()).padStart(2, '0'),
      inflow: dayInflow,
      outflow: dayOutflow,
      net: dayInflow - dayOutflow,
      isToday: i === 0,
    });
  }

  // Série mensal para o gráfico histórico
  const byMonth = new Map<string, number>();
  for (const r of receivables) byMonth.set(r.reference_month, (byMonth.get(r.reference_month) ?? 0) + Number(r.amount));
  const series = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);

  const chartData = series.map(([iso, amount]) => {
    const d = new Date(`${iso}T00:00:00`);
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      rawMonth: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      amount,
      isCurrentMonth: iso === curMonth,
    };
  });

  const prev = series.length >= 2 ? series[series.length - 2]![1] : 0;
  const fatTrend = prev > 0 ? (faturamentoMes - prev) / prev : 0;

  // Termômetro Tributário & Simples
  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });
  const faixaProgress =
    simples.faixaMax > simples.faixaMin ? (rbt12 - simples.faixaMin) / (simples.faixaMax - simples.faixaMin) : 0;
  const isSafeAnexo3 = simples.fatorR >= 0.28;
  const nextMonthLabel = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('pt-BR', { month: 'long' });

  const recebiveisMes = receivables.filter((e) => e.reference_month === curMonth);
  const categorias = buildCategorias(recebiveisMes.length ? recebiveisMes : receivables);

  // Avisos reais & Timeline
  const in7DaysIso = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const pendentes = entries.filter((e) => e.type === 'PAYABLE' && e.status === 'PENDING' && e.due_date);
  const vencidas = pendentes.filter((e) => e.due_date! < todayIso);
  const vencendo = pendentes.filter((e) => e.due_date! >= todayIso && e.due_date! <= in7DaysIso);
  const avisos: { tone: 'critical' | 'warn' | 'info'; text: string }[] = [];
  if (vencidas.length) avisos.push({ tone: 'critical', text: `${vencidas.length} conta${vencidas.length > 1 ? 's' : ''} a pagar vencida${vencidas.length > 1 ? 's' : ''} — ${BRL.format(vencidas.reduce((s, e) => s + Number(e.amount), 0))}` });
  if (vencendo.length) avisos.push({ tone: 'warn', text: `${vencendo.length} conta${vencendo.length > 1 ? 's' : ''} a pagar vence${vencendo.length > 1 ? 'm' : ''} nos próximos 7 dias` });
  if (issuingCount) avisos.push({ tone: 'info', text: `${issuingCount} nota${issuingCount > 1 ? 's' : ''} aguardando processamento no Emissor Nacional` });
  const tudoEmDia = vencidas.length === 0 && qtdInadimplentes === 0;

  const timelineItems = [
    ...(openDasGuide
      ? [
          {
            id: 'das-guide',
            type: 'tax' as const,
            title: 'Guia do Simples Nacional (DAS)',
            amount: openDasGuide.amount,
            dueDate: openDasGuide.dueDate,
            status: openDasGuide.dueDate < todayIso ? ('overdue' as const) : ('pending' as const),
            link: '/minha-contabilidade/guias',
          },
        ]
      : []),
    ...entries
      .filter((e) => e.due_date && e.status === 'PENDING')
      .slice(0, 8)
      .map((e) => ({
        id: String(e.id || Math.random()),
        type: e.type === 'PAYABLE' ? ('payable' as const) : ('receivable' as const),
        title: e.description || (e.type === 'PAYABLE' ? 'Conta a Pagar' : 'Recebível'),
        amount: Number(e.amount),
        dueDate: e.due_date!,
        status: e.due_date! < todayIso ? ('overdue' as const) : ('pending' as const),
        link: e.type === 'PAYABLE' ? '/meu-negocio/contas-a-pagar' : '/meu-negocio/contas-a-receber',
      })),
  ];

  const insightContext = [
    `Tela: painel executivo (resumo em tempo real) de uma empresa de serviço optante do Simples Nacional.`,
    `Faturamento do mês: R$ ${faturamentoMes.toFixed(2)}. Despesas do mês: R$ ${despesasMes.toFixed(2)}. Saldo líquido projetado: R$ ${saldoProjetado.toFixed(2)}.`,
    `Imposto provisionado (DAS): R$ ${provisao.toFixed(2)}. Enquadramento: Anexo ${simples.anexo}, Fator R ${(simples.fatorR * 100).toFixed(1)}%.`,
    `Inadimplência de clientes: R$ ${totalInadimplente.toFixed(2)} (${qtdInadimplentes} recebíveis atrasados).`,
    `Contas a pagar vencidas: ${vencidas.length}${vencidas.length ? ` — total R$ ${vencidas.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}` : ''}.`,
    `Notas fiscais aguardando processamento: ${issuingCount}.`,
  ].join('\n');
  const insight = loadError || !companyId ? null : await getContextualInsight(companyId, 'cliente', insightContext);

  return (
    <div className="mx-auto w-full space-y-8 animate-fade-up">
      {/* AI Insight Card */}
      <InsightCard pageKey="cliente" insight={insight} />

      {/* Header Editorial Refinado (Limpo e sem botões de ações rápidas no topo) */}
      <header className="relative overflow-hidden rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 text-[#231F20] dark:text-[#FEFDF3] shadow-sm">
        <div className="relative z-10 flex flex-col gap-5">
          {/* Badges de Status & Data */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm">
                <Sparkles className="h-3 w-3" /> Visão Executiva
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/10 px-3.5 py-1 text-xs font-medium border border-black/5 dark:border-white/10 text-[#6E6A61] dark:text-[#A8A49C]">
                <Calendar className="h-3.5 w-3.5" /> {dateFormatted}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {tudoEmDia ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-3.5 py-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]/50">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                  Operação 100% em dia
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 px-3.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-300">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Atenção necessária a prazos
                </span>
              )}
            </div>
          </div>

          {/* Título Editorial de Impacto */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3] mb-1.5">
              Visão Geral
            </h1>
            <p className="text-[#6E6A61] dark:text-[#A8A49C] text-sm sm:text-base max-w-2xl">
              Acompanhe suas entradas, saídas e quanto vai sobrar no bolso neste mês.
            </p>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            Não foi possível carregar alguns dados financeiros. Recarregue a página em instantes.
          </p>
        </div>
      )}

      {lastClosureDate && (
        <div className="bg-[#EFFFD6] border border-[#DFFFAE] dark:bg-[#1E3328] dark:border-[#2F4A3C] rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E3328] text-[#DFFFAE] font-bold shadow-sm">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="font-serif font-bold text-[#1E3328] dark:text-[#DFFFAE]">O fechamento contábil mensal está pronto!</p>
              <p className="text-xs text-[#2F4A3C] dark:text-[#A8A49C]">Resumo contábil e notas fiscais do mês anterior consolidadas com sucesso.</p>
            </div>
          </div>
          <Link
            href={`/meu-negocio/relatorios/fechamento?month=${lastClosureDate}`}
            className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105 whitespace-nowrap"
          >
            Ver Relatório Completo →
          </Link>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MASTER BENTO GRID (HERO FINANCEIRO + LUCRO ISENTO SÓCIOS)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* HERO MASTER CARD: Posição de Caixa Líquida Projetada (2 Colunas) */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-[#1E3328] text-[#FEFDF3] border border-[#2F4A3C] p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-[#DFFFAE] text-xs font-bold uppercase tracking-wider">
                <Wallet className="h-4 w-4" />
                <span>Previsão de Caixa</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2F4A3C] px-3 py-0.5 text-[11px] font-bold text-[#DFFFAE] border border-[#DFFFAE]/20">
                Sobra no Mês
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 mb-6">
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#FEFDF3]">
                {BRL.format(saldoProjetado)}
              </h2>
              {faturamentoMes > 0 && (
                <span
                  className={`text-xs sm:text-sm font-bold px-2.5 py-1 rounded-xl ${
                    saldoProjetado >= 0
                      ? 'bg-[#DFFFAE]/15 text-[#DFFFAE]'
                      : 'bg-red-400/20 text-red-300'
                  }`}
                >
                  {saldoProjetado >= 0 ? '+' : ''}{pct(margemLiquidaFinal)} da receita
                </span>
              )}
            </div>
          </div>

          {/* 3 Sub-métricas integradas em vidro verde nobre */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#2F4A3C]">
            <div className="bg-[#2F4A3C]/60 border border-[#DFFFAE]/15 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-[11px] text-[#DFFFAE]/70 uppercase tracking-wider mb-1">
                <span>Entradas Previstas</span>
                {fatTrend !== 0 && (
                  <span className="text-[10px] font-bold text-[#DFFFAE]">
                    {fatTrend > 0 ? '↑' : '↓'} {pct(Math.abs(fatTrend))}
                  </span>
                )}
              </div>
              <p className="font-serif font-bold text-lg text-[#FEFDF3]">{BRL.format(faturamentoMes)}</p>
            </div>

            <div className="bg-[#2F4A3C]/60 border border-[#DFFFAE]/15 rounded-2xl p-3.5">
              <span className="text-[11px] text-[#DFFFAE]/70 uppercase tracking-wider block mb-1">
                Saídas Previstas
              </span>
              <p className="font-serif font-bold text-lg text-[#FEFDF3]">{BRL.format(despesasMes)}</p>
            </div>

            <div className="bg-[#2F4A3C]/60 border border-[#DFFFAE]/15 rounded-2xl p-3.5" title={`Provisão calculada com base no Anexo ${simples.anexo} do Simples Nacional`}>
              <div className="flex items-center justify-between text-[11px] text-[#DFFFAE]/70 uppercase tracking-wider mb-1">
                <span>Imposto do Mês (DAS)</span>
                <span className="text-[9px] text-[#DFFFAE]/60">vence {nextMonthLabel}</span>
              </div>
              <p className="font-serif font-bold text-lg text-amber-300">{BRL.format(provisao)}</p>
            </div>
          </div>
        </div>

        {/* CARD DESTAQUE: Lucro Isento para Sócios (1 Coluna) */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[#1E3328] text-[#DFFFAE]">
                  <Coins className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                    Sobra para Você
                  </h3>
                  <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                    Livre de Imposto de Renda
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-2.5 py-0.5 text-[10px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]/50">
                100% Isento
              </span>
            </div>

            <div className="my-5">
              <p className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#2F4A3C] dark:text-[#DFFFAE]">
                {BRL.format(lucroIsentoDisponivel)}
              </p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-2 leading-relaxed">
                Quanto você pode transferir para a sua conta pessoal este mês sem pagar imposto de renda.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] block">Economia no IRPF:</span>
              <strong className="text-[#2F4A3C] dark:text-[#DFFFAE] font-mono text-sm">~{BRL.format(economiaIRPF)}</strong>
            </div>

            <Link
              href="/minha-contabilidade/distribuicao-lucros"
              className="inline-flex items-center gap-1 font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline"
            >
              Ver Retiradas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OPERAÇÃO & PULSO (RADAR DE INADIMPLÊNCIA + FLUXO DE CAIXA 14 DIAS)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RADAR DE INADIMPLÊNCIA: Dinheiro na Rua (1 Coluna) */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-2xl ${
                  totalInadimplente > 0
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    : 'bg-[#EFFFD6] dark:bg-[#2F4A3C] text-[#2F4A3C] dark:text-[#DFFFAE]'
                }`}>
                  <DollarSign className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                    Contas Atrasadas
                  </h3>
                  <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                    Clientes pendentes
                  </p>
                </div>
              </div>

              {totalInadimplente > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300">
                  {qtdInadimplentes} pendente{qtdInadimplentes > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-2.5 py-0.5 text-[10px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
                  Nenhum atraso
                </span>
              )}
            </div>

            {totalInadimplente > 0 ? (
              <div className="my-4">
                <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider font-bold">
                  Total a receber em atraso:
                </p>
                <p className="font-serif text-3xl font-bold text-amber-700 dark:text-amber-400 mt-1">
                  {BRL.format(totalInadimplente)}
                </p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-2 leading-relaxed">
                  Cobranças que passaram da data de vencimento e requerem atenção.
                </p>
              </div>
            ) : (
              <div className="my-5 py-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-[#2F4A3C] dark:text-[#DFFFAE] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">
                  Tudo em dia!
                </p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">
                  Todos os clientes pagaram no prazo neste mês.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-black/5 dark:border-white/5">
            <Link
              href="/meu-negocio/contas-a-receber"
              className="inline-flex items-center justify-between w-full rounded-2xl bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 px-4 py-2.5 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] transition-all"
            >
              <span>Cobrar Clientes</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#6E6A61]" />
            </Link>
          </div>
        </div>

        {/* FLUXO DE CAIXA DOS PRÓXIMOS 14 DIAS (2 Colunas) */}
        <div className="lg:col-span-2">
          <CashflowForecast
            days={cashflowDays}
            totalInflow={totalInflow14}
            totalOutflow={totalOutflow14}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. HISTÓRICO & SERVIÇOS                                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard
          title="Histórico de Faturamento"
          action
          href="/meu-negocio/hub-financeiro"
          className="lg:col-span-2"
        >
          <RevenueChart data={chartData} />
        </GlassCard>

        <GlassCard
          title="Serviços Mais Vendidos"
          action
          href="/meu-negocio/hub-financeiro"
        >
          {categorias.length ? (
            <div className="mt-5 space-y-4">
              <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                {categorias.map((c) => (
                  <div
                    key={c.label}
                    title={`${c.label}: ${pct(c.pct / 100)}`}
                    className="h-full min-w-[6px] first:rounded-l-full last:rounded-r-full transition-[flex-grow] duration-500"
                    style={{ flexGrow: c.pct, flexBasis: 0, background: c.color }}
                  />
                ))}
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                {categorias.map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 truncate text-[#6E6A61] dark:text-[#A8A49C]">{c.label}</span>
                    <span className="tabular font-medium text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(c.value)}</span>
                    <span className="w-10 text-right font-bold tabular text-[#6E6A61] dark:text-[#A8A49C]">{pct(c.pct / 100, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Sem recebíveis no mês — emita notas fiscais para visualizar a distribuição por serviço.
            </p>
          )}
        </GlassCard>
      </div>

      {/* ========================================================================= */}
      {/* 4. VENCIMENTOS & AVISOS                                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DueDatesTimeline items={timelineItems} />
        </div>
        <div className="lg:col-span-2">
          <GlassCard
            title="Avisos &amp; Guias"
            action
            highlight
            href="/suporte"
            className="h-full"
          >
            <div className="mt-3 space-y-2.5 text-xs">
              {openDasGuide && (
                <div className="rounded-2xl border border-[#DFFFAE]/30 bg-[#DFFFAE]/10 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-[#DFFFAE]">
                    <span className="flex items-center gap-1.5 font-serif text-sm">
                      <FileText className="h-4 w-4" /> Guia DAS Simples
                    </span>
                    <span className="rounded-full bg-[#DFFFAE] text-[#1E3328] px-2 py-0.5 text-[10px] font-bold">Pendente</span>
                  </div>
                  <p className="text-[#FEFDF3]/80 text-xs">
                    Guia do DAS no valor de <strong>{BRL.format(openDasGuide.amount)}</strong> disponível para pagamento.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-white/10">
                    <span className="text-[11px] text-[#FEFDF3]/60">
                      Vencimento: {new Date(`${openDasGuide.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                    <Link href="/minha-contabilidade/guias" className="font-bold text-[#DFFFAE] hover:underline flex items-center gap-1">
                      Ver Guia <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}

              {avisos.map((a) => (
                <div
                  key={a.text}
                  className={
                    a.tone === 'critical'
                      ? 'flex items-center gap-2.5 rounded-2xl bg-red-500/15 border border-red-400/25 p-3 text-red-200'
                      : a.tone === 'warn'
                        ? 'flex items-center gap-2.5 rounded-2xl bg-amber-400/15 border border-amber-300/25 p-3 text-amber-200'
                        : 'flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/10 p-3 text-[#FEFDF3]/80'
                  }
                >
                  {a.tone === 'critical' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-300" />
                  ) : a.tone === 'warn' ? (
                    <Clock className="h-4 w-4 shrink-0 text-amber-300" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-[#DFFFAE]" />
                  )}
                  <span className="flex-1 font-medium">{a.text}</span>
                </div>
              ))}

              {!openDasGuide && avisos.length === 0 && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/10 p-3 text-[#FEFDF3]/80">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#DFFFAE]" />
                  <span className="flex-1 font-medium">Nenhum aviso — caixa postal em dia.</span>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MARGEM DE LUCRO + IMPOSTOS & SIMPLES + SAÚDE FISCAL                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Margem de Lucro */}
        <GlassCard
          title="Margem de Lucro"
          action
          href="/meu-negocio/hub-financeiro"
        >
          <div className="mt-3 flex items-end justify-between">
            <p className="text-3xl font-serif font-bold tracking-tight tabular text-[#2F4A3C] dark:text-[#DFFFAE]">{pct(margem)}</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#1E3328] dark:text-[#DFFFAE]">
              <Percent className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div className="h-full rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE] transition-[width] duration-700 ease-out" style={{ width: pct(Math.max(0, margem), 0) }} />
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            <li className="flex justify-between"><span>Faturamento</span><span className="font-semibold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(faturamentoMes)}</span></li>
            <li className="flex justify-between"><span>Despesas</span><span className="font-semibold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(despesasMes)}</span></li>
            <li className="flex justify-between border-t border-black/5 dark:border-white/5 pt-1"><span>Lucro do mês</span><span className="font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(lucro)}</span></li>
          </ul>
        </GlassCard>

        {/* Impostos & Simples Nacional */}
        <GlassCard
          title="Impostos &amp; Simples"
          action
          href="/minha-contabilidade/termometro-tributario"
        >
          <div className="flex items-center justify-between mt-2">
            <p className="text-xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              Anexo {simples.anexo} · Faixa {simples.faixa}
            </p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
              isSafeAnexo3
                ? 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
            }`}>
              {isSafeAnexo3 ? 'Anexo III (6%)' : 'Anexo V (15,5%)'}
            </span>
          </div>

          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">Alíquota nominal {rate(simples.nominalRate)}</p>
          <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div className="h-full rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE] transition-[width] duration-700 ease-out" style={{ width: pct(faixaProgress, 0) }} />
          </div>

          {simples.toNextFaixa !== null ? (
            <p className="mt-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              Faltam <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(simples.toNextFaixa)}</span> para a Faixa{' '}
              {simples.faixa + 1} (alíquota sobe para {rate(simples.nextRate ?? 0)}).
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">Você está na última faixa — atenção ao teto do Simples.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-2.5 py-0.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
              Fator R {simples.fatorR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="inline-flex items-center rounded-full bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 px-2.5 py-0.5 text-xs font-medium text-[#6E6A61] dark:text-[#A8A49C]">
              {pct(simples.ceilingUsagePct)} do teto
            </span>
          </div>
        </GlassCard>

        {/* Saúde Fiscal */}
        <HealthScoreCard
          compact
          tudoEmDia={tudoEmDia}
          fatorR={simples.fatorR}
          anexo={simples.anexo}
        />
      </div>
    </div>
  );
}
