'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export interface DualBarDay {
  label: string;
  inflow: number;
  outflow: number;
  density?: number;
}

export function SalesforceDualBarChart({
  days,
  ticketMedio = 41221,
  totalOperacoes = 12.5,
  title = 'Movimentação e Densidade de Caixa',
}: {
  days: DualBarDay[];
  ticketMedio?: number;
  totalOperacoes?: number;
  title?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    ...days.map((d) => Math.max(d.inflow, d.outflow)),
    1000
  );

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-white/75 dark:bg-[#151916]/75 backdrop-blur-xl border border-white/70 dark:border-white/10 ring-1 ring-inset ring-white/60 dark:ring-white/5 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between group">
      {/* SVG Defs para hachuras diagonais */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="dualHatchLime" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0E1310" strokeWidth="1.5" strokeOpacity="0.4" />
          </pattern>
          <pattern id="dualHatchDark" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" className="text-black/35 dark:text-white/30" />
          </pattern>
        </defs>
      </svg>

      {/* Header com métricas de resumo */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            {title}
          </span>
          <div className="mt-1 flex items-baseline gap-6 sm:gap-8">
            <div>
              <p className="font-serif text-2xl sm:text-3xl font-extrabold text-ink tabular tracking-tight">
                {BRL.format(ticketMedio)}
              </p>
              <p className="text-[11px] font-medium text-ink-soft">Ticket Médio por Operação</p>
            </div>
            <div>
              <p className="font-serif text-2xl sm:text-3xl font-extrabold text-ink tabular tracking-tight">
                {totalOperacoes.toLocaleString('pt-BR')}
              </p>
              <p className="text-[11px] font-medium text-ink-soft">Lançamentos / Dia Útil</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-[#D4FF00]" />
              <span>Entradas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-black/20 dark:bg-white/20" />
              <span>Saídas</span>
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* ── Visualização: Nuvem Stipple + Barras Bi-direcionais em Cápsula Coesa ── */}
      <div className="w-full max-w-5xl mx-auto flex flex-col">
        {/* 1. Nuvem de Pontos (Stipple Density) alinhada exatamente a cada coluna */}
        <div className="flex items-end justify-between gap-1 sm:gap-2 h-14 pb-2 border-b border-black/5 dark:border-white/5">
          {days.map((d, i) => {
            const relInflow = d.inflow / maxVal;
            const dotCount = Math.min(8, Math.max(2, Math.round(relInflow * 8)));
            const dots = Array.from({ length: dotCount }, (_, k) => ({
              offsetY: k * 5 + (Math.sin(i * 1.5 + k) * 2),
              isLime: (i + k) % 4 === 0,
              size: k % 3 === 0 ? 3 : 2,
            }));

            return (
              <div
                key={`stipple-${i}`}
                className="flex-1 max-w-[34px] min-w-[12px] flex flex-col items-center justify-end h-full pointer-events-none"
              >
                <div className="flex flex-col items-center gap-1">
                  {dots.map((dot, k) => (
                    <span
                      key={k}
                      className="rounded-full shrink-0 transition-opacity"
                      style={{
                        width: `${dot.size}px`,
                        height: `${dot.size}px`,
                        backgroundColor: dot.isLime ? '#D4FF00' : 'currentColor',
                        opacity: hoveredIdx === i ? 1 : 0.45,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. Barras Bi-direcionais Perfeitamente Centralizadas na Linha do Zero */}
        <div className="relative flex items-center justify-between gap-1 sm:gap-2 h-44 w-full my-2">
          {/* Linha Central do Zero - matematicamente no meio exato */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-black/15 dark:bg-white/15 z-0" />

          {days.map((d, idx) => {
            const isHovered = hoveredIdx === idx;
            const upRatio = d.inflow > 0 ? Math.max(0.18, Math.min(0.94, d.inflow / maxVal)) : 0.08;
            const downRatio = d.outflow > 0 ? Math.max(0.18, Math.min(0.92, d.outflow / maxVal)) : 0.08;

            return (
              <div
                key={`bar-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="relative flex-1 max-w-[34px] min-w-[12px] flex flex-col h-full cursor-pointer group/col z-10"
              >
                {/* Tooltip flutuante centralizado */}
                {isHovered && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 rounded-full bg-[#0E1310] dark:bg-white px-2.5 py-0.5 text-[10px] font-bold text-white dark:text-[#0E1310] shadow-lg whitespace-nowrap animate-fade-in pointer-events-none">
                    +{BRL.format(d.inflow)} / −{BRL.format(d.outflow)}
                  </div>
                )}

                {/* Metade Superior: Entradas sobem da linha do zero */}
                <div className="w-full h-1/2 flex items-end justify-center pb-[0.75px]">
                  <div
                    className={`w-full rounded-t-full transition-all duration-300 relative overflow-hidden ${
                      isHovered ? 'scale-[1.08] shadow-md brightness-110' : ''
                    }`}
                    style={{ height: `${Math.round(upRatio * 100)}%` }}
                  >
                    {idx % 4 === 0 ? (
                      /* Cápsula Verde Limão Elétrico */
                      <div className="w-full h-full bg-[#D4FF00] shadow-xs" />
                    ) : idx % 2 === 0 ? (
                      /* Cápsula Preta/Obsidian */
                      <div className="w-full h-full bg-[#0E1310] dark:bg-white" />
                    ) : (
                      /* Cápsula com Hachura Diagonal */
                      <div className="w-full h-full bg-black/10 dark:bg-white/10 relative">
                        <svg className="w-full h-full absolute inset-0">
                          <rect width="100%" height="100%" fill="url(#dualHatchDark)" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metade Inferior: Saídas descem da linha do zero */}
                <div className="w-full h-1/2 flex items-start justify-center pt-[0.75px]">
                  <div
                    className={`w-full rounded-b-full bg-black/20 dark:bg-white/20 transition-all duration-300 ${
                      isHovered ? 'scale-[1.08] bg-rose-500/40' : ''
                    }`}
                    style={{ height: `${Math.round(downRatio * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Linha Dedicada de Rótulos na Base (dias do mês) */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-1 border-t border-black/5 dark:border-white/5">
          {days.map((d, idx) => (
            <div
              key={`label-${idx}`}
              className="flex-1 max-w-[34px] min-w-[12px] text-center"
            >
              <span
                className={`text-[9px] sm:text-[10px] font-bold uppercase transition-colors ${
                  hoveredIdx === idx ? 'text-ink font-black' : 'text-ink-soft'
                }`}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
