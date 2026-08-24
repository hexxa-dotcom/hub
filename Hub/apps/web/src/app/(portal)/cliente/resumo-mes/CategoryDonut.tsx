'use client';

import { Pie, PieChart, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const COLORS = ['#2F4A3C', '#A2C1CD', '#C97B63', '#8FA85B', '#D8B26E', '#6E6A61'];

export function CategoryDonut({ data, emptyLabel }: { data: { label: string; value: number }[]; emptyLabel: string }) {
  const filtered = data.filter((d) => d.value > 0).slice(0, 6);
  if (!filtered.length) {
    return <div className="flex h-48 items-center justify-center text-center text-xs text-[#6E6A61] dark:text-[#A8A49C] px-4">{emptyLabel}</div>;
  }

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const chartConfig: ChartConfig = Object.fromEntries(
    filtered.map((d, i) => [d.label, { label: d.label, color: COLORS[i % COLORS.length] }])
  );

  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={chartConfig} className="h-40 w-40 aspect-square shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => BRL.format(Number(value))} />} />
            <Pie data={filtered} dataKey="value" nameKey="label" innerRadius={40} outerRadius={64} strokeWidth={2}>
              {filtered.map((d, i) => (
                <Cell key={d.label} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {filtered.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="flex-1 truncate text-[#6E6A61] dark:text-[#A8A49C]">{d.label}</span>
            <span className="shrink-0 font-bold tabular text-[#231F20] dark:text-[#FEFDF3]">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : '0%'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
