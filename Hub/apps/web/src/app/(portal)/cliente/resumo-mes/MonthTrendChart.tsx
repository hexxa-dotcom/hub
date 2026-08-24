'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const chartConfig: ChartConfig = {
  faturamento: { label: 'Faturamento', color: '#2F4A3C' },
  despesas: { label: 'Despesas', color: '#C97B63' },
} satisfies ChartConfig;

export function MonthTrendChart({
  data,
}: {
  data: { shortLabel: string; faturamento: number; despesas: number; isCurrent?: boolean }[];
}) {
  if (!data.length) {
    return <div className="flex h-64 items-center justify-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">Sem dados no período.</div>;
  }
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-black/5 dark:text-white/5" />
          <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fill: '#6E6A61', fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6E6A61', fontSize: 10 }} tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
          <ChartTooltip
            cursor={{ fill: 'rgba(35, 31, 32, 0.04)' }}
            content={<ChartTooltipContent formatter={(value) => BRL.format(Number(value))} />}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#6E6A61' }}
            formatter={(value) => (value === 'faturamento' ? 'Faturamento' : 'Despesas')}
          />
          <Bar dataKey="faturamento" fill="var(--color-faturamento)" radius={[6, 6, 0, 0]} />
          <Bar dataKey="despesas" fill="var(--color-despesas)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
