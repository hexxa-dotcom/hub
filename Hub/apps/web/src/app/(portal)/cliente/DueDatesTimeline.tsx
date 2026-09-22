'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { CalendarBlank } from '@phosphor-icons/react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type TimelineItem = {
  id: string;
  type: 'tax' | 'payable' | 'receivable';
  title: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
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

  function dateLabel(iso: string) {
    if (!iso) return '—';
    if (iso === todayIso) return 'Hoje';
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  return (
    <Card level={1} className="h-full card-finish p-6 sm:p-7">
      <CardHeader
        label="Próximos vencimentos"
        icon={CalendarBlank}
        aside={
          <div className="flex items-center gap-1 rounded-full border border-black/5 dark:border-white/10 bg-surface shadow-(--elev-inset) p-1">
            {FILTERS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`tap-target pressable focusable rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                  filter === k ? 'bg-surface-card text-ink shadow-(--elev-1)' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />

      {filtered.length === 0 ? (
        <p className="text-footnote text-ink-soft mt-8">
          Nenhum vencimento para os próximos dias.
        </p>
      ) : (
        /* Linhas separadas por filete, não cards empilhados dentro do card.
           Status aparece uma vez só — na cor da data — em vez de repetir em
           ponto colorido, caixa de ícone e selo. */
        <ul className="mt-6 divide-y divide-line">
          {filtered.slice(0, 5).map((item) => {
            const isOverdue = item.dueDate < todayIso && item.status !== 'paid';
            const isToday = item.dueDate === todayIso;
            const isInflow = item.type === 'receivable';

            return (
              <li key={item.id}>
                <Link
                  href={item.link as never}
                  className="group flex items-baseline gap-4 py-4 transition-opacity hover:opacity-70"
                >
                  <span
                    className={`w-14 shrink-0 text-footnote tabular ${
                      isOverdue ? 'font-semibold text-critical' : isToday ? 'font-semibold text-warn' : 'text-ink-soft'
                    }`}
                  >
                    {dateLabel(item.dueDate)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout text-ink">{item.title}</span>
                    {isOverdue && (
                      <span className="text-caption uppercase text-critical">Vencido</span>
                    )}
                  </span>

                  <span
                    className={`shrink-0 text-callout tabular ${
                      isInflow ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-ink'
                    }`}
                  >
                    {isInflow ? '+' : '−'}
                    {BRL.format(item.amount)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
