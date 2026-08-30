'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  FileText,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type TimelineItem = {
  id: string;
  type: 'tax' | 'payable' | 'receivable';
  title: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  link: string;
};

export function DueDatesTimeline({
  items,
}: {
  items: TimelineItem[];
}) {
  const [filter, setFilter] = useState<'all' | 'tax' | 'payable' | 'receivable'>('all');

  const filtered = items
    .filter((i) => (filter === 'all' ? true : i.type === filter))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const todayIso = new Date().toISOString().slice(0, 10);

  function formatDateLabel(iso: string) {
    if (!iso) return '—';
    if (iso === todayIso) return 'Hoje';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-5 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#2F4A3C] text-[#DFFFAE]">
              <Calendar className="h-3.5 w-3.5" />
            </span>
            <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">
              Próximos Vencimentos
            </h2>
          </div>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
            Contas a pagar, a receber e guias programadas
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-full text-xs">
          {(
            [
              ['all', 'Todos'],
              ['tax', 'Impostos'],
              ['payable', 'Contas a Pagar'],
              ['receivable', 'Recebíveis'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 font-bold text-[11px] transition-all ${
                filter === k
                  ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                  : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline items */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          <CheckCircle2 className="h-8 w-8 mx-auto text-[#2F4A3C] dark:text-[#DFFFAE] mb-2" />
          Nenhum vencimento ou pendência para os próximos dias. Tudo em dia!
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-black/10 dark:before:bg-white/10">
          {filtered.slice(0, 5).map((item) => {
            const isOverdue = item.dueDate < todayIso && item.status !== 'paid';
            const isToday = item.dueDate === todayIso;

            return (
              <div key={item.id} className="relative group">
                {/* Dot */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-3.5 h-3 w-3 rounded-full border-2 border-[#F4EFE4] dark:border-[#1A201C] transition-transform group-hover:scale-125 ${
                    item.type === 'tax'
                      ? 'bg-[#2F4A3C]'
                      : item.type === 'payable'
                      ? isOverdue
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 p-4 hover:bg-white dark:hover:bg-black/30 transition-all">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                        item.type === 'tax'
                          ? 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]'
                          : item.type === 'payable'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      }`}
                    >
                      {item.type === 'tax' ? (
                        <FileText className="h-5 w-5" />
                      ) : item.type === 'payable' ? (
                        <TrendingDown className="h-5 w-5" />
                      ) : (
                        <TrendingUp className="h-5 w-5" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] truncate">
                          {item.title}
                        </span>
                        {isOverdue && (
                          <span className="rounded-full bg-red-100 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200">
                            Vencido
                          </span>
                        )}
                        {isToday && (
                          <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200">
                            Vence Hoje
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                        Vencimento: <strong>{formatDateLabel(item.dueDate)}</strong> ({item.dueDate.split('-').reverse().join('/')})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/5">
                    <span className="font-serif font-bold text-base sm:text-lg text-[#231F20] dark:text-[#FEFDF3] tabular">
                      {BRL.format(item.amount)}
                    </span>
                    <Link
                      href={item.link as never}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE] px-3.5 py-1.5 text-xs font-bold transition-transform hover:scale-105 shadow-sm"
                    >
                      Ver <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
