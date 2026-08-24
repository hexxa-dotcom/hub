'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import type { Route } from 'next';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Percent,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  History,
  FileText,
  Users,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { MonthTrendChart } from './MonthTrendChart';
import { CategoryDonut } from './CategoryDonut';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;

export type CompromissoRow = {
  id: string;
  titulo: string;
  categoria: string;
  tipo: 'PAYABLE' | 'RECEIVABLE';
  valor: number;
  vencimento: string;
  status: string;
  link: string;
};

export type MonthSummary = {
  key: string;
  label: string;
  shortLabel: string;
  isCurrent: boolean;
  closed: boolean;
  faturamento: number;
  despesas: number;
  lucro: number;
  impostos: number;
  impostosAberto: number;
  pagarTotal: number;
  pagarAberto: number;
  receberTotal: number;
  receberAberto: number;
  categoriasReceber: { label: string; value: number }[];
  categoriasPagar: { label: string; value: number }[];
  compromissos: CompromissoRow[];
  contratosAtivos: { id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA' }[];
  lucroDistribuido: number;
  lucroAcumuladoNoAno: number;
  notasEmitidas: number;
  notasParaEmitir: number;
  novosClientes: number;
  admissoes: string[];
  desligamentos: string[];
  valorInadimplente: number;
  taxaInadimplencia: number;
};

// ── Peças reutilizáveis ──────────────────────────────────────────────────────

const TONE = {
  critical: { bg: 'bg-red-100 dark:bg-red-950/60', text: 'text-red-700 dark:text-red-300' },
  ok: { bg: 'bg-[#EFFFD6] dark:bg-[#2F4A3C]', text: 'text-[#2F4A3C] dark:text-[#DFFFAE]' },
  warn: { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-300' },
} as const;

function ProjectionCard({
  icon: Icon,
  label,
  total,
  aberto,
  tone,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  total: number;
  aberto: number;
  tone: keyof typeof TONE;
  href: Route;
}) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${t.bg}`}>
          <Icon className={`h-4 w-4 ${t.text}`} />
        </span>
      </div>
      <p className="mt-2 font-serif text-2xl font-bold tabular text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(total)}</p>
      <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
        total do mês · <span className="font-bold">{BRL.format(aberto)}</span> em aberto
      </p>
    </Link>
  );
}

function TrendHint({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return null;
  const delta = (current - previous) / previous;
  const positive = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${positive ? 'text-[#2F4A3C] dark:text-[#DFFFAE]' : 'text-red-600 dark:text-red-400'}`}>
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {pct(Math.abs(delta))} vs. mês anterior
    </span>
  );
}

