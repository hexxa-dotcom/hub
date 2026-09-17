'use client';

import { MiniHBarChart } from './MiniHBarChart';

/**
 * Atraso por faixa de dias. Responde algo que o total sozinho esconde: R$ 10 mil
 * vencidos ontem é um problema de cobrança; os mesmos R$ 10 mil vencidos há
 * mais de 90 dias é um problema de perda. A distribuição muda a decisão.
 *
 * Barras deitadas: "16–30d" é um rótulo de texto, que na vertical precisaria
 * girar ou abreviar. A opacidade cresce com a faixa — quanto mais velho, mais
 * sólida a barra — então a gravidade se lê na forma, sem uma segunda cor.
 */
export function InadimplenciaChart({
  data,
}: {
  data: { faixa: string; valor: number }[];
}) {
  return (
    <MiniHBarChart
      data={data.map((d) => ({ rotulo: d.faixa, valor: d.valor }))}
      label="Em atraso"
      color="var(--color-expense)"
      larguraRotulo={46}
      ramp
    />
  );
}
