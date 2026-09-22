'use client';

import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const chartConfig: ChartConfig = {
  valor: { label: 'Sobra', color: 'var(--chart-bar)' },
} satisfies ChartConfig;

/**
 * Resultado líquido mês a mês — estilo Donezo com barras em cápsula arredondada espessa (chunky capsules).
 */
export function MiniBarChart({
  data,
  label,
}: {
  data: { rotulo: string; valor: number }[];
  label: string;
}) {
  const temNegativo = data.some((d) => d.valor < 0);
  const maxVal = Math.max(...data.map((d) => d.valor), 100);

  return (
    <ChartContainer
      config={{ valor: { ...chartConfig.valor, label } }}
      className="aspect-auto h-full w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <pattern id="miniHatchPattern" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" className="text-hexxa-forest/40 dark:text-hexxa-lime/40" />
            </pattern>
          </defs>
          <XAxis
            dataKey="rotulo"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fill: 'var(--color-ink-soft-val)', fontSize: 11, fontWeight: 600 }}
          />
          <YAxis hide domain={temNegativo ? ['auto', 'auto'] : [0, maxVal * 1.15]} />
          {temNegativo && (
            <ReferenceLine y={0} stroke="var(--color-ink-soft-val)" strokeOpacity={0.35} />
          )}
          <ChartTooltip
            cursor={{ fill: 'var(--color-line-val)', radius: 8 }}
            content={<ChartTooltipContent formatter={(v) => BRL.format(Number(v))} />}
          />
          {/* Barras em formato de cápsula com raio total e largura substancial (estilo Salesforce) */}
          <Bar dataKey="valor" radius={[12, 12, 12, 12]} maxBarSize={36} barSize={28}>
            {data.map((d, index) => {
              const isLast = index === data.length - 1;
              return (
                <Cell
                  key={d.rotulo}
                  fill={
                    d.valor < 0
                      ? 'var(--color-expense)'
                      : isLast
                      ? '#D4FF00'
                      : '#0E1310'
                  }
                  fillOpacity={isLast ? 1 : 0.8}
                  className="transition-all hover:opacity-100"
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

