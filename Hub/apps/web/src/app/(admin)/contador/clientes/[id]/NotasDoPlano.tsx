'use client';

import { useState, useTransition } from 'react';
import { liberarNotasDoMesAction } from '../actions';

/** Uso do limite de notas do plano no mês, com a liberação pontual do contador. */
export function NotasDoPlano({ companyId, usadas, limite, liberado }: { companyId: string; usadas: number; limite: number; liberado: boolean }) {
  const [ok, setOk] = useState(liberado);
  const [, iniciar] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={usadas >= limite && !ok ? 'text-rose-600 dark:text-rose-400' : ''}>
        {usadas} de {limite} este mês
      </span>
      {ok ? (
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">liberado este mês</span>
      ) : (
        <button
          type="button"
          onClick={() => iniciar(async () => { const r = await liberarNotasDoMesAction(companyId); if (r.ok) setOk(true); })}
          className="rounded-full border border-black/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#231F20] hover:bg-black/5 dark:border-white/20 dark:text-[#F5F6F4] dark:hover:bg-white/10"
        >
          Liberar este mês
        </button>
      )}
    </span>
  );
}
