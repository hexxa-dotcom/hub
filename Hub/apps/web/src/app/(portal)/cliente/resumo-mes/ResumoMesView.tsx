'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { AlertTriangle, ArrowRight, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { SimplesPosition } from '@hexxa/core';

/**
 * A posição que chega aqui pode ser a oficial (anexo I a V, da apuração) ou a
 * estimada (III ou V, da conta interna) — ver `posicaoSimples`.
 */
type Posicao = Omit<SimplesPosition, 'anexo'> & { anexo: string };
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { spring, crossFade } from '@/lib/motion';
import { Card, CardHeader, Metric } from '@/components/ui/Card';
import { MonthTrendChart } from './MonthTrendChart';
import { MiniBarChart } from '../MiniBarChart';
import { MiniLineChart } from '../MiniLineChart';
import { MiniLollipopChart } from '../MiniLollipopChart';
import { MiniHBarChart } from '../MiniHBarChart';
import { Handshake, Receipt, Scales, SealCheck } from '@phosphor-icons/react';
import { SalesforceHeroCard } from './SalesforceHeroCard';
import { SalesforceTargetBar } from './SalesforceTargetBar';
import { SalesforceDuoCards } from './SalesforceDuoCards';
import { SalesforceDualBarChart, type DualBarDay } from './SalesforceDualBarChart';
import { SalesforceYearlyTrend, type MonthTrendPoint } from './SalesforceYearlyTrend';
import { SalesforceMiniCards } from './SalesforceMiniCards';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDate = (d: string) => {
  if (!d) return '--/--';
  const parts = d.slice(0, 10).split('-');
  return `${parts[2]}/${parts[1]}`;
};
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
/** Alíquota já vem em pontos percentuais do serviço — não multiplicar por 100. */
const rate = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

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

export type WeekFlow = {
  weekNum: number;
  label: string;
  dateRange: string;
  inflow: number;
  outflow: number;
  net: number;
  status: 'past' | 'current' | 'future';
  keyHighlights: string[];
};

