import { GlassCard } from '@/components/ui/GlassCard';
import { LABELS } from '@hexxa/core/language';
import { TaxThermometerService } from '@hexxa/core';
import { ChevronDown, Calendar, AlertTriangle, Clock, Percent, FileText } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { withTenant, sql } from '@hexxa/db';
import { DashboardActions } from './DashboardActions';
import Link from 'next/link';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number, d = 1) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: d })}%`;
const rate = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

type Entry = {
  amount: number | string;
  type: string;
  status: string;
  reference_month: string;
  due_date: string | null;
  description?: string;
  category_name?: string | null;
};

/**
 * Paleta categórica validada (lightness/chroma/CVD/contraste OK nos 2 temas):
 * azul royal · ciano · violeta · âmbar. A cauda vira "Outros" em cinza.
 */
const CAT_COLORS = ['#2563eb', '#0891b2', '#8b5cf6', '#d97706'];
const OUTROS_COLOR = '#94a3b8';

/** Top 4 categorias reais + cauda agregada em "Outros". */
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
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
  try {
    const ctx = await getTenantContext();
    const simples12 = await getSimplesInputs(ctx);
    rbt12 = simples12.rbt12;
    folha12 = simples12.folha12;
    const data = await withTenant(ctx.companyId, async (tx) => {
      const fe = await tx.execute(sql`
        SELECT fe.amount, fe.type, fe.status, fe.reference_month, fe.due_date, fe.description,
               c.name AS category_name
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
      return {
        entries: fe as unknown as Entry[],
        issuing: Number(issuing[0]?.n ?? 0),
        hasClosure: closure.length > 0,
      };
    });
    entries = data.entries;
    issuingCount = data.issuing;
    if (data.hasClosure) lastClosureDate = lastMonthStr;
  } catch {
    // sem banco/acesso — segue com zeros
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

  // série mensal (últimos 8 meses) para o gráfico
  const byMonth = new Map<string, number>();
  for (const r of receivables) byMonth.set(r.reference_month, (byMonth.get(r.reference_month) ?? 0) + Number(r.amount));
  const series = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  const maxVal = Math.max(1, ...series.map(([, v]) => v));
  const maxIdx = series.reduce((mi, [, v], i, arr) => (v > arr[mi]![1] ? i : mi), 0);
  const monthLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

  // tendência do faturamento vs. mês anterior
  const prev = series.length >= 2 ? series[series.length - 2]![1] : 0;
  const fatTrend = prev > 0 ? (faturamentoMes - prev) / prev : 0;

  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });
  const faixaProgress =
    simples.faixaMax > simples.faixaMin ? (rbt12 - simples.faixaMin) / (simples.faixaMax - simples.faixaMin) : 0;
  
  // Lê a provisão real gerada pela emissão das notas (despesas de imposto)
  const provisao = entries
    .filter((e) => e.type === 'PAYABLE' && e.reference_month === curMonth && String(e.description || '').includes('Provisão de Imposto'))
    .reduce((s, e) => s + Number(e.amount), 0);

  // Donut por categoria REAL dos recebíveis do mês (fallback: todos os recebíveis)
  const recebiveisMes = receivables.filter((e) => e.reference_month === curMonth);
  const categorias = buildCategorias(recebiveisMes.length ? recebiveisMes : receivables);

  // Avisos reais: contas vencidas / a vencer em 7 dias + notas em processamento
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

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="animate-fade-up relative overflow-hidden rounded-2xl hero-blue p-5 sm:p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-5">
          {/* Top Row: Tags / Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium border border-white/10">
              Dashboard do Meu Negócio
            </span>
            
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium border border-white/10">
                <Calendar className="h-3.5 w-3.5" /> {dateFormatted}
              </span>
              
              {tudoEmDia ? (
                <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-300 border border-white/10">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Tudo em dia
                </span>
              ) : (
                <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-rose-300 border border-white/10">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                  Pendências em aberto
                </span>
              )}
            </div>
          </div>
          
          {/* Bottom Row: Greeting & Actions */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mb-1">Resumo Financeiro</h1>
              <p className="text-white/70 text-sm max-w-lg">O balanço financeiro e contábil do seu negócio, em tempo real.</p>
            </div>
            
            <DashboardActions />
          </div>
        </div>
      </header>

      {lastClosureDate && (
        <div className="bg-brand-50 border border-brand-200 dark:bg-brand-900/20 dark:border-brand-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-brand-900 dark:text-brand-100">O seu fechamento mensal está pronto!</p>
              <p className="text-sm text-brand-700 dark:text-brand-300">Resumo financeiro e notas do mês anterior já foram processados pela contabilidade.</p>
            </div>
          </div>
          <Link 
            href={`/meu-negocio/relatorios/fechamento?month=${lastClosureDate}`}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors whitespace-nowrap"
          >
            Ver Relatório Completo
          </Link>
        </div>
      )}

      {/* KPIs — entrada escalonada */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard
          highlight
          action
          href="/meu-negocio/notas"
          title={LABELS.monthlyRevenue}
          value={BRL.format(faturamentoMes)}
          trend={fatTrend ? { label: pct(Math.abs(fatTrend)), positive: fatTrend >= 0 } : undefined}
          hint="vs. mês anterior"
          className="animate-fade-up"
        />
        <GlassCard action href="/meu-negocio/fiscal" title={LABELS.estimatedTax} value={BRL.format(provisao)} hint={`estimado (Anexo ${simples.anexo})`} className="animate-fade-up [animation-delay:60ms]" />
        <GlassCard action href="/meu-negocio/contas-a-pagar" title={LABELS.monthlyExpenses} value={BRL.format(despesasMes)} hint="saídas do mês" className="animate-fade-up [animation-delay:120ms]" />
        <GlassCard action href="/meu-negocio/hub-financeiro" title="Lucro Líquido" value={BRL.format(lucro)} hint="faturamento − despesas" className="animate-fade-up [animation-delay:180ms]" />
      </div>

      {/* Gráfico + composição por categoria */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <GlassCard title="Faturamento — últimos meses" action href="/meu-negocio/hub-financeiro" className="animate-fade-up [animation-delay:120ms] lg:col-span-2">
          <div className="mt-5 flex gap-4">
            <div className="flex h-56 flex-col justify-between py-1 text-right text-[10px] tabular text-ink-soft">
              {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                <span key={f}>R$ {Math.round((maxVal * f) / 1000)}k</span>
              ))}
            </div>
            <div className="flex h-56 flex-1 gap-2.5">
              {series.map(([iso, v], i) => (
                <div key={iso} className="group flex flex-1 flex-col">
                  <div className="relative flex flex-1 items-end">
                    {/* Rótulo direto no destaque; os demais aparecem no hover */}
                    <span
                      className={`absolute left-1/2 z-10 -translate-x-1/2 -translate-y-2 whitespace-nowrap rounded-xl border border-line bg-surface-card px-2 py-1 text-[11px] font-semibold tabular shadow-md transition-opacity duration-150 ${
                        i === maxIdx ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      style={{ bottom: `${(v / maxVal) * 100}%` }}
                    >
                      {BRL.format(v)}
                    </span>
                    <div
                      className={`w-full rounded-t transition-colors duration-150 ${
                        i === maxIdx ? 'bg-brand-600' : 'bg-brand-500/70 group-hover:bg-brand-500'
                      }`}
                      style={{ height: `${(v / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="mt-2 text-center text-[10px] text-ink-soft">{monthLabel(iso)}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Receita por categoria" action href="/meu-negocio/hub-financeiro" className="animate-fade-up [animation-delay:180ms]">
          {categorias.length ? (
            <div className="mt-5 space-y-4">
              {/* Barra empilhada horizontal — parte-a-todo com respiro de 2px entre segmentos */}
              <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
                {categorias.map((c) => (
                  <div
                    key={c.label}
                    title={`${c.label}: ${pct(c.pct / 100)}`}
                    className="h-full min-w-[6px] first:rounded-l-full last:rounded-r-full transition-[flex-grow] duration-500"
                    style={{ flexGrow: c.pct, flexBasis: 0, background: c.color }}
                  />
                ))}
              </div>
              <ul className="space-y-2 text-sm">
                {categorias.map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 truncate text-ink-soft">{c.label}</span>
                    <span className="tabular text-xs text-ink-soft">{BRL.format(c.value)}</span>
                    <span className="w-10 text-right font-medium tabular">{pct(c.pct / 100, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-ink-soft">Sem recebíveis registrados ainda — emita notas ou lance recebimentos para ver a distribuição por categoria.</p>
          )}
        </GlassCard>
      </div>

      {/* Margem + Termômetro + Avisos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <GlassCard title="Margem de Lucro Real" action href="/meu-negocio/hub-financeiro" className="animate-fade-up [animation-delay:240ms]">
          <div className="mt-2 flex items-end justify-between">
            <p className="text-[28px] font-semibold tracking-tight tabular text-ok">{pct(margem)}</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ok/10 text-ok">
              <Percent className="h-[18px] w-[18px]" />
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-ok transition-[width] duration-700 ease-out" style={{ width: pct(Math.max(0, margem), 0) }} />
          </div>
          <ul className="mt-3 space-y-1 text-xs text-ink-soft">
            <li className="flex justify-between"><span>Faturamento</span><span className="font-medium text-ink">{BRL.format(faturamentoMes)}</span></li>
            <li className="flex justify-between"><span>Despesas</span><span className="font-medium text-ink">{BRL.format(despesasMes)}</span></li>
            <li className="flex justify-between"><span>Lucro líquido</span><span className="font-medium text-ink">{BRL.format(lucro)}</span></li>
          </ul>
        </GlassCard>

        <GlassCard title={LABELS.taxThermometer} action href="/meu-negocio/fiscal" className="animate-fade-up [animation-delay:300ms]">
          <p className="mt-2 text-[22px] font-semibold tracking-tight">Anexo {simples.anexo} · Faixa {simples.faixa}</p>
          <p className="-mt-0.5 text-xs text-ink-soft">Alíquota nominal {rate(simples.nominalRate)}</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out" style={{ width: pct(faixaProgress, 0) }} />
          </div>
          {simples.toNextFaixa !== null ? (
            <p className="mt-2 text-xs text-ink-soft">
              Faltam <span className="font-semibold text-ink">{BRL.format(simples.toNextFaixa)}</span> para a Faixa{' '}
              {simples.faixa + 1} (alíquota sobe para {rate(simples.nextRate ?? 0)}).
            </p>
          ) : (
            <p className="mt-2 text-xs text-warn">Você está na última faixa — atenção ao teto do Simples.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">
              Fator R {simples.fatorR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Anexo {simples.anexo}
            </span>
            <span className="inline-flex items-center rounded-full bg-black/[0.07] px-2 py-0.5 text-xs text-ink-soft dark:bg-white/10">
              {pct(simples.ceilingUsagePct)} do teto
            </span>
          </div>
        </GlassCard>

        <GlassCard title={LABELS.urgentNotices} action href="/meu-negocio/hub-financeiro" className="animate-fade-up [animation-delay:360ms]">
          {avisos.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {avisos.map((a) => (
                <li
                  key={a.text}
                  className={
                    a.tone === 'critical'
                      ? 'flex items-center gap-2.5 rounded-xl bg-critical/10 px-3 py-2 text-critical'
                      : a.tone === 'warn'
                        ? 'flex items-center gap-2.5 rounded-xl bg-warn/10 px-3 py-2 text-warn'
                        : 'flex items-center gap-2.5 rounded-xl bg-brand-500/10 px-3 py-2 text-brand-700 dark:text-brand-300'
                  }
                >
                  {a.tone === 'critical' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  ) : a.tone === 'warn' ? (
                    <Clock className="h-4 w-4 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0" />
                  )}
                  {a.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">Nenhum aviso urgente — contas em dia e nenhuma nota pendente. ✅</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
