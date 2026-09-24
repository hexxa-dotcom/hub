'use client';

import { useState } from 'react';

/**
 * FATURAMENTO MÊS A MÊS — os 12 meses que formam a faixa do Simples e o mês
 * em andamento. O mês atual vem hachurado: ainda não fechou, e não entra na
 * conta da faixa até fechar.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function GraficoFaturamento({ meses }: { meses: { mes: string; valor: number; atual: boolean }[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const maximo = Math.max(1, ...meses.map((m) => m.valor));
  const media = meses.filter((m) => !m.atual).reduce((s, m) => s + m.valor, 0) / 12;
  const f = foco !== null ? meses[foco] : null;

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/75 p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl sm:p-7 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="rotulo text-ink-soft">Faturamento mês a mês</p>
        <p className="text-xs text-ink-soft">
          {f ? (
            <>
              <span className="font-semibold text-ink">{NOMES[Number(f.mes.slice(5)) - 1]}/{f.mes.slice(2, 4)}</span> · {BRL.format(f.valor)}
              {f.atual ? ' até agora' : ''}
            </>
          ) : (
            <>média de {BRL.format(media)} por mês</>
          )}
        </p>
      </div>
      <div className="mt-6 flex h-40 items-end gap-1.5 sm:gap-2.5">
        {meses.map((m, i) => (
          <div
            key={m.mes}
            onMouseEnter={() => setFoco(i)}
            onMouseLeave={() => setFoco(null)}
            className="flex h-full flex-1 cursor-default items-end"
            title={`${m.mes}: ${BRL.format(m.valor)}`}
          >
            {m.valor > 0 ? (
              <div
                className={`w-full rounded-t-lg transition-opacity ${
                  m.atual
                    ? 'text-hexxa-forest/50 ring-1 ring-inset ring-current dark:text-hexxa-lime/50'
                    : 'bg-hexxa-forest dark:bg-hexxa-lime'
                } ${foco !== null && foco !== i ? 'opacity-40' : ''}`}
                style={{
                  height: `${Math.max(3, (m.valor / maximo) * 100)}%`,
                  // Hachurado: o mês ainda não fechou.
                  ...(m.atual ? { background: 'repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 7px)' } : {}),
                }}
              />
            ) : (
              <div className="mx-auto h-1 w-1 rounded-full bg-black/20 dark:bg-white/25" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {meses.map((m) => (
          <span key={m.mes} className={`flex-1 text-center text-[10px] font-bold uppercase ${m.atual ? 'text-ink' : 'text-ink-soft'}`}>
            {NOMES[Number(m.mes.slice(5)) - 1]}
          </span>
        ))}
      </div>
    </div>
  );
}
