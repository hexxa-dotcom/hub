'use client';

import { Area, AreaChart, XAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const chartConfig: ChartConfig = {
  receita: { label: 'Faturamento', color: 'var(--chart-bar)' },
} satisfies ChartConfig;

/**
 * Curva de faturamento dos últimos meses, dentro do card principal.
 *
 * Área e não barra: a leitura aqui é a TRAJETÓRIA (está subindo? desde
 * quando?), e área lê continuidade melhor que barras separadas. O valor exato
 * de cada mês fica no tooltip — aparece sob demanda em vez de ocupar a tela.
 *
 * Sem eixo Y e sem grade: o número grande logo acima já dá a escala, e o
 * excesso de marcação aqui disputaria com ele.
 */
export function FaturamentoChart({
  data,
}: {
  data: { mes: string; receita: number }[];
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <defs>
            {/* Degradê vertical: a área pesa junto à linha e se dissolve na
                base, para não virar bloco sólido competindo com o número. */}
            <linearGradient id="fillReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-receita)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-receita)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="mes"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fill: 'var(--color-ink-soft-val)', fontSize: 11 }}
          />

          <ChartTooltip
            cursor={{ stroke: 'var(--color-line-val)', strokeWidth: 1 }}
            content={<ChartTooltipContent formatter={(value) => BRL.format(Number(value))} />}
          />

          <Area
            dataKey="receita"
            type="monotone"
            stroke="var(--color-receita)"
            strokeWidth={2}
            fill="url(#fillReceita)"
            /* O ponto só aparece no hover: um marcador por mês fixo na tela
               vira ruído numa curva de seis pontos. */
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
