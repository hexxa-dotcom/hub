'use client';

import { useActionState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { addDistribution, type DistState } from './actions';

const initial: DistState = { ok: false, message: '' };
const field =
  'mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-colors';
const label = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] tracking-wide uppercase';

const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

export function DistForm() {
  const [state, action, pending] = useActionState(addDistribution, initial);

  return (
    <form action={action} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
      <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Lançar Distribuição de Lucros</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className={label}>Sócio / Beneficiário</label>
          <input name="partner" required placeholder="Nome do sócio" className={field} />
        </div>
        <div>
          <label className={label}>Valor (R$)</label>
          <input name="amount" inputMode="decimal" required placeholder="0,00" className={field} />
        </div>
        <div>
          <label className={label}>Data</label>
          <input name="date" type="date" defaultValue={thisMonth} required className={field} />
        </div>
        <div className="md:col-span-4">
          <label className={label}>Observação (opcional)</label>
          <input name="notes" placeholder="Ex.: distribuição trimestral 1T" className={field} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {pending ? 'Salvando…' : 'Lançar Distribuição'}
      </button>

      {state.message && (
        <p
          className={`rounded-2xl p-3 text-xs font-bold ${
            state.ok
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

