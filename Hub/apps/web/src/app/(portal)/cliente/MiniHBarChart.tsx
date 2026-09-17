'use client';

import { Bar, BarChart, Cell, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/**
 * Barras deitadas — comparação de magnitude entre categorias nomeadas.
 *
 * Deitada e não em pé porque o rótulo aqui é uma PALAVRA ("31 a 60 dias"), não
 * um mês de três letras. Na vertical ela precisaria girar ou abreviar; na
 * horizontal cabe inteira, alinhada à esquerda, e o comprimento da barra corre
 * na mesma direção em que se lê.
 *
 * `ramp` escurece progressivamente da primeira à última linha, para quando a
 * ordem das categorias carrega gravidade (atraso de 90 dias é pior que o de
 * 15). Sem ela, todas as barras dividem a mesma cor — comparação de tamanho,
 * sem hierarquia embutida.
 */
export function MiniHBarChart({
  data,
  label,
  color = 'var(--chart-bar)',
  larguraRotulo = 30,
  ramp = false,
}: {
  data: { rotulo: string; valor: number }[];
  label: string;
  color?: string;
  larguraRotulo?: number;
  ramp?: boolean;
}) {
  const config: ChartConfig = { valor: { label, color } };

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 2, right: 4, left: 0, bottom: 2 }}
          barCategoryGap="22%"
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="rotulo"
            axisLine={false}
            tickLine={false}
            width={larguraRotulo}
            tick={{ fill: 'var(--color-ink-soft-val)', fontSize: 10 }}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--color-line-val)' }}
            content={<ChartTooltipContent formatter={(v) => BRL.format(Number(v))} />}
          />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={14}>
            {data.map((d, i) => (
              <Cell
                key={d.rotulo}
                fill="var(--color-valor)"
                fillOpacity={
                  d.valor === 0
                    ? 0.12
                    : ramp
                      ? 0.45 + (i / Math.max(data.length - 1, 1)) * 0.55
                      : 0.85
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
