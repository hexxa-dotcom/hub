'use client';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function SalesforceHeroCard({
  months,
  selectedMonthKey,
  onSelectMonth,
  faturamento,
  faturamentoAnterior,
}: {
  months: { key: string; shortLabel: string; isCurrent: boolean }[];
  selectedMonthKey: string;
  onSelectMonth: (key: string) => void;
  faturamento: number;
  faturamentoAnterior: number;
}) {
  const diff = faturamento - faturamentoAnterior;
  const hasDiff = faturamentoAnterior > 0;
  const isPositive = diff >= 0;

  // Pegamos os últimos 6 meses até o selecionado ou os 6 mais recentes
  const recentMonths = months.slice(-6);

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-white/75 dark:bg-[#151916]/75 backdrop-blur-xl border border-white/70 dark:border-white/10 ring-1 ring-inset ring-white/60 dark:ring-white/5 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between h-full group">
      {/* Padrão SVG para hachura diagonal das cápsulas */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="monthHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" className="text-black/25 dark:text-white/20" />
          </pattern>
        </defs>
      </svg>

      <div>
        {/* Título de Boas-Vindas */}
        <h2 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
          Olá, veja o panorama completo da sua empresa.
        </h2>
        <p className="text-xs text-ink-soft mt-1">
          Acompanhamento analítico e histórico consolidado do negócio.
        </p>

        {/* Cápsulas Horizontais de Meses (Estilo Salesforce) */}
        <div className="mt-6 flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 no-scrollbar">
          {recentMonths.map((m) => {
            const isSelected = m.key === selectedMonthKey;

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelectMonth(m.key)}
                className={`group/month relative flex flex-col items-center justify-between rounded-2xl transition-all duration-300 shrink-0 select-none ${
                  isSelected
                    ? 'w-12 h-16 bg-[#0E1310] dark:bg-white text-white dark:text-[#0E1310] shadow-md scale-105'
                    : 'w-11 h-14 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-ink-soft'
                }`}
              >
                {/* Tampa / Crown no topo da cápsula */}
                {isSelected ? (
                  <div className="w-full h-4 rounded-t-2xl bg-[#D4FF00] dark:bg-[#D4FF00] flex items-center justify-center shrink-0">
                    <span className="w-2.5 h-1 rounded-full bg-black/40" />
                  </div>
                ) : (
                  <div className="w-full h-8 rounded-t-2xl relative overflow-hidden shrink-0">
                    <svg className="w-full h-full absolute inset-0">
                      <rect width="100%" height="100%" fill="url(#monthHatch)" />
                    </svg>
                  </div>
                )}

                {/* Rótulo do Mês */}
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider pb-2 ${
                    isSelected ? 'text-white dark:text-[#0E1310]' : 'text-ink-soft'
                  }`}
                >
                  {m.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Métrica de Faturamento deste Mês */}
      <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5">
        <p className="text-xs font-semibold text-ink-soft">
          Neste mês sua empresa faturou no total:
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <span className="font-serif text-3xl sm:text-4xl font-extrabold text-ink tabular tracking-tight">
            {BRL.format(faturamento)}
          </span>

          {hasDiff && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                isPositive
                  ? 'bg-[#D4FF00]/25 text-[#214a13] dark:bg-[#D4FF00]/20 dark:text-[#D4FF00]'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
              }`}
            >
              {isPositive ? '↗ +' : '↘ −'}
              {BRL.format(Math.abs(diff))} vs. mês anterior
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
