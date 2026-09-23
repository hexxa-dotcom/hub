'use client';

import { useActionState, useTransition, useState, useEffect } from 'react';
import { UserPlus, Trash2, Clock } from 'lucide-react';
import { inviteMemberAction, removeMemberAction, type EquipeState } from './actions';
import { isMemberTimeTrackerEnabled, setMemberTimeTrackerEnabled } from '@/lib/client/useTimeTracker';

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
  const [trackerMap, setTrackerMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const map: Record<string, boolean> = {};
    members.forEach((m) => {
      map[m.email] = isMemberTimeTrackerEnabled(m.email);
    });
    setTrackerMap(map);
  }, [members]);

  const handleToggleMemberTracker = (email: string) => {
    const current = trackerMap[email] !== false;
    const next = !current;
    setMemberTimeTrackerEnabled(email, next);
    setTrackerMap((prev) => ({ ...prev, [email]: next }));
  };

  return (
    <div className="space-y-6">
      <form action={formAction} className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="mb-1.5 block text-xs font-bold text-ink-soft uppercase tracking-wide">E-mail do convidado</label>
          <input
            type="email"
            name="email"
            required
            placeholder="pessoa@empresa.com.br"
            className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="mb-1.5 block text-xs font-bold text-ink-soft uppercase tracking-wide">Papel</label>
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

      <div className="rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden shadow-(--elev-inset)">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5 text-xs text-ink-soft">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Nome</th>
              <th className="text-left font-semibold px-4 py-3">E-mail</th>
              <th className="text-left font-semibold px-4 py-3">Papel</th>
              <th className="text-left font-semibold px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-ink-soft" /> Time Tracker
                </span>
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-surface-card">
            {members.map((m) => {
              const isEnabled = trackerMap[m.email] !== false;
              return (
                <tr key={m.membershipId} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-ink font-semibold">{m.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-black/5 dark:bg-white/10 text-ink">
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleMemberTracker(m.email)}
                      title={isEnabled ? 'Clique para desabilitar Time Tracker' : 'Clique para habilitar Time Tracker'}
                      className={`tap-target pressable inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                        isEnabled
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/15'
                          : 'bg-black/5 dark:bg-white/10 text-ink-soft border border-black/10 dark:border-white/10 hover:text-ink'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      <span>{isEnabled ? 'Habilitado' : 'Desabilitado'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.role !== 'OWNER' && (
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() => startRemoving(() => removeMemberAction(m.membershipId))}
                        className="p-1.5 rounded-lg text-ink-soft hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                        title="Remover acesso"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-ink-soft">
                  Nenhum membro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
