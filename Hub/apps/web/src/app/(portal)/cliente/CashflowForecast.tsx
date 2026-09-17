'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ChartLineUp } from '@phosphor-icons/react';

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

  const maxVal = Math.max(...days.map((d) => Math.max(d.inflow, d.outflow)), 1000);
  const activeDay = days.find((d) => d.date === hoveredDate) || days.find((d) => d.isToday) || days[0];
  const saldoLiquidoPeriodo = totalInflow - totalOutflow;

  return (
    <Card level={1} className="flex h-full flex-col justify-between">
      <div>
        <CardHeader
          label="Próximos 14 dias"
          icon={ChartLineUp}
          aside={
            <div className="flex items-center gap-4 text-caption text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-hexxa-green dark:bg-hexxa-lime" />
                Entradas {BRL.format(totalInflow)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-expense" />
                Saídas {BRL.format(totalOutflow)}
              </span>
            </div>
          }
        />

        {/* Cada dia é uma coluna, não um card: superfície dentro de superfície
            era o que empilhava 14 caixas dentro desta. A seleção se marca no
            próprio dado (peso do rótulo), não em mais uma borda. */}
        <div className="mt-8 grid grid-cols-7 gap-1 sm:grid-cols-14">
          {days.map((d) => {
            const isSelected = activeDay?.date === d.date;
            const inHeight = Math.round((d.inflow / maxVal) * 85);
            const outHeight = Math.round((d.outflow / maxVal) * 85);

            return (
              <div
                key={d.date}
                onMouseEnter={() => setHoveredDate(d.date)}
                className="group flex cursor-pointer flex-col items-center gap-2"
              >
                <div className="relative flex h-24 w-full flex-col items-center justify-center">
                  <div className="flex h-1/2 w-full items-end justify-center">
                    {d.inflow > 0 && (
                      <div
                        style={{ height: `${Math.max(inHeight, 12)}%` }}
                        className="w-2 rounded-t-xs bg-hexxa-green transition-opacity group-hover:opacity-75 dark:bg-hexxa-lime"
                        title={`Entrada: ${BRL.format(d.inflow)}`}
                      />
                    )}
                  </div>

                  <div className="h-px w-full bg-line" />

                  <div className="flex h-1/2 w-full items-start justify-center">
                    {d.outflow > 0 && (
                      <div
                        style={{ height: `${Math.max(outHeight, 12)}%` }}
                        className="w-2 rounded-b-xs bg-expense transition-opacity group-hover:opacity-75"
                        title={`Saída: ${BRL.format(d.outflow)}`}
                      />
                    )}
                  </div>
                </div>

                <span className="text-caption uppercase text-ink-soft">{d.dayLabel}</span>
                <span
                  className={`text-footnote tabular ${
                    isSelected || d.isToday ? 'font-semibold text-ink' : 'text-ink-soft'
                  }`}
                >
                  {d.dayNumber}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {activeDay && (
        <dl className="mt-8 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-line pt-5">
          <div className="flex items-baseline gap-6">
            <div>
              <dt className="text-caption uppercase text-ink-soft">
                {activeDay.isToday ? 'Hoje' : `Dia ${activeDay.dayNumber}`}
              </dt>
              <dd className="text-footnote tabular text-hexxa-green dark:text-hexxa-lime mt-1">
                +{BRL.format(activeDay.inflow)}
              </dd>
            </div>
            <div>
              <dt className="text-caption uppercase text-ink-soft">Saídas</dt>
              <dd className="text-footnote tabular text-expense mt-1">
                −{BRL.format(activeDay.outflow)}
              </dd>
            </div>
          </div>

          <div className="text-right">
            <dt className="text-caption uppercase text-ink-soft">Líquido em 14 dias</dt>
            <dd
              className={`text-heading tabular mt-1 ${
                saldoLiquidoPeriodo >= 0 ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-expense'
              }`}
            >
              {saldoLiquidoPeriodo >= 0 ? '+' : '−'}
              {BRL.format(Math.abs(saldoLiquidoPeriodo))}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
