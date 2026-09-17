'use client';

import { Bar, BarChart, Cell, ReferenceLine, XAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const chartConfig: ChartConfig = {
  valor: { label: 'Valor', color: 'var(--chart-bar)' },
} satisfies ChartConfig;

/**
 * Resultado líquido mês a mês — sobra, lucro, saldo.
 *
 * Barra e não área: o valor pode ser NEGATIVO, e área abaixo de zero é
 * ambígua (o preenchimento some ou se dobra sobre si). A barra parte da linha
 * do zero e cresce para o lado do sinal, então "teve prejuízo em março" se lê
 * na direção, sem precisar do tooltip.
 *
 * A cor segue o sinal, não o ranking: verde acima de zero, laranja abaixo.
 * Nenhum mês vira "o destaque" só por ser o maior.
 */
export function MiniBarChart({
  data,
  label,
}: {
  data: { rotulo: string; valor: number }[];
  label: string;
}) {
  const temNegativo = data.some((d) => d.valor < 0);

  return (
    <ChartContainer
      config={{ valor: { ...chartConfig.valor, label } }}
      className="aspect-auto h-full w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
          <XAxis
            dataKey="rotulo"
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            tick={{ fill: 'var(--color-ink-soft-val)', fontSize: 10 }}
          />
          {/* A linha do zero só aparece quando existe mês negativo: sem
              prejuízo no período ela seria apenas mais um traço na base. */}
          {temNegativo && (
            <ReferenceLine y={0} stroke="var(--color-ink-soft-val)" strokeOpacity={0.35} />
          )}
          <ChartTooltip
            cursor={{ fill: 'var(--color-line-val)' }}
            content={<ChartTooltipContent formatter={(v) => BRL.format(Number(v))} />}
          />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {data.map((d) => (
              <Cell
                key={d.rotulo}
                fill={d.valor < 0 ? 'var(--color-expense)' : 'var(--chart-bar)'}
                fillOpacity={d.valor === 0 ? 0.15 : 0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
