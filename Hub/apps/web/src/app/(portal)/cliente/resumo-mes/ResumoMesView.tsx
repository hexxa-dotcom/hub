'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
  FileText,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  DollarSign,
  Briefcase,
  Target,
  Compass,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from 'lucide-react';
import { MonthTrendChart } from './MonthTrendChart';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDate = (d: string) => {
  if (!d) return '--/--';
  const parts = d.slice(0, 10).split('-');
  return `${parts[2]}/${parts[1]}`;
};
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

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

const REVENUE_COLORS = ['#1E3328', '#2D4B3B', '#486E58', '#6D957E', '#A5BFA0'];
const EXPENSE_COLORS = ['#C85A32', '#D97736', '#E2975D', '#B5835A', '#8C684E'];

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
  const filtered = items.filter((d) => d.value > 0).slice(0, 5);
  if (!filtered.length || total <= 0) {
    return <p className="py-6 text-center text-xs text-[#5F6F66] dark:text-[#94A79C]">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
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

      <ul className="space-y-2 pt-1 text-xs">
        {filtered.map((item, idx) => {
          const ratio = item.value / total;
          return (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[idx % colors.length] }} />
                <span className="truncate text-[#5F6F66] dark:text-[#94A79C] font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono font-bold text-[#18221C] dark:text-[#FEFDF3]">{BRL.format(item.value)}</span>
                <span className="w-11 text-right font-mono text-[11px] font-semibold text-[#5F6F66] dark:text-[#94A79C]">
                  {pct(ratio)}
                </span>
              </div>
            </li>
          );
        })}
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
      <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#141C18] p-8 text-center text-[#5F6F66] dark:text-[#94A79C] shadow-sm">
        <Calendar className="h-8 w-8 mx-auto opacity-30 mb-2" />
        <p className="text-sm font-semibold">Nenhum compromisso financeiro registrado para este mês.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#141C18] shadow-sm">
      <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF7F2]/60 dark:bg-[#111A15]/40">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-full transition-all ${
              activeFilter === 'ALL'
                ? 'bg-[#111A15] text-[#DFFFAE] shadow-sm dark:bg-[#DFFFAE] dark:text-[#111A15]'
                : 'bg-white dark:bg-white/10 text-[#5F6F66] dark:text-[#94A79C] hover:bg-black/5'
            }`}
          >
            Todos ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('PENDING')}
            className={`px-3 py-1.5 rounded-full transition-all ${
              activeFilter === 'PENDING'
                ? 'bg-[#111A15] text-[#DFFFAE] shadow-sm dark:bg-[#DFFFAE] dark:text-[#111A15]'
                : 'bg-white dark:bg-white/10 text-[#5F6F66] dark:text-[#94A79C] hover:bg-black/5'
            }`}
          >
            A Vencer ({counts.pending})
          </button>
          {counts.overdue > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                activeFilter === 'OVERDUE'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="h-3 w-3" /> Atrasados ({counts.overdue})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveFilter('RECEIVABLE')}
            className={`px-3 py-1.5 rounded-full transition-all ${
              activeFilter === 'RECEIVABLE'
                ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                : 'bg-white dark:bg-white/10 text-[#5F6F66] dark:text-[#94A79C] hover:bg-black/5'
            }`}
          >
            Entradas ({counts.receivable})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('PAYABLE')}
            className={`px-3 py-1.5 rounded-full transition-all ${
              activeFilter === 'PAYABLE'
                ? 'bg-[#C85A32] text-white shadow-sm'
                : 'bg-white dark:bg-white/10 text-[#5F6F66] dark:text-[#94A79C] hover:bg-black/5'
            }`}
          >
            Saídas ({counts.payable})
          </button>
        </div>

        <div className="relative min-w-[200px] sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5F6F66] dark:text-[#94A79C]" />
          <input
            type="text"
            placeholder="Buscar lançamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-full text-xs bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[#18221C] dark:text-[#FEFDF3] focus:outline-none focus:ring-1 focus:ring-[#1E3328] dark:focus:ring-[#DFFFAE]"
          />
        </div>
      </div>

      <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/30 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5F6F66] dark:text-[#94A79C]">
        <span>Descrição / Categoria</span>
        <span className="w-24 text-right">Vencimento</span>
        <span className="w-28 text-right">Valor</span>
        <span className="w-20 text-center">Tipo</span>
        <span className="w-24 text-center">Status</span>
      </div>

      <div className="divide-y divide-black/5 dark:divide-white/5">
        {displayedItems.length === 0 ? (
          <p className="p-8 text-center text-xs text-[#5F6F66] dark:text-[#94A79C]">
            Nenhum compromisso encontrado para o filtro selecionado.
          </p>
        ) : (
          displayedItems.map((c) => {
            const isOverdue = c.status !== 'PAID' && c.vencimento < todayIso;
            return (
              <Link
                key={c.id}
                href={c.link as Route}
                className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 p-4 px-6 hover:bg-[#FAF7F2]/80 dark:hover:bg-white/5 transition-colors ${
                  isOverdue ? 'border-l-4 border-l-red-500' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#18221C] dark:text-[#FEFDF3]">{c.titulo}</p>
                  <p className="text-[11px] text-[#5F6F66] dark:text-[#94A79C]">{c.categoria}</p>
                </div>
                <span className="hidden sm:block w-24 text-right font-mono text-xs text-[#5F6F66] dark:text-[#94A79C]">
                  {fmtDate(c.vencimento)}
                </span>
                <span
                  className={`w-28 text-right font-mono text-sm font-bold ${
                    c.tipo === 'PAYABLE' ? 'text-[#C85A32] dark:text-[#E57850]' : 'text-[#1E3328] dark:text-[#DFFFAE]'
                  }`}
                >
                  {c.tipo === 'PAYABLE' ? '-' : '+'}{BRL.format(c.valor)}
                </span>
                <span className="hidden sm:block w-20 text-center text-[11px] font-semibold text-[#5F6F66] dark:text-[#94A79C]">
                  {c.tipo === 'PAYABLE' ? 'Saída' : 'Entrada'}
                </span>
                <span className="w-24 flex justify-end sm:justify-center">
                  {c.status === 'PAID' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#DFFFAE]/30 dark:bg-[#DFFFAE]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#1E3328] dark:text-[#DFFFAE]">
                      <CheckCircle2 className="h-3 w-3" /> Liquidado
                    </span>
                  ) : isOverdue ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/60 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" /> Atrasado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      <Clock className="h-3 w-3" /> Pendente
                    </span>
                  )}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {filteredItems.length > 8 && (
        <div className="p-3 border-t border-black/5 dark:border-white/10 text-center bg-[#FAF7F2]/40 dark:bg-[#111A15]/20">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3328] dark:text-[#DFFFAE] hover:underline"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> Ver todos os {filteredItems.length} compromissos (+{filteredItems.length - 8})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Visão 1: PANORAMA & PREVISIBILIDADE DO MÊS (Dia 1º do Mês) ─────────────────
function PanoramaView({ month }: { month: MonthSummary }) {
  const margemPrevista = month.faturamento > 0 ? month.sobraPrevista / month.faturamento : 0;
  const breakEvenLabel = month.breakEvenDay ? `Dia ${String(month.breakEvenDay).padStart(2, '0')}` : 'Não atingido';

  return (
    <div className="space-y-8 animate-fade-up">
      {/* 1. COCKPIT DO MAPA DE VOO ORÇAMENTÁRIO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Mestre: Previsão de Sobra no Bolso */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#18261F] via-[#111A15] to-[#0D1410] text-[#FEFDF3] border border-[#2F4A3C]/80 p-6 sm:p-8 shadow-md flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-[#DFFFAE] text-xs font-bold uppercase tracking-wider">
                <Compass className="h-4 w-4" />
                <span>Panorama Orçamentário</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1E3328] px-3 py-0.5 text-[11px] font-bold text-[#DFFFAE] border border-[#DFFFAE]/20">
                Previsibilidade {month.shortLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 mb-6">
              <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#FEFDF3]">
                {BRL.format(month.sobraPrevista)}
              </h3>
              <span className="text-xs sm:text-sm font-mono font-bold px-2.5 py-1 rounded-xl bg-[#DFFFAE]/15 text-[#DFFFAE]">
                {pct(margemPrevista)} de sobra estimada
              </span>
            </div>
          </div>

          {/* 4 Métricas de Previsão de Início de Mês */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
            <div className="bg-white/5 border border-white/8 rounded-2xl p-3.5">
              <span className="text-[11px] text-[#DFFFAE]/70 uppercase tracking-wider block mb-1">
                Receita Contratada
              </span>
              <p className="font-mono font-bold text-base sm:text-lg text-[#FEFDF3]">{BRL.format(month.receitaBaseContratada)}</p>
              <p className="text-[10px] text-[#DFFFAE]/60 mt-0.5">garantida em contratos</p>
            </div>

            <div className="bg-white/5 border border-white/8 rounded-2xl p-3.5">
              <span className="text-[11px] text-[#DFFFAE]/70 uppercase tracking-wider block mb-1">
                Custo Fixo Mínimo
              </span>
              <p className="font-mono font-bold text-base sm:text-lg text-[#FEFDF3]">{BRL.format(month.custoFixoComprometido)}</p>
              <p className="text-[10px] text-[#DFFFAE]/60 mt-0.5">para abrir a empresa</p>
            </div>

            <div className="bg-white/5 border border-white/8 rounded-2xl p-3.5">
              <span className="text-[11px] text-[#DFFFAE]/70 uppercase tracking-wider block mb-1">
                Ponto de Equilíbrio
              </span>
              <p className="font-mono font-bold text-base sm:text-lg text-[#DFFFAE]">{breakEvenLabel}</p>
              <p className="text-[10px] text-[#DFFFAE]/60 mt-0.5">quando as contas fecham</p>
            </div>

            <div className="bg-white/5 border border-white/8 rounded-2xl p-3.5">
              <span className="text-[11px] text-[#DFFFAE]/70 uppercase tracking-wider block mb-1">
                Imposto Estimado
              </span>
              <p className="font-mono font-bold text-base sm:text-lg text-amber-300">{BRL.format(month.impostos)}</p>
              <p className="text-[10px] text-amber-200/60 mt-0.5">Simples Nacional (DAS)</p>
            </div>
          </div>
        </div>

        {/* Card Lateral: Contratos & Retainers Vigentes */}
        <div className="relative overflow-hidden rounded-3xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#141C18] p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[#111A15] text-[#DFFFAE] shadow-sm">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="font-serif font-bold text-base text-[#18221C] dark:text-[#FEFDF3]">
                    Contratos &amp; Retainers
                  </h4>
                  <p className="text-[11px] text-[#5F6F66] dark:text-[#94A79C]">
                    Receita recorrente garantida
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-[#DFFFAE]/40 dark:bg-[#DFFFAE]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#1E3328] dark:text-[#DFFFAE] border border-[#DFFFAE]/60">
                {month.contratosAtivos.filter((c) => c.tipo === 'ENTRADA').length} clientes
              </span>
            </div>

            <div className="my-4 space-y-2.5">
              {month.contratosAtivos.filter((c) => c.tipo === 'ENTRADA').slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF7F2] dark:bg-white/5 text-xs">
                  <span className="font-bold text-[#18221C] dark:text-[#FEFDF3] truncate max-w-[150px]">{c.nome}</span>
                  <span className="font-mono font-bold text-[#1E3328] dark:text-[#DFFFAE]">{BRL.format(c.valor)}/mês</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="text-[#5F6F66] dark:text-[#94A79C]">Garantia de faturamento:</span>
            <Link
              href="/meu-negocio/contratos"
              className="font-bold text-[#1E3328] dark:text-[#DFFFAE] hover:underline flex items-center gap-1"
            >
              Gerenciar Contratos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. MAPA DE VOO DAS 4 SEMANAS DO MÊS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-serif text-lg font-bold text-[#18221C] dark:text-[#FEFDF3]">
              Linha do Tempo das 4 Semanas de {month.label}
            </h4>
            <p className="text-xs text-[#5F6F66] dark:text-[#94A79C]">
              Como o fluxo de caixa se divide ao longo do mês para planejar pagamentos sem aperto.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {month.semanas.map((sem) => {
            const isCurrentWeek = sem.status === 'current';
            const isPastWeek = sem.status === 'past';

            return (
              <div
                key={sem.weekNum}
                className={`rounded-3xl p-5 border shadow-sm transition-all flex flex-col justify-between ${
                  isCurrentWeek
                    ? 'bg-[#FAF7F2] dark:bg-[#1A2620] border-[#1E3328] dark:border-[#DFFFAE] ring-2 ring-[#DFFFAE]/40'
                    : isPastWeek
                      ? 'bg-white/60 dark:bg-[#141C18]/60 border-black/5 dark:border-white/5 opacity-80'
                      : 'bg-white dark:bg-[#141C18] border-black/8 dark:border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-serif font-bold text-sm text-[#18221C] dark:text-[#FEFDF3]">
                      {sem.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isCurrentWeek
                          ? 'bg-[#111A15] text-[#DFFFAE]'
                          : isPastWeek
                            ? 'bg-black/5 dark:bg-white/10 text-[#5F6F66] dark:text-[#94A79C]'
                            : 'bg-[#DFFFAE]/30 text-[#1E3328] dark:text-[#DFFFAE]'
                      }`}
                    >
                      {isCurrentWeek ? 'Semana Atual' : isPastWeek ? 'Concluída' : 'A Realizar'}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#5F6F66] dark:text-[#94A79C] font-mono mb-4">
                    {sem.dateRange}
                  </p>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-[#5F6F66] dark:text-[#94A79C] flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-[#1E3328] dark:text-[#DFFFAE]" /> Entradas
                      </span>
                      <span className="font-bold text-[#1E3328] dark:text-[#DFFFAE]">+{BRL.format(sem.inflow)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5F6F66] dark:text-[#94A79C] flex items-center gap-1">
                        <ArrowDownRight className="h-3 w-3 text-[#C85A32] dark:text-[#E57850]" /> Saídas
                      </span>
                      <span className="font-bold text-[#C85A32] dark:text-[#E57850]">-{BRL.format(sem.outflow)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#5F6F66] dark:text-[#94A79C]">Saldo Semana:</span>
                  <strong
                    className={`font-mono font-bold ${
                      sem.net >= 0 ? 'text-[#1E3328] dark:text-[#DFFFAE]' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {sem.net >= 0 ? '+' : ''}{BRL.format(sem.net)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. LISTA DE COMPROMISSOS DO MÊS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-serif text-lg font-bold text-[#18221C] dark:text-[#FEFDF3]">
              Programação Financeira do Mês
            </h4>
            <p className="text-xs text-[#5F6F66] dark:text-[#94A79C]">
              Lançamentos programados de contas a pagar e receber ao longo do mês.
            </p>
          </div>
        </div>
        <FilterableCompromissosList items={month.compromissos} />
      </div>
    </div>
  );
}

// ── Visão 2: FECHAMENTO & DRE CONSOLIDADO (Fim do Mês & Histórico) ─────────────
function FechamentoView({
  month,
  trendData,
}: {
  month: MonthSummary;
  trendData: { shortLabel: string; faturamento: number; despesas: number }[];
}) {
  const margemReal = month.faturamento > 0 ? month.dre.lucroOperacional / month.faturamento : 0;

  return (
    <div className="space-y-8 animate-fade-up">
      {/* 1. DRE SINTÉTICO EXECUTIVO (Demonstrativo do Resultado) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel do DRE */}
        <div className="lg:col-span-2 rounded-3xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#141C18] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10 mb-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[#111A15] text-[#DFFFAE] shadow-sm">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-serif font-bold text-base text-[#18221C] dark:text-[#FEFDF3]">
                  DRE Sintético Consolidado
                </h4>
                <p className="text-[11px] text-[#5F6F66] dark:text-[#94A79C]">
                  Demonstrativo do resultado contábil de {month.label}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-[#111A15] text-[#DFFFAE] px-3 py-1 text-xs font-mono font-bold shadow-sm">
              Margem {pct(margemReal)}
            </span>
          </div>

          {/* Linhas da Cascata do DRE */}
          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between font-medium">
              <span className="text-[#18221C] dark:text-[#FEFDF3] font-bold">(+) Faturamento Bruto Realizado</span>
              <span className="font-mono font-bold text-base text-[#1E3328] dark:text-[#DFFFAE]">{BRL.format(month.dre.faturamentoBruto)}</span>
            </div>

            <div className="flex items-center justify-between text-[#5F6F66] dark:text-[#94A79C] pl-3">
              <span>(-) Impostos sobre Faturamento (Simples Nacional)</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">-{BRL.format(month.dre.impostosSimples)}</span>
            </div>

            <div className="flex items-center justify-between font-semibold border-t border-black/5 dark:border-white/5 pt-2 text-[#18221C] dark:text-[#FEFDF3]">
              <span>(=) Receita Líquida Operacional</span>
              <span className="font-mono">{BRL.format(month.dre.faturamentoLiquido)}</span>
            </div>

            <div className="flex items-center justify-between text-[#5F6F66] dark:text-[#94A79C] pl-3">
              <span>(-) Custos Fixos (Folha, Pró-Labore, Servidores, Estrutura)</span>
              <span className="font-mono text-[#C85A32] dark:text-[#E57850]">-{BRL.format(month.dre.custosFixos)}</span>
            </div>

            <div className="flex items-center justify-between text-[#5F6F66] dark:text-[#94A79C] pl-3">
              <span>(-) Despesas Variáveis &amp; Outros</span>
              <span className="font-mono text-[#C85A32] dark:text-[#E57850]">-{BRL.format(month.dre.custosVariaveis)}</span>
            </div>

            <div className="flex items-center justify-between font-bold border-t border-black/10 dark:border-white/10 pt-3 text-base text-[#18221C] dark:text-[#FEFDF3]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#1E3328] dark:text-[#DFFFAE]" />
                (=) Lucro Líquido Efetivo Apurado
              </span>
              <span className="font-mono font-serif text-xl text-[#1E3328] dark:text-[#DFFFAE]">
                {BRL.format(month.dre.lucroOperacional)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#5F6F66] dark:text-[#94A79C] pl-3 pt-1">
              <span>(-) Distribuição de Dividendos Isentos aos Sócios</span>
              <span className="font-mono font-bold text-[#1E3328] dark:text-[#DFFFAE]">
                {month.dre.distribuicaoLucro > 0 ? `-${BRL.format(month.dre.distribuicaoLucro)}` : 'R$ 0'}
              </span>
            </div>
          </div>
        </div>

        {/* Card Lateral: Relatório Oficial & Encerramento */}
        <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-[#FAF7F2] dark:bg-[#141C18] p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#1E3328] dark:text-[#DFFFAE] text-xs font-bold uppercase tracking-wider mb-3">
              <ShieldCheck className="h-4 w-4" />
              <span>Conformidade Contábil</span>
            </div>

            <h4 className="font-serif font-bold text-xl text-[#18221C] dark:text-[#FEFDF3] mb-2">
              Fechamento Hexx
            </h4>
            <p className="text-xs text-[#5F6F66] dark:text-[#94A79C] leading-relaxed mb-6">
              O relatório contábil consolida os extratos, notas fiscais e conciliação bancária oficiais gerados pelo escritório contábil.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-white/5">
                <span className="text-[#5F6F66] dark:text-[#94A79C]">Status do Mês:</span>
                <span className="font-bold text-[#1E3328] dark:text-[#DFFFAE]">
                  {month.closed ? 'Consolidado' : 'Em Apuração'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-white/5">
                <span className="text-[#5F6F66] dark:text-[#94A79C]">Notas Fiscais:</span>
                <span className="font-mono font-bold text-[#18221C] dark:text-[#FEFDF3]">
                  {month.notasEmitidas} autorizadas
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-white/5">
                <span className="text-[#5F6F66] dark:text-[#94A79C]">Inadimplência:</span>
                <span className="font-mono font-bold text-[#18221C] dark:text-[#FEFDF3]">
                  {pct(month.taxaInadimplencia)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-black/5 dark:border-white/5">
            <Link
              href={`/meu-negocio/relatorios/fechamento?month=${month.key}` as Route}
              className="inline-flex items-center justify-center w-full rounded-2xl bg-[#111A15] hover:bg-[#1E3328] px-4 py-3 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all"
            >
              <span>Acessar Relatório Completo</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. EVOLUÇÃO COMPARATIVA & DECOMPOSIÇÕES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#141C18] p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
            <h4 className="font-serif font-bold text-base text-[#18221C] dark:text-[#FEFDF3]">
              Evolução Histórica
            </h4>
            <span className="text-xs font-mono text-[#5F6F66] dark:text-[#94A79C]">Últimos 6 meses</span>
          </div>
          <div className="mt-4">
            <MonthTrendChart data={trendData} />
          </div>
        </div>

        <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#141C18] p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
            <h4 className="font-serif font-bold text-base text-[#18221C] dark:text-[#FEFDF3]">
              Receitas por Origem
            </h4>
            <span className="font-mono text-xs font-bold text-[#1E3328] dark:text-[#DFFFAE]">
              {BRL.format(month.faturamento)}
            </span>
          </div>
          <ProportionalList
            items={month.categoriasReceber}
            total={month.faturamento}
            colors={REVENUE_COLORS}
            emptyLabel="Nenhum recebível registrado neste mês."
          />
        </div>

        <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#141C18] p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
            <h4 className="font-serif font-bold text-base text-[#18221C] dark:text-[#FEFDF3]">
              Despesas por Centro
            </h4>
            <span className="font-mono text-xs font-bold text-[#C85A32] dark:text-[#E57850]">
              {BRL.format(month.despesas)}
            </span>
          </div>
          <ProportionalList
            items={month.categoriasPagar}
            total={month.despesas}
            colors={EXPENSE_COLORS}
            emptyLabel="Nenhuma despesa registrada neste mês."
          />
        </div>
      </div>

      {/* 3. TABELA DE COMPROMISSOS AUDITADA */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-serif text-lg font-bold text-[#18221C] dark:text-[#FEFDF3]">
              Extrato Consolidado do Mês
            </h4>
            <p className="text-xs text-[#5F6F66] dark:text-[#94A79C]">
              Histórico de todos os lançamentos que compõem o fechamento de {month.label}.
            </p>
          </div>
        </div>
        <FilterableCompromissosList items={month.compromissos} />
      </div>
    </div>
  );
}

// ── View Principal do Resumo do Mês ───────────────────────────────────────────
export function ResumoMesView({ months, loadError }: { months: MonthSummary[]; loadError: boolean }) {
  const currentMonthKey = months[months.length - 1]!.key;
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);

  const activeMonth = useMemo(() => {
    return months.find((m) => m.key === selectedMonthKey) || months[months.length - 1]!;
  }, [months, selectedMonthKey]);

  // Modo: Panorama (início de mês) ou Fechamento (DRE / consolidado)
  const [activeMode, setActiveMode] = useState<'PANORAMA' | 'FECHAMENTO'>(
    activeMonth.isCurrent ? 'PANORAMA' : 'FECHAMENTO'
  );

  const trendData = useMemo(() => {
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
      {/* Header Editorial Refinado */}
      <header className="relative overflow-hidden rounded-3xl bg-[#FAF7F2] dark:bg-[#141C18] border border-black/8 dark:border-white/10 p-6 sm:p-8 text-[#18221C] dark:text-[#FEFDF3] shadow-sm">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111A15] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm">
              <Sparkles className="h-3 w-3" /> Gestão Mensal Estratégica
            </span>

            {activeMonth.closed && (
              <Link
                href={`/meu-negocio/relatorios/fechamento?month=${activeMonth.key}` as Route}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#111A15] text-[#DFFFAE] hover:bg-[#1E3328] px-4 py-1.5 text-xs font-bold shadow-sm transition-all hover:scale-105"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Fechamento Contábil Disponível <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-[#18221C] dark:text-[#FEFDF3] mb-1">
                Resumo &amp; Panorama do Mês
              </h1>
              <p className="text-[#5F6F66] dark:text-[#94A79C] text-sm sm:text-base max-w-2xl">
                O mapa de voo orçamentário para consultar no início do mês e o compilado contábil para o fechamento.
              </p>
            </div>

            {/* Alternador de Modo: Panorama vs Fechamento */}
            <div className="flex items-center p-1 rounded-2xl bg-white dark:bg-white/10 border border-black/8 dark:border-white/10 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setActiveMode('PANORAMA')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'PANORAMA'
                    ? 'bg-[#111A15] text-[#DFFFAE] shadow-sm dark:bg-[#DFFFAE] dark:text-[#111A15]'
                    : 'text-[#5F6F66] dark:text-[#94A79C] hover:text-[#18221C]'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Panorama do Mês</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('FECHAMENTO')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'FECHAMENTO'
                    ? 'bg-[#111A15] text-[#DFFFAE] shadow-sm dark:bg-[#DFFFAE] dark:text-[#111A15]'
                    : 'text-[#5F6F66] dark:text-[#94A79C] hover:text-[#18221C]'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Fechamento &amp; DRE</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Não foi possível carregar alguns dados. Recarregue a página em instantes.</p>
        </div>
      )}

      {/* SELETOR TEMPORAL DE MESES (RÉGUA CONTÍNUA) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#1E3328] dark:text-[#DFFFAE]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#5F6F66] dark:text-[#94A79C]">
              Mês de Referência: <span className="text-[#18221C] dark:text-[#FEFDF3] capitalize">{activeMonth.label}</span>
            </span>
          </div>

          {selectedMonthKey !== currentMonthKey && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonthKey(currentMonthKey);
                setActiveMode('PANORAMA');
              }}
              className="text-xs font-bold text-[#1E3328] dark:text-[#DFFFAE] hover:underline flex items-center gap-1"
            >
              Ir para o Mês Atual ({months[months.length - 1]!.shortLabel}) →
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
          {months.map((m) => {
            const isSelected = m.key === selectedMonthKey;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setSelectedMonthKey(m.key);
                  if (m.isCurrent) setActiveMode('PANORAMA');
                  else setActiveMode('FECHAMENTO');
                }}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold capitalize transition-all ${
                  isSelected
                    ? 'bg-[#111A15] text-[#DFFFAE] shadow-md ring-1 ring-[#DFFFAE]/30 dark:bg-[#DFFFAE] dark:text-[#111A15]'
                    : 'bg-white dark:bg-[#141C18] border border-black/8 dark:border-white/10 text-[#5F6F66] dark:text-[#94A79C] hover:bg-black/5 hover:text-[#18221C]'
                }`}
              >
                <span>{m.shortLabel}</span>
                {m.isCurrent && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-[#DFFFAE] dark:bg-[#111A15]' : 'bg-[#1E3328] dark:bg-[#DFFFAE]'}`} />
                )}
                {m.closed && !m.isCurrent && (
                  <CheckCircle2 className={`h-3 w-3 ${isSelected ? 'text-[#DFFFAE] dark:text-[#111A15]' : 'text-[#5F6F66]'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDERIZAÇÃO DO MODO SELECIONADO */}
      {activeMode === 'PANORAMA' ? (
        <PanoramaView month={activeMonth} />
      ) : (
        <FechamentoView month={activeMonth} trendData={trendData} />
      )}
    </div>
  );
}
