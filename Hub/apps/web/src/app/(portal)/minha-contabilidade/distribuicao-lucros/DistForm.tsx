'use client';

import { useActionState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { addDistribution, type DistState } from './actions';

const initial: DistState = { ok: false, message: '' };
const field = 'mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm';
const label = 'text-xs font-medium text-ink-soft';

const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

export function DistForm() {
  const [state, action, pending] = useActionState(addDistribution, initial);

  return (
    <form action={action} className="card-flat rounded-card p-5">
      <h2 className="text-lg font-semibold">Lançar distribuição</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className={label}>Sócio / beneficiário</label>
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
          <input name="notes" placeholder="Ex.: distribuição trimestral" className={field} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> {pending ? 'Salvando…' : 'Lançar'}
      </button>

      {state.message && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            state.ok ? 'bg-ok/10 text-ok' : 'bg-critical/10 text-critical'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
