'use client';

import { useState } from 'react';

export interface ChunkyBarItem {
  label: string;
  sublabel?: string;
  value: number;
  formattedValue?: string;
  isHighlight?: boolean;
  pattern?: 'solid' | 'hatched' | 'muted';
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function ChunkyBarChart({
  items,
  title = 'Análise Financeira',
  subtitle = 'Distribuição de faturamento e sobra',
  height = 180,
}: {
  items: ChunkyBarItem[];
  title?: string;
  subtitle?: string;
  height?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(...items.map((it) => Math.abs(it.value)), 1);

  // Se nenhum item foi explicitamente marcado como destaque, destaca o último ou o maior
  const activeIndex =
    hoveredIndex !== null
      ? hoveredIndex
      : items.findIndex((it) => it.isHighlight) !== -1
      ? items.findIndex((it) => it.isHighlight)
      : items.length - 1;

  return (
    <div data-card="true" className="rounded-[28px] bg-white/60 dark:bg-[#151916]/60 backdrop-blur-xl border border-white/60 dark:border-white/10 ring-1 ring-inset ring-white/50 dark:ring-white/5 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between h-full group">
      {/* Header com título e legenda */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1E3328] dark:bg-[#DFFFAE]" />
            <span className="text-[11px] font-medium">Consolidado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-black/20 dark:bg-white/20" />
            <span className="text-[11px] font-medium">Projetado</span>
          </div>
        </div>
      </div>

      {/* SVG Patterns para as hachuras diagonais */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          {/* Padrão Hachura Escura/Média */}
          <pattern id="chunkyHatchForest" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#1E3328" strokeWidth="2.5" strokeOpacity="0.5" />
          </pattern>
          {/* Padrão Hachura Suave/Clara */}
          <pattern id="chunkyHatchSoft" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="2" className="text-black/25 dark:text-white/20" />
          </pattern>
        </defs>
      </svg>

      {/* Container das Barras Chunky em Cápsula (itens agrupados com espaçamento compacto e harmonioso) */}
      <div className="relative flex items-end justify-center gap-2 sm:gap-3 md:gap-3.5 pt-12 pb-2 px-2 w-full max-w-md mx-auto h-[180px]">
        {items.map((item, idx) => {
          const isSelected = activeIndex === idx;
          // Garante proporção estética entre 22% (base mínima para cápsula elegante) e 90%
          const hasValue = item.value > 0;
          const ratio = hasValue
            ? Math.max(0.28, Math.min(0.92, item.value / maxValue))
            : 0.18; // base mínima elegante mesmo sem lançamentos
          const barHeightPercent = `${Math.round(ratio * 100)}%`;
          const displayVal = item.formattedValue || BRL.format(item.value);

          // Determinar estilo de preenchimento estilo Donezo
          const patternType = item.pattern || (isSelected ? 'solid' : idx % 2 === 0 ? 'hatched' : 'muted');

          return (
            <div
              key={item.label + idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="relative flex-1 max-w-[60px] flex flex-col items-center h-full justify-end cursor-pointer group/bar"
            >
              {/* Tooltip flutuante superior com visual de pílula (como o '56%' no Donezo) */}
              {isSelected && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center animate-fade-in pointer-events-none">
                  <div className="rounded-full bg-[#1E3328] dark:bg-[#DFFFAE] px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-[#DFFFAE] dark:text-[#1E3328] shadow-md whitespace-nowrap">
                    {displayVal}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-solid border-t-[#1E3328] dark:border-t-[#DFFFAE] border-t-4 border-x-transparent border-x-4 border-b-0" />
                </div>
              )}

              {/* Cápsula arredondada espessa (rounded-full) */}
              <div className="w-full max-w-[48px] min-w-[28px] h-full flex items-end justify-center">
                <div
                  className={`w-full rounded-full transition-all duration-300 relative overflow-hidden ${
                    isSelected
                      ? 'ring-2 ring-[#1E3328] dark:ring-[#DFFFAE] ring-offset-2 ring-offset-white dark:ring-offset-[#1E3328]'
                      : 'hover:scale-[1.03]'
                  }`}
                  style={{ height: barHeightPercent }}
                >
                  {/* Fundo ou Padrão da Barra */}
                  {patternType === 'solid' ? (
                    <div className="w-full h-full bg-[#1E3328] dark:bg-[#DFFFAE] transition-colors" />
                  ) : patternType === 'hatched' ? (
                    <div className="w-full h-full bg-[#243d2f] relative">
                      <svg className="w-full h-full absolute inset-0">
                        <rect width="100%" height="100%" fill="url(#chunkyHatchForest)" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-black/10 dark:bg-white/10 relative">
                      <svg className="w-full h-full absolute inset-0">
                        <rect width="100%" height="100%" fill="url(#chunkyHatchSoft)" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Rótulo da base (Dias S M T W T F S ou Meses) */}
              <div className="mt-3 text-center">
                <span
                  className={`text-[11px] sm:text-xs font-bold transition-colors ${
                    isSelected
                      ? 'text-[#1E3328] dark:text-[#DFFFAE]'
                      : 'text-ink-soft'
                  }`}
                >
                  {item.label}
                </span>
                {item.sublabel && (
                  <p className="text-[9px] text-ink-soft/75 mt-0.5">{item.sublabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
