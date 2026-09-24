'use client';

import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr';
import { ArrowRight, Receipt, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export type TimelineItem = {
  id: string;
  type: 'tax' | 'payable' | 'receivable';
  title: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  category?: string;
  link: string;
};

const FILTERS = [
  ['all', 'Todos'],
  ['tax', 'Impostos'],
  ['payable', 'A pagar'],
  ['receivable', 'A receber'],
] as const;

export function DueDatesTimeline({ items }: { items: TimelineItem[] }) {
  const [filter, setFilter] = useState<'all' | 'tax' | 'payable' | 'receivable'>('all');

  const filtered = items
    .filter((i) => (filter === 'all' ? true : i.type === filter))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const todayIso = new Date().toISOString().slice(0, 10);

  function dateBadge(iso: string) {
    if (!iso) return { label: '—', tone: 'neutral' as const };
    if (iso < todayIso) return { label: 'Vencido', tone: 'critical' as const };
    if (iso === todayIso) return { label: 'Hoje', tone: 'warn' as const };

    const diffDays = Math.ceil((Date.parse(`${iso}T00:00:00`) - Date.parse(`${todayIso}T00:00:00`)) / 86_400_000);
    if (diffDays === 1) return { label: 'Amanhã', tone: 'info' as const };
    if (diffDays <= 7) return { label: `Em ${diffDays}d`, tone: 'neutral' as const };

    const parts = iso.split('-');
    const m = parts[1] ?? '';
    const d = parts[2] ?? '';
    return { label: `${d}/${m}`, tone: 'neutral' as const };
  }

  const totalPayable = items.filter((i) => i.type === 'payable').reduce((s, i) => s + i.amount, 0);
  const totalTax = items.filter((i) => i.type === 'tax').reduce((s, i) => s + i.amount, 0);
  const totalOutflow = totalPayable + totalTax;
  const totalReceivable = items.filter((i) => i.type === 'receivable').reduce((s, i) => s + i.amount, 0);
  const netProjected = totalReceivable - totalOutflow;

  const displayTotal = filter === 'receivable' ? totalReceivable : totalOutflow;

  return (
    <Card level={1} className="h-full card-finish p-6 sm:p-7 flex flex-col justify-between gap-6">
      <div className="space-y-4">
        {/* Topo: Ícone, Título, Valor em Destaque e Filtros */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-(--elev-inset) text-hexxa-forest dark:text-hexxa-lime shrink-0">
              <CalendarBlank className="h-5 w-5" />
            </div>
            <div>
              <p className="text-caption font-bold text-ink-soft uppercase tracking-wider">Próximos Vencimentos</p>
              <p className="font-serif text-2xl sm:text-3xl font-bold text-ink tabular mt-0.5">
                {BRL.format(displayTotal)}
              </p>
            </div>
          </div>

          {/* Filtros em texto — o padrão do sistema (FiltrosEmTexto). */}
          <FiltrosEmTexto
            filtros={FILTERS.map(([k, l]) => ({ id: k, label: l }))}
            ativo={filter}
            onChange={setFilter}
          />
        </div>

        <p className="text-xs text-ink-soft">
          Compromissos financeiros e guias tributárias ordenados por vencimento para manter seu fluxo sob controle.
        </p>

        {/* Mini Cards de Resumo Rápido (A Pagar, A Receber e Saldo Projetado) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-2">
          <div className="rounded-2xl bg-surface/60 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3">
            <p className="text-[10px] sm:text-xs font-bold text-ink-soft uppercase tracking-wider">A Pagar</p>
            <p className="font-serif font-bold text-sm sm:text-base text-ink tabular mt-0.5">
              {BRL.format(totalOutflow)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface/60 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3">
            <p className="text-[10px] sm:text-xs font-bold text-ink-soft uppercase tracking-wider">A Receber</p>
            <p className="font-serif font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 tabular mt-0.5">
              +{BRL.format(totalReceivable)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface/60 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3">
            <p className="text-[10px] sm:text-xs font-bold text-ink-soft uppercase tracking-wider">Saldo Líquido</p>
            <p
              className={`font-serif font-bold text-sm sm:text-base tabular mt-0.5 ${
                netProjected >= 0 ? 'text-hexxa-forest dark:text-hexxa-lime' : 'text-expense'
              }`}
            >
              {netProjected >= 0 ? '+' : ''}
              {BRL.format(netProjected)}
            </p>
          </div>
        </div>

        {/* Lista de Vencimentos */}
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-soft">
            Nenhum vencimento encontrado para o filtro selecionado.
          </div>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5 pt-2">
            {filtered.slice(0, 5).map((item) => {
              const badge = dateBadge(item.dueDate);
              const isInflow = item.type === 'receivable';

              return (
                <li key={item.id}>
                  <Link
                    href={item.link as never}
                    className="group flex items-center justify-between gap-3 py-3 transition-opacity hover:opacity-80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center min-w-16 px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular shrink-0 ${
                          badge.tone === 'critical'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                            : badge.tone === 'warn'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : badge.tone === 'info'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'bg-black/5 dark:bg-white/5 text-ink-soft'
                        }`}
                      >
                        {badge.label}
                      </span>

                      <div className="flex items-center gap-2 min-w-0">
                        <div className="grid h-7 w-7 place-items-center rounded-full bg-surface shrink-0 text-ink-soft group-hover:text-hexxa-forest dark:group-hover:text-hexxa-lime transition-colors">
                          {item.type === 'tax' ? (
                            <Receipt className="h-3.5 w-3.5" />
                          ) : item.type === 'receivable' ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-ink truncate group-hover:text-hexxa-forest dark:group-hover:text-hexxa-lime transition-colors">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-ink-soft truncate">
                            {item.category ?? (item.type === 'tax' ? 'Tributário' : item.type === 'payable' ? 'Conta a Pagar' : 'Recebível')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-serif font-bold text-xs sm:text-sm tabular ${
                          isInflow ? 'text-hexxa-forest dark:text-hexxa-lime' : 'text-ink'
                        }`}
                      >
                        {isInflow ? '+' : '−'}
                        {BRL.format(item.amount)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Rodapé: Totalizador e Link para o Financeiro */}
      <div className="flex items-center justify-between gap-4 border-t border-black/5 dark:border-white/5 pt-4">
        <p className="text-xs text-ink-soft">
          {filtered.length > 5 ? `+ ${filtered.length - 5} compromisso(s) adicional(is)` : 'Todos os compromissos em dia'}
        </p>
        <Link
          href="/meu-negocio/hub-financeiro"
          className="tap-target pressable focusable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/10 shadow-(--elev-1) px-4 py-2 text-xs font-bold text-ink hover:text-hexxa-forest dark:hover:text-hexxa-lime transition-all"
        >
          Ver em Meu mês
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
