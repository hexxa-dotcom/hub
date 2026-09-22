'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export interface MonthTrendPoint {
  shortLabel: string;
  faturamento: number;
  despesas: number;
  key: string;
}

export function SalesforceYearlyTrend({
  data,
  selectedMonthKey,
  onSelectMonth,
}: {
  data: MonthTrendPoint[];
  selectedMonthKey: string;
  onSelectMonth: (key: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.faturamento, d.despesas)),
    1000
  );

  const selectedIdx = data.findIndex((d) => d.key === selectedMonthKey);
  const activeIdx = hoveredIdx !== null ? hoveredIdx : (selectedIdx !== -1 ? selectedIdx : data.length - 1);
  const activeItem = data[activeIdx] || data[data.length - 1];

  // Cálculo de coordenadas SVG para a curva spline
  const width = 600;
  const height = 140;
  const paddingX = 25;
  const paddingY = 20;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingY * 2;

  const pointsFat = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * usableW;
    const y = height - paddingY - (Math.max(0, d.faturamento) / maxVal) * usableH;
    return { x, y };
  });

  const pointsDesp = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * usableW;
    const y = height - paddingY - (Math.max(0, d.despesas) / maxVal) * usableH;
    return { x, y };
  });

  // Função para criar caminho suave (cubic bezier)
  function createSplinePath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }

  const pathFat = createSplinePath(pointsFat);
  const pathDesp = createSplinePath(pointsDesp);

  const activePoint = pointsFat[activeIdx] || pointsFat[pointsFat.length - 1]!;

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-white/75 dark:bg-[#151916]/75 backdrop-blur-xl border border-white/70 dark:border-white/10 ring-1 ring-inset ring-white/60 dark:ring-white/5 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between h-full group">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-ink">Evolução e Tendência Anual</h3>
          <p className="text-xs text-ink-soft mt-0.5">Trajetória de faturamento e despesas operacionais</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-[#D4FF00]" />
            <span className="font-semibold text-[11px]">Receitas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full border border-dashed border-black/40 dark:border-white/40" />
            <span className="font-semibold text-[11px]">Despesas</span>
          </div>
        </div>
      </div>

      {/* SVG com curvas duplas onduladas e tooltip flutuante estilo Salesforce */}
      <div className="relative w-full h-36 my-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Linha guia vertical no mês ativo */}
          <line
            x1={activePoint.x}
            y1={10}
            x2={activePoint.x}
            y2={height - 10}
            stroke="currentColor"
            strokeWidth="1"
            className="text-black/20 dark:text-white/20"
            strokeDasharray="2 2"
          />

          {/* Curva 2: Despesas (linha pontilhada cinza) */}
          <path
            d={pathDesp}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 3"
            className="text-black/30 dark:text-white/30"
          />

          {/* Curva 1: Receitas (linha sólida em verde limão brilhante #D4FF00) */}
          <path
            d={pathFat}
            fill="none"
            stroke="#D4FF00"
            strokeWidth="2.5"
            className="drop-shadow-xs"
          />

          {/* Ponto indicador ativo */}
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="4.5"
            fill="#0E1310"
            stroke="#D4FF00"
            strokeWidth="2.5"
          />
        </svg>

        {/* Tooltip Pill Pinned Flutuante no Ponto Ativo (estilo Salesforce) */}
        <div
          className="absolute z-20 pointer-events-none transition-all duration-300"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${Math.max(0, (activePoint.y / height) * 100 - 28)}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="rounded-full bg-[#0E1310] dark:bg-white text-white dark:text-[#0E1310] px-3 py-1 text-[11px] font-extrabold shadow-lg tabular whitespace-nowrap">
            {activeItem ? BRL.format(activeItem.faturamento) : ''}
          </div>
          <div className="mx-auto w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#0E1310] dark:border-t-white" />
        </div>
      </div>

      {/* Pílulas de Meses na Base (estilo Salesforce) */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pt-2 pb-1 no-scrollbar border-t border-black/5 dark:border-white/5">
        {data.map((d, i) => {
          const isSelected = i === activeIdx;

          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelectMonth(d.key)}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase transition-all shrink-0 ${
                isSelected
                  ? 'bg-[#0E1310] dark:bg-white text-white dark:text-[#0E1310] shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 text-ink-soft hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              {d.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
