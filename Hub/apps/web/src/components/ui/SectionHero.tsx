'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { SectionInfo } from '@/components/ui/SectionInfo';

export interface SectionHeroProps {
  /** Título principal da página exibido em destaque à direita */
  title: string;
  /** Título do modal/tooltip de informação */
  infoTitle?: string;
  /** Descrição detalhada sobre a finalidade da seção */
  infoDescription: React.ReactNode;
  /** Mês selecionado no formato YYYY-MM (opcional, controlado) */
  selectedMonth?: string;
  /** Label formatado do mês (opcional, ex: 'Setembro de 2026') */
  monthLabel?: string;
  /** Se o mês selecionado é o mês atual (opcional) */
  isCurrentMonth?: boolean;
  /** Callback para avançar para o mês anterior */
  onPrevMonth?: () => void;
  /** Callback para avançar para o próximo mês */
  onNextMonth?: () => void;
  /** Callback para retornar ao mês atual */
  onCurrentMonth?: () => void;
  /** Notificação geral de alteração de mês */
  onMonthChange?: (month: string) => void;
  /** Se deve exibir a pílula de seleção de mês (padrão: true) */
  showMonthSelector?: boolean;
  /** Conteúdo adicional opcional à direita ou esquerda */
  rightSlot?: React.ReactNode;
  className?: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getCurrentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(yearMonth: string): string {
  if (!yearMonth || yearMonth === 'all') return 'Todos os períodos';
  const parts = yearMonth.split('-');
  const y = parts[0] ?? '';
  const m = parts[1] ?? '01';
  const monthIdx = parseInt(m, 10) - 1;
  const name = MONTH_NAMES[monthIdx] ?? m;
  return `${name} de ${y}`;
}

function shiftMonth(yearMonth: string, delta: number): string {
  const parts = yearMonth.split('-');
  const y = Number(parts[0]) || new Date().getFullYear();
  const m = Number(parts[1]) || (new Date().getMonth() + 1);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function SectionHero({
  title,
  infoTitle,
  infoDescription,
  selectedMonth: controlledMonth,
  monthLabel: controlledLabel,
  isCurrentMonth: controlledIsCurrent,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
  onMonthChange,
  showMonthSelector = false,
  rightSlot,
  className = '',
}: SectionHeroProps) {
  const currentMonthStr = getCurrentMonthStr();
  const [internalMonth, setInternalMonth] = useState<string>(currentMonthStr);

  const activeMonth = controlledMonth !== undefined ? controlledMonth : internalMonth;
  const isCurrent = controlledIsCurrent !== undefined
    ? controlledIsCurrent
    : activeMonth === currentMonthStr;

  const displayLabel = controlledLabel !== undefined
    ? controlledLabel
    : formatMonth(activeMonth);

  const handlePrev = () => {
    if (onPrevMonth) {
      onPrevMonth();
    } else {
      const prev = shiftMonth(activeMonth, -1);
      setInternalMonth(prev);
      onMonthChange?.(prev);
    }
  };

  const handleNext = () => {
    if (onNextMonth) {
      onNextMonth();
    } else {
      const next = shiftMonth(activeMonth, 1);
      setInternalMonth(next);
      onMonthChange?.(next);
    }
  };

  const handleCurrent = () => {
    if (onCurrentMonth) {
      onCurrentMonth();
    } else {
      setInternalMonth(currentMonthStr);
      onMonthChange?.(currentMonthStr);
    }
  };

  return (
    <Card
      level={1}
      className={`hero-section-card relative z-30 py-4 sm:py-5 px-6 sm:px-8 rounded-[2rem] sm:rounded-full card-finish flex items-center shadow-(--elev-1) transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        {/* Canto Esquerdo: Título e Ícone (i) informativo - some no Modo Foco */}
        <div className="hero-title-block flex items-center gap-3 min-w-0">
          <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            {title}
          </h1>
          {/* Ícone de informação (i) */}
          <SectionInfo
            title={infoTitle || `Sobre ${title}`}
            description={infoDescription}
          />
        </div>

        {/* Canto Direito: Seleção do Mês + Ícone (i) + Ações */}
        <div className="hero-actions-block flex items-center gap-2.5 sm:gap-3 shrink-0 self-start sm:self-center">
          {showMonthSelector && (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Mês anterior"
                className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 px-1.5 py-1 text-xs sm:text-sm font-bold text-ink capitalize tracking-tight select-none">
                <Calendar className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime shrink-0" />
                <span>{displayLabel}</span>
              </div>

              <button
                type="button"
                onClick={handleNext}
                aria-label="Próximo mês"
                className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {showMonthSelector && !isCurrent && (
            <button
              type="button"
              onClick={handleCurrent}
              title="Voltar ao mês atual"
              className="tap-target pressable focusable rounded-full bg-hexxa-forest/10 hover:bg-hexxa-forest/20 text-hexxa-forest dark:bg-hexxa-lime/15 dark:hover:bg-hexxa-lime/25 dark:text-hexxa-lime px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Mês atual
            </button>
          )}



          {rightSlot}
        </div>
      </div>
    </Card>
  );
}