function CompromissosList({ items }: { items: CompromissoRow[] }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-12 text-center text-[#6E6A61] dark:text-[#A8A49C]">
        <Calendar className="h-8 w-8 mx-auto opacity-30 mb-2" />
        <p className="text-sm font-semibold">Nenhum lançamento neste mês.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] shadow-sm">
      <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/20 px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] sm:grid">
        <span>Descrição</span>
        <span className="w-28 text-right">Vencimento</span>
        <span className="w-28 text-right">Valor</span>
        <span className="w-20 text-center">Tipo</span>
        <span className="w-24 text-center">Status</span>
      </div>
      <div className="divide-y divide-black/5 dark:divide-white/5">
        {items.map((c) => {
          const vencida = c.status !== 'PAID' && c.vencimento < todayIso;
          return (
            <Link
              key={c.id}
              href={c.link as Route}
              className={`grid grid-cols-[1fr_auto] items-center gap-3 p-4 sm:px-5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors sm:grid-cols-[1fr_auto_auto_auto_auto] ${vencida ? 'border-l-4 border-l-red-500' : ''}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{c.titulo}</p>
                <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">{c.categoria}</p>
              </div>
              <span className="hidden w-28 text-right text-sm text-[#6E6A61] dark:text-[#A8A49C] sm:block">{fmtDate(c.vencimento)}</span>
              <span className={`hidden w-28 text-right font-serif text-sm font-bold tabular sm:block ${c.tipo === 'PAYABLE' ? 'text-red-700 dark:text-red-400' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'}`}>
                {BRL.format(c.valor)}
              </span>
              <span className="hidden w-20 text-center text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] sm:block">
                {c.tipo === 'PAYABLE' ? 'Pagar' : 'Receber'}
              </span>
              <span className="hidden w-24 justify-center sm:flex">
                {c.status === 'PAID' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-2 py-0.5 text-[11px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
                    <CheckCircle2 className="h-3 w-3" /> Feito
                  </span>
                ) : vencida ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/60 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" /> Vencido
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <Clock className="h-3 w-3" /> Aberto
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Painel de um mês (usado nas duas abas) ───────────────────────────────────

function MonthPanel({
  month,
  prevMonth,
  trendData,
}: {
  month: MonthSummary;
  prevMonth?: MonthSummary;
  trendData: { shortLabel: string; faturamento: number; despesas: number }[];
}) {
  const saldoProjetado = month.receberAberto - month.pagarAberto;

  return (
    <div className="space-y-6">
      {month.isCurrent ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProjectionCard icon={TrendingDown} label="A Pagar" total={month.pagarTotal} aberto={month.pagarAberto} tone="critical" href="/meu-negocio/contas-a-pagar" />
          <ProjectionCard icon={TrendingUp} label="A Receber" total={month.receberTotal} aberto={month.receberAberto} tone="ok" href="/meu-negocio/contas-a-receber" />
          <ProjectionCard icon={Percent} label="Impostos" total={month.impostos} aberto={month.impostosAberto} tone="warn" href="/minha-contabilidade/guias" />
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#1E3328] text-[#FEFDF3] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]/80">Saldo Projetado</p>
              <Wallet className="h-4 w-4 text-[#DFFFAE]" />
            </div>
            <p className={`mt-2 font-serif text-2xl font-bold tabular ${saldoProjetado >= 0 ? 'text-[#DFFFAE]' : 'text-red-300'}`}>
              {BRL.format(saldoProjetado)}
            </p>
            <p className="mt-1 text-[11px] text-[#DFFFAE]/70">a receber − a pagar, só o que ainda está em aberto</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassCard title="Faturamento" value={BRL.format(month.faturamento)} hint={prevMonth ? undefined : 'recebido no mês'}>
            {prevMonth && <TrendHint current={month.faturamento} previous={prevMonth.faturamento} />}
          </GlassCard>
          <GlassCard title="Despesas" value={BRL.format(month.despesas)} hint={prevMonth ? undefined : 'pago no mês'}>
            {prevMonth && <TrendHint current={month.despesas} previous={prevMonth.despesas} />}
          </GlassCard>
          <GlassCard title="Impostos" value={BRL.format(month.impostos)} hint="provisão paga" />
        </div>
      )}

      {/* Além das finanças — o que mais aconteceu na empresa neste mês */}
      <div className="space-y-4">
        <h3 className="font-serif text-base font-bold text-[#231F20] dark:text-[#FEFDF3]">Visão Geral da Empresa</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href={'/meu-negocio/contratos' as Route}
            className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Contratos Ativos</p>
            <p className="mt-2 font-serif text-2xl font-bold tabular text-[#231F20] dark:text-[#FEFDF3]">{month.contratosAtivos.length}</p>
            <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
              {month.contratosAtivos.filter((c) => c.tipo === 'ENTRADA').length} clientes ·{' '}
              {month.contratosAtivos.filter((c) => c.tipo === 'SAIDA').length} fornecedores/colaboradores
            </p>
            {month.contratosAtivos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {month.contratosAtivos.slice(0, 5).map((c) => (
                  <span
                    key={c.id}
                    className="truncate max-w-[9rem] rounded-full bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 px-2.5 py-1 text-[11px] font-medium text-[#6E6A61] dark:text-[#A8A49C]"
                  >
                    {c.nome}
                  </span>
                ))}
                {month.contratosAtivos.length > 5 && (
                  <span className="rounded-full bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 px-2.5 py-1 text-[11px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">
                    +{month.contratosAtivos.length - 5}
                  </span>
                )}
              </div>
            )}
          </Link>

          <Link
            href={'/meu-negocio/notas' as Route}
            className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
                {month.isCurrent ? 'Notas para Emitir' : 'Notas Emitidas'}
              </p>
              <FileText className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />
            </div>
            <p className="mt-2 font-serif text-2xl font-bold tabular text-[#231F20] dark:text-[#FEFDF3]">
              {month.isCurrent ? month.notasParaEmitir : month.notasEmitidas}
            </p>
            <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
              {month.isCurrent ? 'NFSe em rascunho ou processando' : 'NFSe emitidas no mês'}
            </p>
          </Link>

          <Link
            href={'/relacionamento' as Route}
            className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Novos Clientes</p>
              <Users className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />
            </div>
            <p className="mt-2 font-serif text-2xl font-bold tabular text-[#231F20] dark:text-[#FEFDF3]">{month.novosClientes}</p>
            <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">cadastrados no mês</p>
          </Link>

          <Link
            href={'/minha-contabilidade/departamento-pessoal' as Route}
            className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Colaboradores</p>
            <p className="mt-2 font-serif text-2xl font-bold tabular text-[#231F20] dark:text-[#FEFDF3]">
              {month.admissoes.length + month.desligamentos.length}
            </p>
            <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
              {month.admissoes.length} admissão{month.admissoes.length === 1 ? '' : 'ões'} · {month.desligamentos.length} desligamento{month.desligamentos.length === 1 ? '' : 's'}
            </p>
            {(month.admissoes.length > 0 || month.desligamentos.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {month.admissoes.map((nome) => (
                  <span key={`a-${nome}`} className="truncate max-w-[9rem] rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-2.5 py-1 text-[11px] font-medium text-[#2F4A3C] dark:text-[#DFFFAE]">
                    + {nome}
                  </span>
                ))}
                {month.desligamentos.map((nome) => (
                  <span key={`d-${nome}`} className="truncate max-w-[9rem] rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:text-red-300">
                    − {nome}
                  </span>
                ))}
              </div>
            )}
          </Link>
        </div>

        {/* Lucro, distribuição e inadimplência só fazem sentido pra mês já fechado —
            no mês atual ainda não há o que apurar. */}
        {!month.isCurrent && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <GlassCard title="Lucro do Mês" value={BRL.format(month.lucro)} tone={month.lucro >= 0 ? 'ok' : 'critical'} hint="faturamento − despesas" />
            <GlassCard
              title="Lucro Acumulado no Ano"
              value={BRL.format(month.lucroAcumuladoNoAno)}
              tone={month.lucroAcumuladoNoAno >= 0 ? 'ok' : 'critical'}
              hint={`jan a ${month.shortLabel}`}
            />
            <GlassCard title="Lucro Distribuído" value={BRL.format(month.lucroDistribuido)} hint="aos sócios neste mês" />
            <GlassCard
              title="Taxa de Inadimplência"
              value={pct(month.taxaInadimplencia)}
              tone={month.taxaInadimplencia > 0 ? 'warn' : 'ok'}
              hint={month.valorInadimplente > 0 ? `${BRL.format(month.valorInadimplente)} vencido sem pagar` : 'nada vencido'}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <GlassCard title={month.isCurrent ? 'Comparativo — Últimos Meses' : `Comparativo até ${month.shortLabel}`} className="lg:col-span-3">
          <div className="mt-3">
            <MonthTrendChart data={trendData} />
          </div>
        </GlassCard>
        <div className="grid grid-cols-1 gap-6 lg:col-span-2">
          <GlassCard title="Receita por Categoria">
            <div className="mt-3">
              <CategoryDonut data={month.categoriasReceber} emptyLabel="Sem recebíveis neste mês." />
            </div>
          </GlassCard>
          <GlassCard title="Despesas por Categoria">
            <div className="mt-3">
              <CategoryDonut data={month.categoriasPagar} emptyLabel="Sem despesas neste mês." />
            </div>
          </GlassCard>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-serif text-base font-bold text-[#231F20] dark:text-[#FEFDF3]">
          {month.isCurrent ? 'Compromissos do Mês' : 'Lançamentos do Mês'}
        </h3>
        <CompromissosList items={month.compromissos} />
      </div>
    </div>
  );
}

// ── View principal — abas Mês Atual / Mês Anterior ───────────────────────────

export function ResumoMesView({ months, loadError }: { months: MonthSummary[]; loadError: boolean }) {
  const [tab, setTab] = useState<'atual' | 'anterior'>('atual');

  const current = months[months.length - 1]!;
  // meses passados, do mais recente pro mais antigo
  const pastMonths = months.slice(0, months.length - 1).slice().reverse();
  const [selectedKey, setSelectedKey] = useState<string | undefined>(pastMonths[0]?.key);
  const selected = pastMonths.find((m) => m.key === selectedKey) ?? pastMonths[0];
  const selectedIdx = selected ? pastMonths.findIndex((m) => m.key === selected.key) : -1;
  const selectedPrev = selectedIdx >= 0 ? pastMonths[selectedIdx + 1] : undefined;

  const activeMonth = tab === 'atual' ? current : selected;

  const trendData = useMemo(() => {
    if (!activeMonth) return [];
    const endIdx = months.findIndex((m) => m.key === activeMonth.key);
    const start = Math.max(0, endIdx - 5);
    return months.slice(start, endIdx + 1).map((m) => ({
      shortLabel: m.shortLabel,
      faturamento: m.faturamento,
      despesas: m.despesas,
    }));
  }, [activeMonth, months]);

  return (
    <div className="mx-auto w-full space-y-8 animate-fade-up">
      <header className="relative overflow-hidden rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 text-[#231F20] dark:text-[#FEFDF3] shadow-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm">
          <Calendar className="h-3 w-3" /> Resumo do Mês
        </span>
        <h1 className="mt-4 text-2xl sm:text-3xl font-serif font-bold tracking-tight">Resumo do Mês</h1>
        <p className="mt-1 text-[#6E6A61] dark:text-[#A8A49C] text-sm max-w-2xl">
          O mês atual (o que ainda vai acontecer) e o histórico de meses anteriores (o que já fechou), com
          gráficos e comparativos, num lugar só.
        </p>
      </header>

      {loadError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Não foi possível carregar alguns dados. Recarregue a página em instantes.</p>
        </div>
      )}

      {/* Pílulas com animação suave de transição */}
      <div className="flex">
        <SegmentedTabs
          tabs={[
            { id: 'atual', label: 'Mês Atual', icon: LayoutGrid },
            { id: 'anterior', label: 'Mês Anterior', icon: History },
          ]}
          activeTab={tab}
          onChange={setTab}
          layoutId="resumoMesTabsIndicator"
        />
      </div>

      {tab === 'anterior' && pastMonths.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pastMonths.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedKey(m.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition-all ${
                selected?.key === m.key
                  ? 'bg-[#2F4A3C] text-[#DFFFAE] shadow-sm'
                  : 'border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
              }`}
            >
              {m.shortLabel}
            </button>
          ))}
        </div>
      )}

      {activeMonth && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-[#231F20] dark:text-[#FEFDF3] capitalize">
              {tab === 'atual' ? `O Que Esperar — ${activeMonth.label}` : `Resumo de ${activeMonth.label}`}
            </h2>
            {tab === 'anterior' && activeMonth.closed && (
              <Link
                href={`/meu-negocio/relatorios/fechamento?month=${activeMonth.key}` as Route}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Fechamento pronto <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <MonthPanel month={activeMonth} prevMonth={tab === 'anterior' ? selectedPrev : undefined} trendData={trendData} />
        </>
      )}
    </div>
  );
}
