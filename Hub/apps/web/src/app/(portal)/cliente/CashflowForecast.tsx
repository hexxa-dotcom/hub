'use client';

import { useState } from 'react';
import { Calendar, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export type CashflowDay = {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Seg", "Ter", etc.
  dayNumber: string; // "29", "30"
  inflow: number;
  outflow: number;
  net: number;
  isToday?: boolean;
};

type Props = {
  days: CashflowDay[];
  totalInflow: number;
  totalOutflow: number;
};

export function CashflowForecast({ days, totalInflow, totalOutflow }: Props) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const maxVal = Math.max(
    ...days.map((d) => Math.max(d.inflow, d.outflow)),
    1000
  );

  const activeDay = days.find((d) => d.date === hoveredDate) || days.find((d) => d.isToday) || days[0];
  const saldoLiquidoPeriodo = totalInflow - totalOutflow;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/8 dark:border-white/10 bg-[#FAF7F2] dark:bg-[#141C18] p-6 sm:p-7 shadow-sm flex flex-col justify-between h-full transition-all">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#111A15] text-[#DFFFAE] shadow-sm">
                <Activity className="h-3.5 w-3.5" />
              </span>
              <h2 className="font-serif font-bold text-base sm:text-lg text-[#18221C] dark:text-[#FEFDF3]">
                Próximos 14 Dias
              </h2>
            </div>
            <p className="text-xs text-[#5F6F66] dark:text-[#94A79C] mt-0.5">
              Régua diária de entradas e saídas programadas
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1E3328] dark:bg-[#DFFFAE]" />
              <span className="text-[#5F6F66] dark:text-[#94A79C]">Entradas ({BRL.format(totalInflow)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#C85A32] dark:bg-[#E57850]" />
              <span className="text-[#5F6F66] dark:text-[#94A79C]">Saídas ({BRL.format(totalOutflow)})</span>
            </div>
          </div>
        </div>

        {/* High-Precision Treasury Ruler with Zero Baseline */}
        <div className="pt-6 pb-2">
          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1 sm:gap-1.5 relative">
            {days.map((d) => {
              const isSelected = activeDay?.date === d.date;
              const inHeightPct = Math.round((d.inflow / maxVal) * 85);
              const outHeightPct = Math.round((d.outflow / maxVal) * 85);
              const hasMovement = d.inflow > 0 || d.outflow > 0;

              return (
                <div
                  key={d.date}
                  onMouseEnter={() => setHoveredDate(d.date)}
                  className={`flex flex-col items-center justify-between p-1.5 rounded-2xl transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-white dark:bg-white/10 shadow-sm ring-1.5 ring-[#1E3328] dark:ring-[#DFFFAE]'
                      : 'hover:bg-white/50 dark:hover:bg-white/5'
                  }`}
                >
                  {/* Flow Vector Bar Container */}
                  <div className="h-24 w-full flex flex-col items-center justify-center relative my-1">
                    {/* Upper half: Inflow Vector */}
                    <div className="w-full h-1/2 flex items-end justify-center pb-[1px]">
                      {d.inflow > 0 ? (
                        <div
                          style={{ height: `${Math.max(inHeightPct, 12)}%` }}
                          className="w-2 sm:w-2.5 rounded-t-sm bg-[#1E3328] dark:bg-[#DFFFAE] transition-all group-hover:brightness-110"
                          title={`Entrada: ${BRL.format(d.inflow)}`}
                        />
                      ) : (
                        <div className="w-1 h-0.5 bg-black/10 dark:bg-white/10 rounded-full" />
                      )}
                    </div>

                    {/* Zero Baseline Divider */}
                    <div className="w-full h-[1px] bg-black/10 dark:bg-white/15" />

                    {/* Lower half: Outflow Vector */}
                    <div className="w-full h-1/2 flex items-start justify-center pt-[1px]">
                      {d.outflow > 0 ? (
                        <div
                          style={{ height: `${Math.max(outHeightPct, 12)}%` }}
                          className="w-2 sm:w-2.5 rounded-b-sm bg-[#C85A32] dark:bg-[#E57850] transition-all group-hover:brightness-110"
                          title={`Saída: ${BRL.format(d.outflow)}`}
                        />
                      ) : (
                        <div className="w-1 h-0.5 bg-black/10 dark:bg-white/10 rounded-full" />
                      )}
                    </div>
                  </div>

                  {/* Day Label & Number */}
                  <span className="text-[9px] text-[#5F6F66] dark:text-[#94A79C] uppercase font-bold tracking-wider">
                    {d.dayLabel}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold mt-0.5 ${
                      d.isToday
                        ? 'text-[#1E3328] dark:text-[#DFFFAE] px-1.5 py-0.2 bg-[#DFFFAE]/40 dark:bg-[#DFFFAE]/20 rounded-md'
                        : 'text-[#18221C] dark:text-[#FEFDF3]'
                    }`}
                  >
                    {d.dayNumber}
                  </span>

                  {/* Status Pip */}
                  <div className="h-1.5 mt-1 flex items-center justify-center">
                    {hasMovement && (
                      <span
                        className={`h-1 w-1 rounded-full ${
                          d.net >= 0
                            ? 'bg-[#1E3328] dark:bg-[#DFFFAE]'
                            : 'bg-[#C85A32] dark:bg-[#E57850]'
                        }`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Floating Inspector */}
      {activeDay && (
        <div className="mt-4 pt-3.5 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-[#18221C] dark:text-[#FEFDF3] bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded-xl font-mono text-[11px]">
              {activeDay.isToday ? 'Hoje (Dia ' + activeDay.dayNumber + ')' : `Dia ${activeDay.dayNumber} (${activeDay.dayLabel})`}
            </span>
            <span className="text-[#1E3328] dark:text-[#DFFFAE] font-medium flex items-center gap-0.5 font-mono">
              <ArrowUpRight className="h-3 w-3" /> +{BRL.format(activeDay.inflow)}
            </span>
            <span className="text-[#C85A32] dark:text-[#E57850] font-medium flex items-center gap-0.5 ml-1 font-mono">
              <ArrowDownRight className="h-3 w-3" /> -{BRL.format(activeDay.outflow)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#5F6F66] dark:text-[#94A79C] text-[11px]">Líquido 14 dias:</span>
            <strong
              className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-full ${
                saldoLiquidoPeriodo >= 0
                  ? 'bg-[#DFFFAE]/30 dark:bg-[#DFFFAE]/15 text-[#1E3328] dark:text-[#DFFFAE]'
                  : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
              }`}
            >
              {saldoLiquidoPeriodo >= 0 ? '+' : ''}{BRL.format(saldoLiquidoPeriodo)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
