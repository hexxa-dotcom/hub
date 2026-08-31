'use client';

import { useActionState, useTransition } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <form action={formAction} className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="mb-1.5 block text-xs font-medium text-[#6E6A61] dark:text-[#A8A49C]">E-mail do convidado</label>
          <input
            type="email"
            name="email"
            required
            placeholder="pessoa@empresa.com.br"
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#1E3328] dark:focus:border-[#DFFFAE]"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="mb-1.5 block text-xs font-medium text-[#6E6A61] dark:text-[#A8A49C]">Papel</label>
          <select
            name="role"
            defaultValue="VIEWER"
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#1E3328] dark:focus:border-[#DFFFAE]"
          >
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all disabled:opacity-50 shrink-0"
        >
          <UserPlus className="h-4 w-4" /> {pending ? 'Convidando…' : 'Convidar'}
        </button>
      </form>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-[#2F4A3C] dark:text-[#DFFFAE]' : 'text-red-600 dark:text-red-400'}`}>
          {state.message}
        </p>
      )}

      <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Nome</th>
              <th className="text-left font-medium px-4 py-2.5">E-mail</th>
              <th className="text-left font-medium px-4 py-2.5">Papel</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId} className="border-t border-black/5 dark:border-white/5">
                <td className="px-4 py-2.5 text-[#231F20] dark:text-[#FEFDF3] font-medium">{m.name}</td>
                <td className="px-4 py-2.5 text-[#6E6A61] dark:text-[#A8A49C]">{m.email}</td>
                <td className="px-4 py-2.5 text-[#231F20] dark:text-[#FEFDF3]">{ROLE_LABEL[m.role] ?? m.role}</td>
                <td className="px-4 py-2.5 text-right">
                  {m.role !== 'OWNER' && (
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => startRemoving(() => removeMemberAction(m.membershipId))}
                      className="text-[#6E6A61] hover:text-red-600 dark:text-[#A8A49C] dark:hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remover acesso"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">
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
