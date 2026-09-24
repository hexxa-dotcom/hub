'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react';

interface FinanceiroMonthSelectorProps {
  selectedMonth?: string;
  monthLabel?: string;
  isCurrentMonth?: boolean;
  availableMonths?: string[];
  onMonthChange?: (month: string) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onCurrentMonth?: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMonth(m: string): string {
  if (m === 'todos') return 'Todos os períodos';
  const parts = m.split('-');
  const y = parts[0] ?? '';
  const monthIdx = parseInt(parts[1] ?? '1', 10) - 1;
  return `${MONTH_NAMES[monthIdx] ?? parts[1]} de ${y}`;
}

export function FinanceiroMonthSelector({
  selectedMonth = '',
  monthLabel = 'Setembro de 2026',
  isCurrentMonth = true,
  availableMonths = [],
  onMonthChange,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
}: FinanceiroMonthSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="shrink-0 flex flex-wrap items-center gap-1.5">
      <div className="inline-flex items-center gap-1" ref={dropdownRef}>
        <button
          type="button"
          onClick={onPrevMonth}
          disabled={!onPrevMonth}
          aria-label="Mês anterior"
          className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* O mês é texto; a lista de meses abre pela seta à direita, fora dele. */}
        <span className="inline-block px-1.5 py-1 text-xs font-bold tracking-tight text-ink first-letter:uppercase select-none sm:text-sm">
          {monthLabel}
        </span>

        <button
          type="button"
          onClick={onNextMonth}
          disabled={!onNextMonth}
          aria-label="Próximo mês"
          className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-label="Escolher o mês"
            className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 max-h-72 overflow-y-auto rounded-2xl bg-surface-card shadow-(--elev-3) border border-black/5 dark:border-white/10 p-1.5 animate-in fade-in">
              {availableMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onMonthChange?.(m);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold inline-block first-letter:uppercase transition-colors cursor-pointer ${
                    selectedMonth === m
                      ? 'bg-hexxa-forest text-hexxa-lime'
                      : 'text-ink hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {formatMonth(m)}
                </button>
              ))}
              <div className="border-t border-black/5 dark:border-white/10 my-1" />
              <button
                type="button"
                onClick={() => {
                  onMonthChange?.('todos');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold inline-block first-letter:uppercase transition-colors cursor-pointer ${
                  selectedMonth === 'todos'
                    ? 'bg-hexxa-forest text-hexxa-lime'
                    : 'text-ink hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Todos os períodos
              </button>
            </div>
          )}
        </div>
      </div>

      {!isCurrentMonth && onCurrentMonth && (
        <button
          type="button"
          onClick={onCurrentMonth}
          title="Voltar ao mês atual"
          className="tap-target pressable focusable inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-hexxa-forest dark:text-hexxa-lime hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          Mês atual
        </button>
      )}
    </div>
  );
}
