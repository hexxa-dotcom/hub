import type { ConferenciaDoMes } from '@/lib/server/conferencia-faturamento';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mes = (c: string) => `${MESES[Number(c.slice(5)) - 1]}/${c.slice(0, 4)}`;

/** Notas emitidas × receita apurada no OneFlow — só o que não bate. */
export function ConferenciaDoFaturamento({ itens, conferidas }: { itens: ConferenciaDoMes[]; conferidas: number }) {
  return (
    <section className="mb-6 rounded-[28px] border border-white/60 bg-white/55 p-6 ring-1 ring-inset ring-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
      <p className="rotulo text-ink-soft">Faturamento × OneFlow</p>
      {itens.length === 0 ? (
        <p className="mt-2 text-sm text-ink">
          {conferidas
            ? `As notas emitidas batem com a receita apurada no OneFlow nas ${conferidas} competências conferidas.`
            : 'Ainda não há apuração do OneFlow para conferir — a conferência começa quando a apuração do mês chegar.'}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink">
            {itens.length === 1 ? 'Uma competência não bate' : `${itens.length} competências não batem`}: a receita apurada precisa ser igual à soma das notas emitidas.
          </p>
          <ul className="mt-4 divide-y divide-black/[0.08] dark:divide-white/[0.12]">
            {itens.map((i) => (
              <li key={`${i.companyId}${i.competencia}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_9rem]">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{i.empresa}</span>
                  <span className="block text-xs text-ink-soft">
                    {mes(i.competencia)} · {i.qtdNotas} {i.qtdNotas === 1 ? 'nota' : 'notas'}
                  </span>
                </span>
                <span className="hidden text-right text-xs text-ink-soft sm:block">
                  notas <span className="block font-serif text-sm text-ink tabular">{BRL.format(i.notas)}</span>
                </span>
                <span className="hidden text-right text-xs text-ink-soft sm:block">
                  OneFlow <span className="block font-serif text-sm text-ink tabular">{BRL.format(i.apurada)}</span>
                </span>
                <span className="text-right text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {i.diferenca > 0 ? `faltam ${BRL.format(i.diferenca)} no OneFlow` : `${BRL.format(-i.diferenca)} a mais no OneFlow`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
