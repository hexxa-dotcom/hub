'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface ClienteMonthSelectorProps {
  currentMonthKey: string;
  selectedMonthKey: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getMonthLabel(key: string): string {
  const parts = key.split('-');
  const y = parts[0] || String(new Date().getFullYear());
  const m = parseInt(parts[1] || '9', 10);
  return `${MONTH_NAMES[m - 1]} de ${y}`;
}

function shiftMonthKey(key: string, delta: number): string {
  const parts = key.split('-');
  const y = parseInt(parts[0] || '2026', 10);
  const m = parseInt(parts[1] || '9', 10);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function ClienteMonthSelector({
  currentMonthKey,
  selectedMonthKey,
}: ClienteMonthSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const isCurrent = selectedMonthKey.slice(0, 7) === currentMonthKey.slice(0, 7);
  const displayLabel = getMonthLabel(selectedMonthKey);

  const prevMonthKey = shiftMonthKey(selectedMonthKey, -1);
  const nextMonthKey = shiftMonthKey(selectedMonthKey, 1);

  // Permite recuar até 12 meses atrás a partir do mês atual
  const minMonthKey = shiftMonthKey(currentMonthKey, -12);
  const hasPrev = selectedMonthKey > minMonthKey;
  const hasNext = selectedMonthKey.slice(0, 7) < currentMonthKey.slice(0, 7);

  const handleSelectMonth = (targetKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (targetKey.slice(0, 7) === currentMonthKey.slice(0, 7)) {
      params.delete('month');
      params.delete('m');
    } else {
      params.set('month', targetKey.slice(0, 7));
    }
    const qs = params.toString();
    startTransition(() => {
      router.push((qs ? `${pathname}?${qs}` : pathname) as any);
    });
  };

  return (
    <div className={`shrink-0 flex items-center gap-1.5 transition-opacity ${isPending ? 'opacity-70' : 'opacity-100'}`}>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleSelectMonth(prevMonthKey)}
          disabled={!hasPrev || isPending}
          aria-label="Mês anterior"
          title="Ver mês anterior"
          className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 px-1.5 py-1 text-xs sm:text-sm font-bold text-ink inline-block first-letter:uppercase tracking-tight select-none">
          <Calendar className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime shrink-0" />
          <span>{displayLabel}</span>
        </div>

        <button
          type="button"
          onClick={() => handleSelectMonth(nextMonthKey)}
          disabled={!hasNext || isPending}
          aria-label="Próximo mês"
          title="Ver próximo mês"
          className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!isCurrent && (
        <button
          type="button"
          onClick={() => handleSelectMonth(currentMonthKey)}
          disabled={isPending}
          title="Retornar ao mês atual"
          className="tap-target pressable focusable inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-hexxa-forest dark:text-hexxa-lime hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          Mês atual
        </button>
      )}
    </div>
  );
}
