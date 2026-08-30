'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

type RevenueChartProps = {
  data: { month: string; rawMonth: string; amount: number; isCurrentMonth?: boolean }[];
};

export function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[#5F6F66] dark:text-[#94A79C]">
        Nenhum dado de faturamento disponível no período.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="h-64 w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-black/5 dark:text-white/5"
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#5F6F66', fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#5F6F66', fontSize: 10, fontFamily: 'monospace' }}
            tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(24, 34, 28, 0.04)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0];
                return (
                  <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-white/95 dark:bg-[#141C18]/95 backdrop-blur-md p-3.5 shadow-xl text-xs">
                    <p className="font-semibold text-[#5F6F66] dark:text-[#94A79C] capitalize mb-1">
                      {item?.payload?.rawMonth}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#1E3328] dark:bg-[#DFFFAE]" />
                      <span className="font-bold text-sm text-[#18221C] dark:text-[#FEFDF3] font-mono">
                        {BRL.format(Number(item?.value || 0))}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((entry, index) => {
              const isCurrent = entry.isCurrentMonth;
              const isHighest = entry.amount === maxVal;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isCurrent ? '#1E3328' : isHighest ? '#324D3E' : '#7D9686'}
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer dark:fill-opacity-90"
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