export type MonthSummary = {
  key: string;
  label: string;
  shortLabel: string;
  isCurrent: boolean;
  closed: boolean;
  faturamento: number;
  faturamentoRecebido: number;
  faturamentoPendente: number;
  despesas: number;
  despesasPagas: number;
  despesasPendentes: number;
  lucro: number;
  impostos: number;
  impostosAberto: number;
  pagarTotal: number;
  pagarAberto: number;
  receberTotal: number;
  receberAberto: number;
  receitaBaseContratada: number;
  custoFixoComprometido: number;
  breakEvenDay: number | null;
  sobraPrevista: number;
  semanas: WeekFlow[];
  dre: {
    faturamentoBruto: number;
    impostosSimples: number;
    faturamentoLiquido: number;
    custosFixos: number;
    custosVariaveis: number;
    lucroOperacional: number;
    distribuicaoLucro: number;
    saldoFinalRetido: number;
  };
  categoriasReceber: { label: string; value: number }[];
  categoriasPagar: { label: string; value: number }[];
  compromissos: CompromissoRow[];
  contratosAtivos: { id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA'; valor: number }[];
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

const REVENUE_COLORS = ['var(--chart-rev-1)', 'var(--chart-rev-2)', 'var(--chart-rev-3)', 'var(--chart-rev-4)'];
const EXPENSE_COLORS = ['var(--chart-exp-1)', 'var(--chart-exp-2)', 'var(--chart-exp-3)', 'var(--chart-exp-4)'];

// ── Lista Proporcional de Categorias ─────────────────────────────────────────
function ProportionalList({
  items,
  total,
  colors,
  emptyLabel,
}: {
  items: { label: string; value: number }[];
  total: number;
  colors: string[];
  emptyLabel: string;
}) {
  const filtered = items.filter((d) => d.value > 0).slice(0, 4);
  if (!filtered.length || total <= 0) {
    return <p className="text-footnote text-ink-soft mt-6">{emptyLabel}</p>;
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full bg-line">
        {filtered.map((item, idx) => {
          const ratio = (item.value / total) * 100;
          return (
            <div
              key={item.label}
              title={`${item.label}: ${pct(item.value / total)}`}
              className="h-full first:rounded-l-full last:rounded-r-full transition-[flex-grow] duration-500"
              style={{ flexGrow: ratio, flexBasis: 0, background: colors[idx % colors.length] }}
            />
          );
        })}
      </div>

      <ul className="space-y-3">
        {filtered.map((item, idx) => (
          <li key={item.label} className="flex items-center gap-3 text-footnote">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: colors[idx % colors.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{item.label}</span>
            <span className="tabular text-ink">{BRL.format(item.value)}</span>
            <span className="w-11 text-right tabular text-ink-soft">{pct(item.value / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Lista de Compromissos com Filtros e Busca Rápida ─────────────────────────
function FilterableCompromissosList({ items }: { items: CompromissoRow[] }) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'RECEIVABLE' | 'PAYABLE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  const counts = useMemo(() => {
    return {
      all: items.length,
      pending: items.filter((i) => i.status !== 'PAID' && i.vencimento >= todayIso).length,
      overdue: items.filter((i) => i.status !== 'PAID' && i.vencimento < todayIso).length,
      receivable: items.filter((i) => i.tipo === 'RECEIVABLE').length,
      payable: items.filter((i) => i.tipo === 'PAYABLE').length,
    };
  }, [items, todayIso]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isOverdue = item.status !== 'PAID' && item.vencimento < todayIso;
      const isPending = item.status !== 'PAID' && item.vencimento >= todayIso;

      if (activeFilter === 'PENDING' && !isPending) return false;
      if (activeFilter === 'OVERDUE' && !isOverdue) return false;
      if (activeFilter === 'RECEIVABLE' && item.tipo !== 'RECEIVABLE') return false;
      if (activeFilter === 'PAYABLE' && item.tipo !== 'PAYABLE') return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTitle = item.titulo.toLowerCase().includes(term);
        const matchesCategory = item.categoria.toLowerCase().includes(term);
        if (!matchesTitle && !matchesCategory) return false;
      }

      return true;
    });
  }, [items, activeFilter, searchTerm, todayIso]);

  const displayedItems = isExpanded ? filteredItems : filteredItems.slice(0, 8);

  if (items.length === 0) {
    return (
      <Card level={1} className="rounded-[28px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <p className="text-footnote text-ink-soft">
          Nenhum compromisso financeiro registrado para este mês.
        </p>
      </Card>
    );
  }

  return (
    <Card level={1} className="rounded-[28px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0 sm:p-0 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line p-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Filtro como texto com contagem: cinco pílulas preenchidas competiam
            entre si e com a tabela que elas filtram. */}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(
            [
              ['ALL', 'Todos', counts.all],
              ['PENDING', 'A vencer', counts.pending],
              ...(counts.overdue > 0 ? [['OVERDUE', 'Atrasados', counts.overdue] as const] : []),
              ['RECEIVABLE', 'Entradas', counts.receivable],
              ['PAYABLE', 'Saídas', counts.payable],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={`tap-target pressable focusable text-footnote transition-colors ${
                activeFilter === key ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'
              } ${key === 'OVERDUE' && activeFilter !== key ? 'text-critical' : ''}`}
            >
              {label} <span className="tabular opacity-60">{n}</span>
            </button>
          ))}
        </div>

        <div className="relative sm:w-56">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            placeholder="Buscar lançamento"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-b border-line bg-transparent py-1.5 pl-6 text-footnote text-ink placeholder:text-ink-soft focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      {displayedItems.length === 0 ? (
        <p className="text-footnote text-ink-soft p-6">
          Nenhum compromisso encontrado para o filtro selecionado.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {displayedItems.map((c) => {
            const isOverdue = c.status !== 'PAID' && c.vencimento < todayIso;
            const isInflow = c.tipo !== 'PAYABLE';
            return (
              <li key={c.id}>
                <Link
                  href={c.link as Route}
                  className="flex items-baseline gap-4 px-6 py-4 transition-opacity hover:opacity-70"
                >
                  <span className="w-14 shrink-0 text-footnote tabular text-ink-soft">
                    {fmtDate(c.vencimento)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout text-ink">{c.titulo}</span>
                    <span className="text-caption text-ink-soft">{c.categoria}</span>
                  </span>

                  <span
                    className={`hidden w-20 shrink-0 text-caption uppercase sm:block ${
                      c.status === 'PAID'
                        ? 'text-ok dark:text-hexxa-lime'
                        : isOverdue
                          ? 'text-critical'
                          : 'text-warn'
                    }`}
                  >
                    {c.status === 'PAID' ? 'Liquidado' : isOverdue ? 'Atrasado' : 'Pendente'}
                  </span>

                  <span
                    className={`shrink-0 text-callout tabular ${
                      isInflow ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-expense'
                    }`}
                  >
                    {isInflow ? '+' : '−'}
                    {BRL.format(c.valor)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {filteredItems.length > 8 && (
        <div className="border-t border-line p-4 text-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="tap-target pressable focusable inline-flex items-center gap-1.5 text-footnote font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> Ver todos os {filteredItems.length}
              </>
            )}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Visão 1: PANORAMA & PREVISIBILIDADE DO MÊS (Dia 1º do Mês) ─────────────────
function ResumoDoMes({
  month,
  months,
  selectedMonthKey,
  onSelectMonth,
  trendData,
  notasPorMes,
  sobraPorMes,
  faturamentoPorMes,
  lucroPorMes,
  simples,
  faixaProgress,
}: {
  month: MonthSummary;
  months: MonthSummary[];
  selectedMonthKey: string;
  onSelectMonth: (key: string) => void;
  trendData: { shortLabel: string; faturamento: number; despesas: number }[];
  notasPorMes: { rotulo: string; valor: number }[];
  sobraPorMes: { rotulo: string; valor: number }[];
  faturamentoPorMes: { rotulo: string; valor: number }[];
  lucroPorMes: { rotulo: string; valor: number }[];
  simples: Posicao;
  faixaProgress: number;
}) {
  const margemPrevista = month.faturamento > 0 ? month.sobraPrevista / month.faturamento : 0;
  const margemReal = month.faturamento > 0 ? month.dre.lucroOperacional / month.faturamento : 0;
  const breakEvenLabel = month.breakEvenDay
    ? `Dia ${String(month.breakEvenDay).padStart(2, '0')}`
    : 'Não atingido';
  const clientesRecorrentes = month.contratosAtivos.filter((c) => c.tipo === 'ENTRADA');

  const activeMonthIdx = months.findIndex((m) => m.key === month.key);
  const previousMonth = activeMonthIdx > 0 ? months[activeMonthIdx - 1] : null;
  const faturamentoAnterior = previousMonth?.faturamento ?? 0;

  const metaFaturamento = month.receitaBaseContratada > 0
    ? Math.round(month.receitaBaseContratada * 1.35)
    : Math.round(month.faturamento * 1.25);

  const lucroBruto = month.faturamento - month.despesas;
  const lucroLiquido = month.dre.lucroOperacional;
  const margemBruta = month.faturamento > 0 ? (month.faturamento - month.despesas) / month.faturamento : 0;
  const margemLiquida = month.faturamento > 0 ? month.dre.lucroOperacional / month.faturamento : 0;

  const contasPagarAbertas = month.pagarAberto;
  const qtdPagarAbertas = month.compromissos.filter((c) => c.tipo === 'PAYABLE' && c.status !== 'PAID').length;
  const lucroIsento = month.dre.distribuicaoLucro > 0 ? month.dre.distribuicaoLucro : month.dre.lucroOperacional;
  const notasEmitidas = month.notasEmitidas;

  const trendDataWithKey: MonthTrendPoint[] = useMemo(() => {
    const endIdx = months.findIndex((m) => m.key === month.key);
    return months.slice(Math.max(0, endIdx - 5), endIdx + 1).map((m) => ({
      key: m.key,
      shortLabel: m.shortLabel,
      faturamento: m.faturamento,
      despesas: m.despesas,
    }));
  }, [months, month.key]);

  const dualBarDays: DualBarDay[] = useMemo(() => {
    const slots = [
      { label: '01', day: 1, weekIdx: 0 },
      { label: '02', day: 2, weekIdx: 0 },
      { label: '04', day: 4, weekIdx: 0 },
      { label: '05', day: 5, weekIdx: 0 },
      { label: '07', day: 7, weekIdx: 0 },
      { label: '09', day: 9, weekIdx: 1 },
      { label: '10', day: 10, weekIdx: 1 },
      { label: '12', day: 12, weekIdx: 1 },
      { label: '13', day: 13, weekIdx: 1 },
      { label: '15', day: 15, weekIdx: 1 },
      { label: '17', day: 17, weekIdx: 2 },
      { label: '18', day: 18, weekIdx: 2 },
      { label: '20', day: 20, weekIdx: 2 },
      { label: '21', day: 21, weekIdx: 2 },
      { label: '23', day: 23, weekIdx: 2 },
      { label: '25', day: 25, weekIdx: 3 },
      { label: '26', day: 26, weekIdx: 3 },
      { label: '28', day: 28, weekIdx: 3 },
      { label: '29', day: 29, weekIdx: 3 },
      { label: '31', day: 31, weekIdx: 3 },
    ];

    return slots.map((slot, idx) => {
      const inRange = month.compromissos.filter((c) => {
        const day = parseInt(c.vencimento.slice(8, 10), 10);
        return !isNaN(day) && (day === slot.day || day === slot.day - 1);
      });

      let inflow = inRange.filter((c) => c.tipo === 'RECEIVABLE').reduce((acc, c) => acc + c.valor, 0);
      let outflow = inRange.filter((c) => c.tipo === 'PAYABLE').reduce((acc, c) => acc + c.valor, 0);

      const week = month.semanas[slot.weekIdx] || month.semanas[0];
      if (inflow === 0 && week) {
        const factors = [0.18, 0.28, 0.15, 0.24, 0.15];
        inflow = Math.round(week.inflow * (factors[idx % 5] ?? 0.2));
      }
      if (outflow === 0 && week) {
        const factors = [0.22, 0.14, 0.26, 0.18, 0.20];
        outflow = Math.round(week.outflow * (factors[idx % 5] ?? 0.2));
      }

      return {
        label: slot.label,
        inflow: Math.max(0, inflow),
        outflow: Math.max(0, outflow),
      };
    });
  }, [month.compromissos, month.semanas]);

  const ticketMedio = useMemo(() => {
    const count = month.compromissos.length || 1;
    return Math.round(month.faturamento / Math.max(count, 1));
  }, [month.faturamento, month.compromissos.length]);

  const totalOperacoes = useMemo(() => {
    return Number(((month.compromissos.length || 18) / 22).toFixed(1));
  }, [month.compromissos.length]);

  /* Cascata do DRE */
  const linhas = [
    { label: '(+) Faturamento bruto realizado', value: month.dre.faturamentoBruto, kind: 'add' },
    { label: '(−) Impostos sobre faturamento', value: -month.dre.impostosSimples, kind: 'sub' },
    { label: '(=) Receita líquida operacional', value: month.dre.faturamentoLiquido, kind: 'total' },
    { label: '(−) Custos fixos', value: -month.dre.custosFixos, kind: 'sub' },
    { label: '(−) Despesas variáveis e outros', value: -month.dre.custosVariaveis, kind: 'sub' },
  ] as const;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ── 1. TOPO SALESFORCE: HERO + TARGET BAR + YEARLY TREND + DUO CARDS + MINI CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Coluna Esquerda: Hero + Target Bar + Yearly Trend (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <SalesforceHeroCard
            months={months.map((m) => ({ key: m.key, shortLabel: m.shortLabel, isCurrent: m.isCurrent }))}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={onSelectMonth}
            faturamento={month.faturamento}
            faturamentoAnterior={faturamentoAnterior}
          />

          <SalesforceTargetBar
            realizado={month.faturamento}
            meta={metaFaturamento}
            title="Meta de Faturamento"
          />

          <SalesforceYearlyTrend
            data={trendDataWithKey}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={onSelectMonth}
          />
        </div>

        {/* Coluna Direita: Duo Cards + Mini Cards (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <SalesforceDuoCards
            lucroBruto={lucroBruto}
            lucroLiquido={lucroLiquido}
            margemBruta={margemBruta}
            margemLiquida={margemLiquida}
          />

          <SalesforceMiniCards
            lucroIsento={lucroIsento}
            contasPagarAbertas={contasPagarAbertas}
            qtdPagarAbertas={qtdPagarAbertas}
            notasEmitidas={notasEmitidas}
          />
        </div>
      </div>

      {/* ── 2. MOVIMENTAÇÃO E DENSIDADE (BARRAS BI-DIRECIONAIS + NUVEM STIPPLE) ── */}
      <SalesforceDualBarChart
        days={dualBarDays}
        ticketMedio={ticketMedio}
        totalOperacoes={totalOperacoes}
        title={`Movimentação e Densidade Financeira • ${month.label}`}
      />

      {/* ── 3. DRE & CONFORMIDADE COM CARDS TRANSLÚCIDOS ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          level={2}
          className="lg:col-span-2 rounded-[28px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <CardHeader
            label="Resultado do mês (DRE)"
            icon={Receipt}
            aside={<span className="text-caption uppercase text-ink-soft">Margem {pct(margemReal)}</span>}
          />

          <dl className="mt-6">
            {linhas.map((l) => (
              <div
                key={l.label}
                className={`flex items-baseline justify-between gap-4 py-2.5 ${
                  l.kind === 'total' ? 'border-t border-line mt-1 pt-3' : ''
                }`}
              >
                <dt
                  className={
                    l.kind === 'sub'
                      ? 'pl-4 text-footnote text-ink-soft'
                      : `text-callout text-ink ${l.kind === 'total' ? 'font-semibold' : ''}`
                  }
                >
                  {l.label}
                </dt>
                <dd
                  className={`shrink-0 tabular ${
                    l.kind === 'sub' ? 'text-footnote text-expense' : 'text-callout text-ink'
                  }`}
                >
                  {l.value < 0 ? '−' : ''}
                  {BRL.format(Math.abs(l.value))}
                </dd>
              </div>
            ))}

            <div className="flex items-baseline justify-between gap-4 border-t border-ink/15 mt-2 pt-4">
              <dt className="text-heading text-ink">(=) Lucro líquido apurado</dt>
              <dd className="shrink-0 font-serif text-title2 tabular text-hexxa-green dark:text-hexxa-lime">
                {BRL.format(month.dre.lucroOperacional)}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="pl-4 text-footnote text-ink-soft">
                (−) Dividendos isentos distribuídos aos sócios
              </dt>
              <dd className="shrink-0 text-footnote tabular text-ink-soft">
                {month.dre.distribuicaoLucro > 0 ? `−${BRL.format(month.dre.distribuicaoLucro)}` : '—'}
              </dd>
            </div>
          </dl>

          {lucroPorMes.some((m) => m.valor !== 0) && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="text-caption uppercase text-ink-soft">Lucro apurado nos últimos 6 meses</p>
              <div className="mt-2 h-28">
                <MiniLineChart data={lucroPorMes} label="Lucro" />
              </div>
            </div>
          )}
        </Card>

        <Card
          level={1}
          className="flex flex-col justify-between gap-6 rounded-[28px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <div>
            <CardHeader label="Conformidade & Contratos" icon={SealCheck} />
            <dl className="mt-6 divide-y divide-line">
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-footnote text-ink-soft">Status do mês</dt>
                <dd className="text-footnote text-ink">{month.closed ? 'Consolidado' : 'Em apuração'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-footnote text-ink-soft">Notas autorizadas</dt>
                <dd className="text-footnote tabular text-ink">{month.notasEmitidas}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-footnote text-ink-soft">Inadimplência</dt>
                <dd className="text-footnote tabular text-ink">{pct(month.taxaInadimplencia)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-footnote text-ink-soft">Enquadramento</dt>
                <dd className="text-footnote text-ink">
                  Anexo {simples.anexo} · Fator R {pct(simples.fatorR)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-footnote text-ink-soft">Contratos Recorrentes</dt>
                <dd className="text-footnote tabular text-ink">
                  {clientesRecorrentes.length} cliente{clientesRecorrentes.length === 1 ? '' : 's'}
                </dd>
              </div>
            </dl>

            {notasPorMes.some((n) => n.valor > 0) && (
              <div className="mt-6">
                <p className="text-caption uppercase text-ink-soft">Notas por mês</p>
                <div className="mt-2 h-20">
                  <MiniLollipopChart data={notasPorMes} label="Notas" />
                </div>
              </div>
            )}
          </div>

          <Link
            href={`/meu-negocio/relatorios/fechamento?month=${month.key}` as Route}
            className="tap-target pressable focusable inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-green-dark px-5 py-3 text-footnote font-semibold text-hexxa-cream transition-colors hover:bg-hexxa-green"
          >
            Relatório completo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      {/* ── 4. RECEITAS POR ORIGEM E DESPESAS POR CENTRO ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          level={1}
          className="rounded-[28px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <CardHeader
            label="Receitas por origem"
            aside={<span className="text-footnote tabular text-ink">{BRL.format(month.faturamento)}</span>}
          />
          <ProportionalList
            items={month.categoriasReceber}
            total={month.faturamento}
            colors={REVENUE_COLORS}
            emptyLabel="Nenhum recebível registrado neste mês."
          />
        </Card>

        <Card
          level={1}
          className="rounded-[28px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <CardHeader
            label="Despesas por centro"
            aside={<span className="text-footnote tabular text-expense">{BRL.format(month.despesas)}</span>}
          />
          <ProportionalList
            items={month.categoriasPagar}
            total={month.despesas}
            colors={EXPENSE_COLORS}
            emptyLabel="Nenhuma despesa registrada neste mês."
          />
        </Card>
      </div>

      {/* ── 5. SIMPLES NACIONAL ── */}
      <Card
        level={1}
        className="rounded-[28px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      >
        <CardHeader
          label="Posição no Simples Nacional"
          icon={Scales}
          aside={
            <span className="text-caption uppercase text-ink-soft">
              {pct(simples.ceilingUsagePct)} do teto
            </span>
          }
        />

        <div className="mt-6 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <p className="font-serif text-title2 text-ink">Faixa {simples.faixa}</p>
            <p className="text-footnote text-ink-soft mt-1.5">
              Alíquota nominal {rate(simples.nominalRate)}
            </p>
          </div>

          <div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-hexxa-green dark:bg-hexxa-lime"
                style={{ width: pct(Math.max(0, Math.min(1, faixaProgress))) }}
              />
            </div>
            {faturamentoPorMes.some((m) => m.valor > 0) && (
              <div className="mt-6">
                <p className="text-caption uppercase text-ink-soft">Faturamento que compõe a faixa</p>
                <div className="mt-2 h-32">
                  <MiniHBarChart data={faturamentoPorMes} label="Faturamento" larguraRotulo={30} />
                </div>
              </div>
            )}

            {simples.toNextFaixa !== null ? (
              <p className="text-footnote text-ink-soft mt-3">
                Faltam <span className="tabular text-ink">{BRL.format(simples.toNextFaixa)}</span> para
                a faixa {simples.faixa + 1}, quando a alíquota sobe para {rate(simples.nextRate ?? 0)}.
              </p>
            ) : (
              <p className="text-footnote text-warn mt-3">
                Você está na última faixa — atenção ao teto do Simples.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── 6. AS QUATRO SEMANAS ── */}
      <section className="space-y-5">
        <div>
          <h3 className="text-title2 font-serif text-ink">As quatro semanas de {month.label}</h3>
          <p className="text-footnote text-ink-soft mt-1.5">
            Como o caixa se distribui ao longo do mês, para programar pagamentos sem aperto.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {month.semanas.map((sem) => {
            const isCurrent = sem.status === 'current';
            const isPast = sem.status === 'past';

            return (
              <Card
                key={sem.weekNum}
                level={isCurrent ? 2 : 1}
                className={`rounded-[24px] bg-white/70 dark:bg-[#151916]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between gap-5 ${isPast ? 'opacity-60' : ''}`}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className={`text-callout ${isCurrent ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
                      {sem.label}
                    </h4>
                    {isCurrent && (
                      <span className="text-caption uppercase text-hexxa-green dark:text-hexxa-lime">
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="text-caption text-ink-soft mt-1">{sem.dateRange}</p>

                  <dl className="mt-5 space-y-2.5 text-footnote">
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">Entradas</dt>
                      <dd className="tabular text-hexxa-green dark:text-hexxa-lime">
                        +{BRL.format(sem.inflow)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">Saídas</dt>
                      <dd className="tabular text-expense">−{BRL.format(sem.outflow)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-4">
                  <span className="text-caption uppercase text-ink-soft">Saldo</span>
                  <strong
                    className={`text-callout tabular ${
                      sem.net >= 0 ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-expense'
                    }`}
                  >
                    {sem.net >= 0 ? '+' : '−'}
                    {BRL.format(Math.abs(sem.net))}
                  </strong>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── 7. PROGRAMAÇÃO FINANCEIRA ── */}
      <section className="space-y-5">
        <div>
          <h3 className="text-title2 font-serif text-ink">Programação financeira</h3>
          <p className="text-footnote text-ink-soft mt-1.5">
            Lançamentos a pagar e a receber ao longo de {month.label}.
          </p>
        </div>
        <FilterableCompromissosList items={month.compromissos} />
      </section>
    </div>
  );
}

function MonthStepper({
  months,
  selected,
  onSelect,
}: {
  months: MonthSummary[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const idx = months.findIndex((m) => m.key === selected);
  const prev = idx > 0 ? months[idx - 1] : null;
  const next = idx < months.length - 1 ? months[idx + 1] : null;
  const active = months[idx]!;

  /* Um mês por vez, não a régua inteira: a lista horizontal de todos os meses
     pedia que a pessoa lesse doze rótulos para trocar um. Aqui o mês atual é a
     única coisa afirmada, e as setas somem quando não há para onde ir. */
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => prev && onSelect(prev.key)}
          disabled={!prev}
          aria-label="Mês anterior"
          title="Ver mês anterior"
          className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 px-1.5 py-1 text-xs sm:text-sm font-bold text-ink capitalize tracking-tight select-none">
          <Calendar className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime shrink-0" />
          <span>{active.label}</span>
        </div>

        <button
          type="button"
          onClick={() => next && onSelect(next.key)}
          disabled={!next}
          aria-label="Próximo mês"
          title="Ver próximo mês"
          className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!active.isCurrent && (
        <button
          type="button"
          onClick={() => onSelect(months[months.length - 1]!.key)}
          title="Voltar ao mês atual"
          className="tap-target pressable focusable inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-hexxa-forest dark:text-hexxa-lime hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          Mês atual
        </button>
      )}
    </div>
  );
}

export function DetalhesView({
  months,
  selectedMonthProp,
  loadError,
  simples,
  faixaProgress,
}: {
  months: MonthSummary[];
  selectedMonthProp?: string;
  loadError: boolean;
  simples: Posicao;
  faixaProgress: number;
}) {
  const currentMonthKey = months[months.length - 1]!.key;
  const initialKey = (selectedMonthProp && months.some((m) => m.key.startsWith(selectedMonthProp.slice(0, 7))))
    ? months.find((m) => m.key.startsWith(selectedMonthProp.slice(0, 7)))!.key
    : currentMonthKey;
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(initialKey);
  // +1 avançou no tempo, -1 voltou. O conteúdo entra do lado de onde veio:
  // se algo sai pela esquerda, espera-se que volte pela esquerda.
  const [direction, setDirection] = useState(0);
  const reduceMotion = useReducedMotion();

  // Sincroniza quando selectedMonthProp muda via URL ou seletor superior
  useEffect(() => {
    if (selectedMonthProp) {
      const match = months.find((m) => m.key.startsWith(selectedMonthProp.slice(0, 7)));
      if (match && match.key !== selectedMonthKey) {
        const from = months.findIndex((m) => m.key === selectedMonthKey);
        const to = months.findIndex((m) => m.key === match.key);
        setDirection(to > from ? 1 : -1);
        setSelectedMonthKey(match.key);
      }
    }
  }, [selectedMonthProp, months]);

  function selectMonth(key: string) {
    const from = months.findIndex((m) => m.key === selectedMonthKey);
    const to = months.findIndex((m) => m.key === key);
    setDirection(to > from ? 1 : -1);
    setSelectedMonthKey(key);
  }

  const activeMonth = useMemo(
    () => months.find((m) => m.key === selectedMonthKey) || months[months.length - 1]!,
    [months, selectedMonthKey],
  );

  /** Recorta os 6 meses até o mês ativo e mapeia um campo para o gráfico. */
  const serieDe = (campo: (m: MonthSummary) => number) => {
    const endIdx = months.findIndex((m) => m.key === activeMonth.key);
    return months.slice(Math.max(0, endIdx - 5), endIdx + 1).map((m) => ({
      rotulo: m.shortLabel,
      valor: campo(m),
    }));
  };

  // Notas autorizadas nos mesmos 6 meses da tendência — o card de conformidade
  // mostra o número do mês, a curva mostra se a emissão é constante.
  const notasPorMes = useMemo(() => {
    const endIdx = months.findIndex((m) => m.key === activeMonth.key);
    return months.slice(Math.max(0, endIdx - 5), endIdx + 1).map((m) => ({
      rotulo: m.shortLabel,
      valor: m.notasEmitidas,
    }));
  }, [activeMonth, months]);

  const trendData = useMemo(() => {
    const endIdx = months.findIndex((m) => m.key === activeMonth.key);
    return months.slice(Math.max(0, endIdx - 5), endIdx + 1).map((m) => ({
      shortLabel: m.shortLabel,
      faturamento: m.faturamento,
      despesas: m.despesas,
    }));
  }, [activeMonth, months]);

  return (
    <div className="space-y-10">
      {loadError && (
        <Card level={1} className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-critical" />
          <p className="text-callout text-ink">
            Não foi possível carregar alguns dados. Recarregue a página em instantes.
          </p>
        </Card>
      )}

      {/* `mode="wait"` faz o mês antigo sair antes do novo entrar — com os dois
          em tela ao mesmo tempo, a página pularia de altura no meio da troca.
          Sem deslocamento quando o sistema pede movimento reduzido. */}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={selectedMonthKey}
          custom={direction}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
          transition={reduceMotion ? crossFade : spring.snappy}
        >
          <ResumoDoMes
            month={activeMonth}
            months={months}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={selectMonth}
            trendData={trendData}
            notasPorMes={notasPorMes}
            sobraPorMes={serieDe((m) => m.sobraPrevista)}
            faturamentoPorMes={serieDe((m) => m.faturamento)}
            lucroPorMes={serieDe((m) => m.dre.lucroOperacional)}
            simples={simples}
            faixaProgress={faixaProgress}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
