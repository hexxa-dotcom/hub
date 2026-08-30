'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Calendar, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const maxVal = Math.max(
    ...days.map((d) => Math.max(d.inflow, d.outflow)),
    1000
  );

  const activeDay = days.find((d) => d.date === selectedDate) || days.find((d) => d.isToday) || days[0];
  const saldoLiquidoPeriodo = totalInflow - totalOutflow;

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#1E3328] text-[#DFFFAE]">
                <Calendar className="h-3.5 w-3.5" />
              </span>
              <h2 className="font-serif font-bold text-base sm:text-lg text-[#231F20] dark:text-[#FEFDF3]">
                Próximos 14 Dias
              </h2>
            </div>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
              Previsão diária de entradas e saídas programadas
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE]" />
              <span className="text-[#6E6A61] dark:text-[#A8A49C]">Entradas ({BRL.format(totalInflow)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400" />
              <span className="text-[#6E6A61] dark:text-[#A8A49C]">Saídas ({BRL.format(totalOutflow)})</span>
            </div>
          </div>
        </div>

        {/* Days Bar Visualization */}
        <div className="pt-6 pb-2">
          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 sm:gap-2">
            {days.map((d) => {
              const isSelected = activeDay?.date === d.date;
              const inHeightPct = Math.round((d.inflow / maxVal) * 100);
              const outHeightPct = Math.round((d.outflow / maxVal) * 100);
              const hasMovement = d.inflow > 0 || d.outflow > 0;

              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelectedDate(d.date)}
                  className={`flex flex-col items-center justify-end p-2 rounded-2xl transition-all group ${
                    isSelected
                      ? 'bg-white dark:bg-white/15 shadow-sm ring-2 ring-[#2F4A3C] dark:ring-[#DFFFAE]'
                      : 'hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  {/* Bars container */}
                  <div className="h-20 w-full flex items-end justify-center gap-1 mb-2">
                    {/* Inflow bar */}
                    <div
                      style={{ height: `${Math.max(inHeightPct > 0 ? inHeightPct : 0, 4)}%` }}
                      className={`w-2 rounded-t-md transition-all ${
                        d.inflow > 0
                          ? 'bg-[#2F4A3C] dark:bg-[#DFFFAE]'
                          : 'bg-transparent'
                      }`}
                    />
                    {/* Outflow bar */}
                    <div
                      style={{ height: `${Math.max(outHeightPct > 0 ? outHeightPct : 0, 4)}%` }}
                      className={`w-2 rounded-t-md transition-all ${
                        d.outflow > 0
                          ? 'bg-amber-600 dark:bg-amber-400'
                          : 'bg-transparent'
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <span className="text-[10px] text-[#6E6A61] dark:text-[#A8A49C] uppercase font-bold">
                    {d.dayLabel}
                  </span>
                  <span
                    className={`text-xs font-bold font-mono mt-0.5 ${
                      d.isToday
                        ? 'text-[#2F4A3C] dark:text-[#DFFFAE] underline decoration-2'
                        : 'text-[#231F20] dark:text-[#FEFDF3]'
                    }`}
                  >
                    {d.dayNumber}
                  </span>

                  {hasMovement && (
                    <span
                      className={`h-1 w-1 rounded-full mt-1 ${
                        d.inflow >= d.outflow
                          ? 'bg-[#2F4A3C] dark:bg-[#DFFFAE]'
                          : 'bg-amber-600 dark:bg-amber-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Footer Summary */}
      {activeDay && (
        <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">
              {activeDay.isToday ? 'Hoje' : `Dia ${activeDay.dayNumber}`}:
            </span>
            <span className="text-[#2F4A3C] dark:text-[#DFFFAE] font-medium flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> Entradas {BRL.format(activeDay.inflow)}
            </span>
            <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-0.5 ml-2">
              <ArrowDownRight className="h-3 w-3" /> Saídas {BRL.format(activeDay.outflow)}
            </span>
          </div>

          <div className="font-medium">
            <span className="text-[#6E6A61] dark:text-[#A8A49C]">Saldo do período: </span>
            <strong
              className={`font-serif font-bold text-sm tabular ${
                saldoLiquidoPeriodo >= 0
                  ? 'text-[#2F4A3C] dark:text-[#DFFFAE]'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {BRL.format(saldoLiquidoPeriodo)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
