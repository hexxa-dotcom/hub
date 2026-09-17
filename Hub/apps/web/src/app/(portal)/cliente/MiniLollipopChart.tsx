'use client';

import { Bar, ComposedChart, Line, XAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const INT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * Pirulito (haste fina + ponto) para CONTAGENS — notas emitidas, documentos,
 * eventos.
 *
 * Contagem não é dinheiro: não tem volume nem continuidade, tem unidades
 * inteiras. A barra grossa sugere massa e a área sugere fluxo contínuo; o
 * pirulito não sugere nenhum dos dois — marca a altura e sai da frente.
 *
 * O tooltip formata como número inteiro. Reaproveitar aqui o formatador de
 * moeda dos outros gráficos escreveria "R$ 8" para oito notas fiscais.
 */
export function MiniLollipopChart({
  data,
  label,
}: {
  data: { rotulo: string; valor: number }[];
  label: string;
}) {
  const config: ChartConfig = { valor: { label, color: 'var(--chart-bar)' } };

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
          <XAxis
            dataKey="rotulo"
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            tick={{ fill: 'var(--color-ink-soft-val)', fontSize: 10 }}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--color-line-val)' }}
            content={<ChartTooltipContent formatter={(v) => INT.format(Number(v))} />}
          />
          {/* A haste: 2px, apenas o suficiente para ancorar o ponto na base. */}
          <Bar dataKey="valor" barSize={2} fill="var(--color-valor)" fillOpacity={0.4} radius={1} />
          {/* A cabeça do pirulito. A linha que ligaria os pontos fica
              transparente: são contagens independentes, não uma trajetória. */}
          <Line
            dataKey="valor"
            type="linear"
            stroke="transparent"
            dot={{ r: 3.5, strokeWidth: 0, fill: 'var(--color-valor)' }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
