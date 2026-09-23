'use client';

import { useState } from 'react';

/**
 * ENTRADAS E SAÍDAS POR PERÍODO — o gráfico padrão de movimento do sistema.
 *
 * O desenho é o da vista Detalhes do Início: barras que sobem (entradas) e
 * descem (saídas) a partir de uma linha do zero. O que mudou é a regra: só
 * dado real. A versão anterior preenchia dia vazio com uma fração inventada
 * do total da semana, desenhava uma "nuvem de pontos" decorativa, pintava a
 * barra pela posição e não pelo que ela mede, e mostrava barra mesmo quando o
 * valor era zero. Aqui, período sem movimento é um ponto na linha do zero.
 */

export interface PeriodoDoGrafico {
  rotulo: string;
  entradas: number;
  saidas: number;
  /** Marca o período corrente (hoje, esta semana). */
  atual?: boolean;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function GraficoEntradasSaidas({
  titulo,
  periodos,
  className = '',
}: {
  titulo: string;
  periodos: PeriodoDoGrafico[];
  className?: string;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const entradas = periodos.reduce((s, p) => s + p.entradas, 0);
  const saidas = periodos.reduce((s, p) => s + p.saidas, 0);
  const saldo = entradas - saidas;
  const maximo = Math.max(1, ...periodos.map((p) => Math.max(p.entradas, p.saidas)));
  // Barra com valor tem altura mínima para ser vista; sem valor, não existe.
  const altura = (v: number) => (v > 0 ? Math.max(4, Math.round((v / maximo) * 100)) : 0);
  const vazio = entradas === 0 && saidas === 0;

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-inset ring-white/60 backdrop-blur-xl sm:p-7 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{titulo}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p>
              <span className="font-serif text-2xl font-extrabold tracking-tight text-ink tabular sm:text-3xl">{BRL.format(saldo)}</span>
              <span className="ml-2 text-[11px] font-medium text-ink-soft">saldo do período</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-[#1E3328] dark:bg-[#D4FF00]" /> Entradas{' '}
            <strong className="font-serif tabular text-ink">{BRL.format(entradas)}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-black/25 dark:bg-white/25" /> Saídas{' '}
            <strong className="font-serif tabular text-ink">{BRL.format(saidas)}</strong>
          </span>
        </div>
      </div>

      {vazio ? (
        <p className="py-16 text-center text-sm text-ink-soft">Nenhuma entrada ou saída neste período.</p>
      ) : (
        <div className="mt-6">
          <div className="relative flex h-44 items-stretch justify-between gap-1 sm:gap-2">
            <div className="absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2 bg-black/15 dark:bg-white/15" />
            {periodos.map((p, i) => (
              <div
                key={i}
                onMouseEnter={() => setFoco(i)}
                onMouseLeave={() => setFoco(null)}
                className="relative z-10 flex min-w-[10px] max-w-[40px] flex-1 cursor-default flex-col"
              >
                {foco === i && (
                  <div className="pointer-events-none absolute -top-7 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0E1310] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg dark:bg-white dark:text-[#0E1310]">
                    {p.rotulo}: +{BRL.format(p.entradas)} / −{BRL.format(p.saidas)}
                  </div>
                )}
                <div className="flex h-1/2 items-end justify-center">
                  {p.entradas > 0 ? (
                    <div
                      className={`w-full rounded-t-full bg-[#1E3328] transition-all duration-300 dark:bg-[#D4FF00] ${foco === i ? 'brightness-125' : ''}`}
                      style={{ height: `${altura(p.entradas)}%` }}
                    />
                  ) : null}
                </div>
                <div className="flex h-1/2 items-start justify-center">
                  {p.saidas > 0 ? (
                    <div
                      className={`w-full rounded-b-full bg-black/20 transition-all duration-300 dark:bg-white/25 ${foco === i ? 'bg-rose-500/50 dark:bg-rose-400/50' : ''}`}
                      style={{ height: `${altura(p.saidas)}%` }}
                    />
                  ) : null}
                </div>
                {p.entradas === 0 && p.saidas === 0 && (
                  <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25 dark:bg-white/30" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-1 border-t border-black/5 pt-1.5 sm:gap-2 dark:border-white/5">
            {periodos.map((p, i) => (
              <span
                key={i}
                className={`min-w-[10px] max-w-[40px] flex-1 text-center text-[9px] font-bold uppercase sm:text-[10px] ${
                  p.atual ? 'text-ink' : foco === i ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                {p.rotulo}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Agrupa lançamentos (data AAAA-MM-DD) por dia do mês: um período por dia. */
export function periodosPorDia(
  mes: string,
  itens: { data: string; valor: number; entrada: boolean }[],
  hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
): PeriodoDoGrafico[] {
  const [ano, m] = mes.split('-').map(Number) as [number, number];
  const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const periodos = Array.from({ length: dias }, (_, i) => ({
    rotulo: String(i + 1).padStart(2, '0'),
    entradas: 0,
    saidas: 0,
    atual: `${mes}-${String(i + 1).padStart(2, '0')}` === hoje,
  }));
  for (const it of itens) {
    if (it.data.slice(0, 7) !== mes) continue;
    const p = periodos[Number(it.data.slice(8, 10)) - 1];
    if (!p) continue;
    if (it.entrada) p.entradas += it.valor;
    else p.saidas += it.valor;
  }
  return periodos;
}
