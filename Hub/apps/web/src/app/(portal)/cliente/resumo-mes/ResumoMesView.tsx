'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { AlertTriangle, ArrowRight, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
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
      <Card level={1}>
        <p className="text-footnote text-ink-soft">
          Nenhum compromisso financeiro registrado para este mês.
        </p>
      </Card>
    );
  }

  return (
    <Card level={1} className="p-0 sm:p-0">
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
  trendData,
  notasPorMes,
  sobraPorMes,
  faturamentoPorMes,
  lucroPorMes,
  simples,
  faixaProgress,
}: {
  month: MonthSummary;
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

  /* Cascata do DRE: hierarquia por peso e filete, não por cor. Só o resultado
     final usa a cor de acento. */
  const linhas = [
    { label: '(+) Faturamento bruto realizado', value: month.dre.faturamentoBruto, kind: 'add' },
    { label: '(−) Impostos sobre faturamento', value: -month.dre.impostosSimples, kind: 'sub' },
    { label: '(=) Receita líquida operacional', value: month.dre.faturamentoLiquido, kind: 'total' },
    { label: '(−) Custos fixos', value: -month.dre.custosFixos, kind: 'sub' },
    { label: '(−) Despesas variáveis e outros', value: -month.dre.custosVariaveis, kind: 'sub' },
  ] as const;

  return (
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card level={2} className="lg:col-span-2 flex flex-col justify-between gap-8">
          <div>
            <CardHeader label="Sobra prevista no mês" />
            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <Metric value={BRL.format(month.sobraPrevista)} size="hero" />
              <span className="text-footnote font-semibold text-hexxa-green dark:text-hexxa-lime">
                {pct(margemPrevista)} de margem estimada
              </span>
            </div>
          </div>

          {sobraPorMes.some((m) => m.valor !== 0) && (
            <div className="mt-6">
              <p className="text-caption uppercase text-ink-soft">Sobra nos últimos 6 meses</p>
              <div className="mt-2 h-24">
                <MiniBarChart data={sobraPorMes} label="Sobra prevista" />
              </div>
            </div>
          )}

          <dl className="grid gap-6 border-t border-line pt-6 sm:grid-cols-4">
            <div>
              <dt className="text-caption uppercase text-ink-soft">Receita contratada</dt>
              <dd className="text-heading tabular mt-1.5">{BRL.format(month.receitaBaseContratada)}</dd>
            </div>
            <div>
              <dt className="text-caption uppercase text-ink-soft">Custo fixo</dt>
              <dd className="text-heading tabular mt-1.5">{BRL.format(month.custoFixoComprometido)}</dd>
            </div>
            <div>
              <dt className="text-caption uppercase text-ink-soft">Ponto de equilíbrio</dt>
              <dd className="text-heading tabular mt-1.5 text-hexxa-green dark:text-hexxa-lime">{breakEvenLabel}</dd>
            </div>
            <div>
              <dt className="text-caption uppercase text-ink-soft">Imposto estimado</dt>
              <dd className="text-heading tabular mt-1.5">{BRL.format(month.impostos)}</dd>
            </div>
          </dl>
        </Card>

        <Card level={2} className="flex flex-col justify-between gap-6">
          <div>
            <CardHeader
              label="Contratos e retainers"
              icon={Handshake}
              aside={
                <span className="text-caption uppercase text-ink-soft">
                  {clientesRecorrentes.length} cliente{clientesRecorrentes.length === 1 ? '' : 's'}
                </span>
              }
            />
            {clientesRecorrentes.length ? (
              <ul className="mt-6 divide-y divide-line">
                {clientesRecorrentes.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="truncate text-callout text-ink">{c.nome}</span>
                    <span className="shrink-0 text-footnote tabular text-ink-soft">
                      {BRL.format(c.valor)}/mês
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-footnote text-ink-soft mt-6">
                Nenhum contrato recorrente ativo neste mês.
              </p>
            )}
          </div>

          <Link
            href="/meu-negocio/contratos"
            className="tap-target pressable focusable inline-flex items-center justify-between gap-2 border-t border-line pt-5 text-footnote font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            Gerenciar contratos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card level={2} className="lg:col-span-2">
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

        {/* "Conformidade contábil" e "Saúde fiscal" listavam quase a mesma coisa
            em dois cards — viraram um. */}
        <Card level={1} className="flex flex-col justify-between gap-6">
          <div>
            <CardHeader label="Conformidade"
            icon={SealCheck} />
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card level={1}>
          <CardHeader
            label="Evolução"
            aside={<span className="text-caption uppercase text-ink-soft">6 meses</span>}
          />
          <div className="mt-6">
            <MonthTrendChart data={trendData} />
          </div>
        </Card>

        <Card level={1}>
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

        <Card level={1}>
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

      <Card level={1}>
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
            {/* Faturamento e não inadimplência: é o faturamento que compõe o
                RBT12 e empurra a empresa de faixa. Inadimplência aqui seria
                gráfico posto onde cabia, não onde pertence. */}
            {faturamentoPorMes.some((m) => m.valor > 0) && (
              <div className="mt-6">
                <p className="text-caption uppercase text-ink-soft">Faturamento que compõe a faixa</p>
                {/* Deitado, na mesma direção da barra de progresso logo acima:
                    a leitura aqui é quanto cada mês PESA no acumulado, e o
                    comprimento corre no mesmo eixo do avanço dentro da faixa. */}
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
                className={`flex flex-col justify-between gap-5 ${isPast ? 'opacity-60' : ''}`}
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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => prev && onSelect(prev.key)}
          disabled={!prev}
          aria-label="Mês anterior"
          className="tap-target pressable focusable grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <h2 className="min-w-44 text-center text-callout capitalize text-ink">{active.label}</h2>

        <button
          type="button"
          onClick={() => next && onSelect(next.key)}
          disabled={!next}
          aria-label="Próximo mês"
          className="tap-target pressable focusable grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!active.isCurrent && (
        <button
          type="button"
          onClick={() => onSelect(months[months.length - 1]!.key)}
          className="tap-target pressable focusable text-footnote font-semibold text-ink-soft transition-colors hover:text-ink"
        >
          Voltar ao mês atual
        </button>
      )}
    </div>
  );
}

export function DetalhesView({
  months,
  loadError,
  simples,
  faixaProgress,
}: {
  months: MonthSummary[];
  loadError: boolean;
  simples: Posicao;
  faixaProgress: number;
}) {
  const currentMonthKey = months[months.length - 1]!.key;
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);
  // +1 avançou no tempo, -1 voltou. O conteúdo entra do lado de onde veio:
  // se algo sai pela esquerda, espera-se que volte pela esquerda.
  const [direction, setDirection] = useState(0);
  const reduceMotion = useReducedMotion();

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

      <MonthStepper months={months} selected={selectedMonthKey} onSelect={selectMonth} />

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
