'use client';

import { ArrowUpRight } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function SalesforceTargetBar({
  realizado,
  meta,
  title = 'Meta de Faturamento',
}: {
  realizado: number;
  meta: number;
  title?: string;
}) {
  const target = meta > 0 ? meta : Math.max(realizado * 1.25, 10000);
  const ratio = Math.min(Math.max(realizado / target, 0), 1);
  const percent = Math.round(ratio * 100);
  const faltam = Math.max(0, target - realizado);

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-white/75 dark:bg-[#151916]/75 backdrop-blur-xl border border-white/70 dark:border-white/10 ring-1 ring-inset ring-white/60 dark:ring-white/5 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between h-full group">
      {/* SVG Defs para a hachura diagonal do restante */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="targetHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="2" className="text-black/25 dark:text-white/20" />
          </pattern>
        </defs>
      </svg>

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-soft mt-0.5">Progresso em relação ao orçamento planejado</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-hexxa-forest group-hover:text-hexxa-lime transition-all">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      {/* Barra de Progresso Espessa Estilo Salesforce */}
      <div className="my-3">
        <div className="relative w-full h-8 sm:h-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden flex items-center p-0.5">
          {/* Fundo total hachurado (trecho restante) */}
          <div className="absolute inset-0 w-full h-full">
            <svg className="w-full h-full">
              <rect width="100%" height="100%" fill="url(#targetHatch)" />
            </svg>
          </div>

          {/* Trecho Realizado em Verde Limão Sólido (#D4FF00) */}
          <div
            className="h-full rounded-full bg-[#D4FF00] relative flex items-center justify-end transition-all duration-700 ease-out z-10 shadow-sm"
            style={{ width: `${Math.max(6, percent)}%` }}
          >
            {/* Marcador de Slider com pontinhos (estilo Salesforce) */}
            <div className="mr-1 h-5 w-2 rounded-full bg-black/30 flex flex-col items-center justify-center gap-0.5">
              <span className="h-0.5 w-0.5 rounded-full bg-white" />
              <span className="h-0.5 w-0.5 rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Métricas e Legenda Inferior */}
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl sm:text-3xl font-extrabold text-ink tabular">
            {BRL.format(realizado)}
          </span>
          <span className="text-xs font-semibold text-ink-soft">
            de {BRL.format(target)}
          </span>
        </div>

        <div className="text-xs font-medium text-ink-soft">
          {faltam > 0 ? (
            <span>
              Faltam <strong className="text-ink font-bold tabular">{BRL.format(faltam)}</strong> ({100 - percent}% restante)
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              Meta 100% atingida!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
