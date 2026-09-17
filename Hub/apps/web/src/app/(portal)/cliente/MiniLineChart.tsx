'use client';

import { Line, LineChart, ReferenceLine, XAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/**
 * Linha limpa, com um ponto por mês e sem preenchimento.
 *
 * Serve ao caso em que a leitura é de COMPARAÇÃO ponto a ponto ("apurei mais
 * que no mês passado?"), não de volume acumulado. Sem a área embaixo, o olho
 * segue a altura de cada ponto em vez do peso da massa colorida.
 *
 * Segmentos retos (`linear`) e não a curva suave da área: a curva sugere
 * valores intermediários entre os meses, que não existem — apuração é mensal.
 */
export function MiniLineChart({
  data,
  label,
}: {
  data: { rotulo: string; valor: number }[];
  label: string;
}) {
  const config: ChartConfig = { valor: { label, color: 'var(--chart-bar)' } };
  const temNegativo = data.some((d) => d.valor < 0);

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="rotulo"
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            tick={{ fill: 'var(--color-ink-soft-val)', fontSize: 10 }}
          />
          {temNegativo && (
            <ReferenceLine y={0} stroke="var(--color-ink-soft-val)" strokeOpacity={0.35} />
          )}
          <ChartTooltip
            cursor={{ stroke: 'var(--color-line-val)', strokeWidth: 1 }}
            content={<ChartTooltipContent formatter={(v) => BRL.format(Number(v))} />}
          />
          <Line
            dataKey="valor"
            type="linear"
            stroke="var(--color-valor)"
            strokeWidth={2}
            /* Aqui o ponto é fixo, ao contrário da área: são seis medições
               discretas, e cada uma é um fato do mês — não um trecho de curva. */
            dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--color-valor)' }}
            activeDot={{ r: 4.5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
