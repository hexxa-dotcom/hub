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
  Sparkles,
} from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { withTenant, sql } from '@hexxa/db';
import { RevenueChart } from './RevenueChart';
import { DueDatesTimeline } from './DueDatesTimeline';
import { HealthScoreCard } from './HealthScoreCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
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

  let entries: Entry[] = [];
  let rbt12 = 0;
  let folha12 = 0;
  let issuingCount = 0;
  let lastClosureDate: string | null = null;
  let openDasGuide: { amount: number; dueDate: string } | null = null;
  let loadError = false;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
  try {
    const ctx = await getTenantContext();
    const simples12 = await getSimplesInputs(ctx);
    rbt12 = simples12.rbt12;
    folha12 = simples12.folha12;
    const data = await withTenant(ctx.companyId, async (tx) => {
      const fe = await tx.execute(sql`
        SELECT fe.id, fe.amount, fe.type, fe.status, fe.reference_month, fe.due_date, fe.description,
               fe.created_at, c.name AS category_name
        FROM financial_entry fe
        LEFT JOIN category c ON c.id = fe.category_id
        WHERE fe.company_id = ${ctx.companyId}
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

  const receivables = entries.filter((e) => e.type === 'RECEIVABLE');
  const faturamentoMes = receivables
    .filter((e) => e.reference_month === curMonth)
    .reduce((s, e) => s + Number(e.amount), 0);
  const despesasMes = entries
    .filter((e) => e.type === 'PAYABLE' && e.reference_month === curMonth)
    .reduce((s, e) => s + Number(e.amount), 0);
  const lucro = faturamentoMes - despesasMes;
  const margem = faturamentoMes > 0 ? lucro / faturamentoMes : 0;

  // série mensal para o gráfico
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

  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });
  const faixaProgress =
    simples.faixaMax > simples.faixaMin ? (rbt12 - simples.faixaMin) / (simples.faixaMax - simples.faixaMin) : 0;
  
  const provisao = entries
    .filter((e) => e.type === 'PAYABLE' && e.reference_month === curMonth && String(e.description || '').includes('Provisão de Imposto'))
    .reduce((s, e) => s + Number(e.amount), 0);

  // Tempo real: hoje, semana (segunda a domingo) e mês — pra acompanhar o pulso
  // do negócio no dia a dia, não só o fechamento mensal.
  const todayIsoRT = now.toISOString().slice(0, 10);
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = segunda
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const createdIso = (e: Entry) => new Date(e.created_at).toISOString().slice(0, 10);

  const faturamentoHoje = receivables
    .filter((e) => createdIso(e) === todayIsoRT)
    .reduce((s, e) => s + Number(e.amount), 0);
  const faturamentoSemana = receivables
    .filter((e) => createdIso(e) >= weekStartIso && createdIso(e) <= weekEndIso)
    .reduce((s, e) => s + Number(e.amount), 0);
  const pagamentosSemana = entries
    .filter((e) => e.type === 'PAYABLE' && e.due_date && e.due_date >= weekStartIso && e.due_date <= weekEndIso)
    .reduce((s, e) => s + Number(e.amount), 0);

  // O DAS do Simples Nacional deste mês só vence no mês seguinte (dia 20) —
  // deixa isso explícito no card, senão parece que o imposto já venceu agora.
  const nextMonthLabel = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('pt-BR', { month: 'long' });

  const recebiveisMes = receivables.filter((e) => e.reference_month === curMonth);
  const categorias = buildCategorias(recebiveisMes.length ? recebiveisMes : receivables);

  // Avisos reais
  const todayIso = now.toISOString().slice(0, 10);
  const in7DaysIso = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const pendentes = entries.filter((e) => e.type === 'PAYABLE' && e.status === 'PENDING' && e.due_date);
  const vencidas = pendentes.filter((e) => e.due_date! < todayIso);
  const vencendo = pendentes.filter((e) => e.due_date! >= todayIso && e.due_date! <= in7DaysIso);
  const avisos: { tone: 'critical' | 'warn' | 'info'; text: string }[] = [];
  if (vencidas.length) avisos.push({ tone: 'critical', text: `${vencidas.length} conta${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''} — ${BRL.format(vencidas.reduce((s, e) => s + Number(e.amount), 0))}` });
  if (vencendo.length) avisos.push({ tone: 'warn', text: `${vencendo.length} conta${vencendo.length > 1 ? 's' : ''} vence${vencendo.length > 1 ? 'm' : ''} nos próximos 7 dias` });
  if (issuingCount) avisos.push({ tone: 'info', text: `${issuingCount} nota${issuingCount > 1 ? 's' : ''} aguardando processamento no Emissor Nacional` });
  const tudoEmDia = vencidas.length === 0;

  // Itens para a Timeline de Vencimentos
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

  return (
    <div className="mx-auto w-full space-y-8 animate-fade-up">
      {/* Header Editorial */}
      <header className="relative overflow-hidden rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 text-[#231F20] dark:text-[#FEFDF3] shadow-sm">
        <div className="relative z-10 flex flex-col gap-6">
          {/* Top Row: Tags / Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm">
              <Sparkles className="h-3 w-3" /> Dashboard do Meu Negócio
            </span>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/10 px-3.5 py-1 text-xs font-medium border border-black/5 dark:border-white/10 text-[#6E6A61] dark:text-[#A8A49C]">
                <Calendar className="h-3.5 w-3.5" /> {dateFormatted}
              </span>

              {tudoEmDia ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-3.5 py-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]/50">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                  Tudo em dia
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-950/50 px-3.5 py-1 text-xs font-bold text-red-700 dark:text-red-300 border border-red-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Pendências em aberto
                </span>
              )}
            </div>
          </div>

          {/* Bottom Row: Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3] mb-1">
              Resumo Operacional &amp; Financeiro
            </h1>
            <p className="text-[#6E6A61] dark:text-[#A8A49C] text-sm max-w-xl">
              Acompanhe o faturamento em tempo real, provisão de impostos e fluxo de caixa da sua empresa.
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
              <p className="font-serif font-bold text-[#1E3328] dark:text-[#DFFFAE]">O fechamento mensal está pronto!</p>
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

      {/* Tempo real — faturamento do dia/semana/mês */}
      <section>
        <h2 className="mb-3 font-serif text-lg font-bold text-[#231F20] dark:text-[#FEFDF3]">Faturamento em Tempo Real</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <GlassCard action href="/meu-negocio/notas" title="Hoje" value={BRL.format(faturamentoHoje)} hint={dateFormatted} />
          <GlassCard action href="/meu-negocio/notas" title="Esta Semana" value={BRL.format(faturamentoSemana)} hint="segunda a domingo" />
          <GlassCard
            action
            highlight
            href="/meu-negocio/notas"
            title={LABELS.monthlyRevenue}
            value={BRL.format(faturamentoMes)}
            trend={fatTrend ? { label: pct(Math.abs(fatTrend)), positive: fatTrend >= 0 } : undefined}
            hint="vs. mês anterior"
          />
        </div>
      </section>

      {/* Compromissos — o que já está comprometido este mês/semana */}
      <section>
        <h2 className="mb-3 font-serif text-lg font-bold text-[#231F20] dark:text-[#FEFDF3]">Compromissos</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <GlassCard action href="/meu-negocio/contas-a-pagar" title="Pagamentos da Semana" value={BRL.format(pagamentosSemana)} hint="segunda a domingo" />
          <GlassCard
            action
            href="/minha-contabilidade/termometro-tributario"
            title="Imposto Acumulado do Mês"
            value={BRL.format(provisao)}
            hint={`pagamento em ${nextMonthLabel} (Anexo ${simples.anexo})`}
          />
          <GlassCard action href="/meu-negocio/contas-a-pagar" title={LABELS.monthlyExpenses} value={BRL.format(despesasMes)} hint="saídas do mês" />
        </div>
      </section>

      {/* Gráfico Recharts Shadcn + composição por categoria */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard
          title="Faturamento Histórico"
          action
          href="/meu-negocio/hub-financeiro"
          className="lg:col-span-2"
        >
          <RevenueChart data={chartData} />
        </GlassCard>

        <GlassCard
          title="Receita por Categoria"
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

      {/* Linha do Tempo de Vencimentos & Saúde Fiscal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DueDatesTimeline items={timelineItems} />
        </div>
        <div className="lg:col-span-2">
          <HealthScoreCard
            tudoEmDia={tudoEmDia}
            fatorR={simples.fatorR}
            anexo={simples.anexo}
          />
        </div>
      </div>

      {/* Margem + Bússola Tributária + Caixa Postal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard
          title="Margem Operacional Real"
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
            <li className="flex justify-between border-t border-black/5 dark:border-white/5 pt-1"><span>Lucro líquido</span><span className="font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(lucro)}</span></li>
          </ul>
        </GlassCard>

        <GlassCard
          title={LABELS.taxThermometer}
          action
          href="/minha-contabilidade/termometro-tributario"
        >
          <p className="mt-2 text-xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Anexo {simples.anexo} · Faixa {simples.faixa}</p>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Alíquota nominal {rate(simples.nominalRate)}</p>
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

        <GlassCard
          title="Caixa Postal &amp; Avisos"
          action
          href="/suporte"
        >
          <div className="mt-3 space-y-2.5 text-xs">
            {openDasGuide && (
              <div className="rounded-2xl border border-[#DFFFAE] bg-[#EFFFD6] dark:bg-[#1E3328] dark:border-[#2F4A3C] p-3.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between font-bold text-[#1E3328] dark:text-[#DFFFAE]">
                  <span className="flex items-center gap-1.5 font-serif text-sm">
                    <FileText className="h-4 w-4" /> Guia DAS Simples
                  </span>
                  <span className="rounded-full bg-[#1E3328] text-[#DFFFAE] px-2 py-0.5 text-[10px] font-bold">Pendente</span>
                </div>
                <p className="text-[#2F4A3C] dark:text-[#A8A49C] text-xs">
                  Guia do DAS no valor de <strong>{BRL.format(openDasGuide.amount)}</strong> disponível para pagamento.
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/10">
                  <span className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                    Vencimento: {new Date(`${openDasGuide.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}
                  </span>
                  <Link href="/minha-contabilidade/guias" className="font-bold text-[#1E3328] dark:text-[#DFFFAE] hover:underline flex items-center gap-1">
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
                    ? 'flex items-center gap-2.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 p-3 text-red-700 dark:text-red-300'
                    : a.tone === 'warn'
                      ? 'flex items-center gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 p-3 text-amber-800 dark:text-amber-300'
                      : 'flex items-center gap-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 p-3 text-[#6E6A61] dark:text-[#A8A49C]'
                }
              >
                {a.tone === 'critical' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                ) : a.tone === 'warn' ? (
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-[#2F4A3C]" />
                )}
                <span className="flex-1 font-medium">{a.text}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
