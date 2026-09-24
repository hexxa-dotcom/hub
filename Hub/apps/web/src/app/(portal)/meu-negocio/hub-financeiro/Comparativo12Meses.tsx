'use client';

import { useState } from 'react';

/**
 * DOZE MESES LADO A LADO — "por que este mês sobrou menos?".
 *
 * Receitas, despesas e resultado de cada mês, e, para o mês escolhido, o que
 * mais mudou por categoria em relação ao anterior. É a pergunta que o cliente
 * fazia ao contador; aqui a resposta está a um clique.
 */

export interface MesDoComparativo {
  mes: string; // AAAA-MM
  rotulo: string; // "set"
  receitas: number;
  despesas: number;
  /** Despesa por categoria no mês. */
  porCategoria: Record<string, number>;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function Comparativo12Meses({ meses, mesAtual }: { meses: MesDoComparativo[]; mesAtual: string }) {
  const [escolhido, setEscolhido] = useState(mesAtual);
  const maximo = Math.max(1, ...meses.map((m) => Math.max(m.receitas, m.despesas)));
  const i = meses.findIndex((m) => m.mes === escolhido);
  const atual = meses[i];
  const anterior = i > 0 ? meses[i - 1] : undefined;

  const variacoes =
    atual && anterior
      ? Array.from(new Set([...Object.keys(atual.porCategoria), ...Object.keys(anterior.porCategoria)]))
          .map((c) => ({ categoria: c, delta: (atual.porCategoria[c] ?? 0) - (anterior.porCategoria[c] ?? 0) }))
          .filter((v) => Math.abs(v.delta) >= 1)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 4)
      : [];

  const resultado = (m: MesDoComparativo) => m.receitas - m.despesas;
  const semDados = meses.every((m) => m.receitas === 0 && m.despesas === 0);

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-inset ring-white/60 backdrop-blur-xl sm:p-7 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="rotulo text-ink-soft">Últimos 12 meses</p>
        <div className="flex gap-4 text-[11px] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-[#1E3328] dark:bg-[#D4FF00]" /> Receitas</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-black/20 dark:bg-white/25" /> Despesas</span>
        </div>
      </div>

      {semDados ? (
        <p className="py-12 text-center text-sm text-ink-soft">Ainda não há lançamentos para comparar.</p>
      ) : (
        <>
          <div className="mt-6 flex h-40 items-end justify-between gap-1.5 sm:gap-3">
            {meses.map((m) => (
              <button
                key={m.mes}
                type="button"
                onClick={() => setEscolhido(m.mes)}
                title={`${m.rotulo}: receitas ${BRL.format(m.receitas)} · despesas ${BRL.format(m.despesas)}`}
                className={`flex h-full flex-1 flex-col justify-end rounded-xl px-0.5 pb-1 transition-colors ${
                  escolhido === m.mes ? 'bg-black/[0.04] dark:bg-white/[0.06]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                }`}
              >
                <span className="flex h-full items-end justify-center gap-0.5">
                  <span className="w-1/2 max-w-[10px] rounded-t-full bg-[#1E3328] dark:bg-[#D4FF00]" style={{ height: `${m.receitas > 0 ? Math.max(3, (m.receitas / maximo) * 100) : 0}%` }} />
                  <span className="w-1/2 max-w-[10px] rounded-t-full bg-black/20 dark:bg-white/25" style={{ height: `${m.despesas > 0 ? Math.max(3, (m.despesas / maximo) * 100) : 0}%` }} />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-1.5 sm:gap-3">
            {meses.map((m) => (
              <span key={m.mes} className={`flex-1 text-center text-[10px] font-bold uppercase ${escolhido === m.mes ? 'text-ink' : 'text-ink-soft'}`}>
                {m.rotulo}
              </span>
            ))}
          </div>

          {atual && (
            <div className="mt-6 grid gap-6 border-t border-black/5 pt-5 sm:grid-cols-2 dark:border-white/10">
              <div>
                <p className="text-xs text-ink-soft">Resultado de {atual.rotulo}</p>
                <p className={`mt-1 font-serif text-2xl font-bold tabular ${resultado(atual) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink'}`}>
                  {BRL.format(resultado(atual))}
                </p>
                {anterior && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {resultado(atual) >= resultado(anterior) ? 'Sobrou ' : 'Sobrou menos: '}
                    {BRL.format(Math.abs(resultado(atual) - resultado(anterior)))}{' '}
                    {resultado(atual) >= resultado(anterior) ? 'a mais' : ''} que em {anterior.rotulo}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-ink-soft">O que mais mudou nas despesas</p>
                {variacoes.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">{anterior ? 'Nenhuma mudança relevante.' : 'Sem mês anterior para comparar.'}</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {variacoes.map((v) => (
                      <li key={v.categoria} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-ink">{v.categoria}</span>
                        <span className={`shrink-0 font-serif font-bold tabular ${v.delta > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {v.delta > 0 ? '+' : '−'}
                          {BRL.format(Math.abs(v.delta))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
