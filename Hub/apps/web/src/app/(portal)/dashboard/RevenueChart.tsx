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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

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
      <div className="flex h-56 items-center justify-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
        Nenhum dado de faturamento disponível no período.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.amount), 1);

  const chartConfig = {
    amount: {
      label: 'Faturamento',
      color: '#2F4A3C',
    },
  };

  return (
    <div className="h-64 w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            tick={{ fill: '#6E6A61', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6E6A61', fontSize: 10 }}
            tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(35, 31, 32, 0.04)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0];
                return (
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] p-3 shadow-xl text-xs">
                    <p className="font-semibold text-[#6E6A61] dark:text-[#A8A49C] capitalize mb-1">
                      {item?.payload?.rawMonth}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#2F4A3C]" />
                      <span className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] font-serif">
                        {BRL.format(Number(item?.value || 0))}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => {
              const isHighest = entry.amount === maxVal;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isHighest ? '#2F4A3C' : '#A2C1CD'}
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
