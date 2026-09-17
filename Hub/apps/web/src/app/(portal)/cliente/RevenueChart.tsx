'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

type RevenueChartProps = {
  data: { month: string; rawMonth: string; amount: number; isCurrentMonth?: boolean }[];
};

/** Texto de eixo usa token de tinta, não a cor da série — e por ser token,
 *  acompanha o tema (antes era hex fixo, ilegível no escuro). */
const AXIS_TICK = { fill: 'var(--color-ink-soft-val)', fontSize: 11 };

export function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-footnote text-ink-soft">
        Nenhum dado de faturamento disponível no período.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-line-val)"
          />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-line-val)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0];
              return (
                <div className="rounded-2xl border border-line bg-surface-card p-4 shadow-(--elev-2)">
                  <p className="text-caption uppercase text-ink-soft">{item?.payload?.rawMonth}</p>
                  <p className="text-heading tabular text-ink mt-1">
                    {BRL.format(Number(item?.value || 0))}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isCurrentMonth ? 'var(--chart-bar-current)' : 'var(--chart-bar)'}
                className="transition-opacity hover:opacity-80"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
