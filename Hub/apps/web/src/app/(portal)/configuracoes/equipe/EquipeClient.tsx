'use client';

import { useActionState, useTransition, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { inviteMemberAction, removeMemberAction, type EquipeState } from './actions';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  FINANCE: 'Financeiro',
  STAFF: 'Equipe',
  ACCOUNTANT: 'Contador',
  VIEWER: 'Consulta',
};

type Member = { membershipId: string; userId: string; name: string; email: string; role: string };

const initialState: EquipeState = { ok: true, message: '' };

export function EquipeClient({ members }: { members: Member[] }) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);
  const [removing, startRemoving] = useTransition();
  const [confirmar, setConfirmar] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form action={formAction} className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="rotulo mb-1.5 block text-ink-soft">E-mail do convidado</label>
          <input
            type="email"
            name="email"
            required
            placeholder="pessoa@empresa.com.br"
            className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="rotulo mb-1.5 block text-ink-soft">Papel</label>
          <select
            name="role"
            defaultValue="VIEWER"
            className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
          >
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50 shrink-0"
        >
          <UserPlus className="h-4 w-4" /> {pending ? 'Convidando…' : 'Convidar'}
        </button>
      </form>

      {state.message && (
        <p className={`text-sm font-semibold ${state.ok ? 'text-hexxa-forest dark:text-hexxa-lime' : 'text-rose-600 dark:text-rose-400'}`}>
          {state.message}
        </p>
      )}

      {members.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-10 text-center text-sm text-ink-soft dark:border-white/10">Ninguém com acesso ainda.</p>
      ) : (
        <ul className="divide-y divide-black/[0.08] overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/[0.12] dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
          {members.map((m) => (
            <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-soft">{m.email} · {ROLE_LABEL[m.role] ?? m.role}</p>
              </div>
              {m.role !== 'OWNER' &&
                (confirmar === m.membershipId ? (
                  <span className="flex items-center gap-3 text-xs font-semibold">
                    <span className="font-normal text-ink-soft">Tirar o acesso?</span>
                    <button type="button" disabled={removing} onClick={() => startRemoving(() => removeMemberAction(m.membershipId))} className="text-rose-600 disabled:opacity-50 dark:text-rose-400">
                      Sim, tirar
                    </button>
                    <button type="button" onClick={() => setConfirmar(null)} className="text-ink-soft hover:text-ink">Não</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmar(m.membershipId)} className="text-xs font-semibold text-ink-soft hover:text-rose-600">
                    Tirar acesso
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
