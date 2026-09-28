'use client';

import { useActionState, useState } from 'react';
import { Pencil } from 'lucide-react';
import { alterarNumeroDaEmpresaAction } from '../actions';

/** O número da empresa no escritório (001–999), com troca ali mesmo. */
export function NumeroDaEmpresa({ companyId, numero }: { companyId: string; numero: number | null }) {
  const [editando, setEditando] = useState(false);
  const [estado, salvar, salvando] = useActionState(alterarNumeroDaEmpresaAction.bind(null, companyId), { ok: false, mensagem: '' });
  const atual = numero != null ? String(numero).padStart(3, '0') : '—';
  if (!editando || (estado.ok && !salvando)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono">{estado.ok ? estado.mensagem.match(/\d{3}/)?.[0] ?? atual : atual}</span>
        <button type="button" onClick={() => setEditando(true)} title="Trocar o número" className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/10">
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }
  return (
    <form action={salvar} className="flex flex-wrap items-center gap-2">
      <input name="numero" defaultValue={numero != null ? String(numero).padStart(3, '0') : ''} inputMode="numeric" maxLength={3} autoFocus className="w-16 rounded-lg border border-black/15 bg-white/70 px-2 py-1 font-mono text-sm dark:border-white/20 dark:bg-white/5" />
      <button type="submit" disabled={salvando} className="rounded-full bg-[#1E3328] px-3 py-1 text-[11px] font-bold text-[#DFFFAE]">
        Salvar
      </button>
      <button type="button" onClick={() => setEditando(false)} className="text-[11px] font-bold text-[#6E6A61]">
        Cancelar
      </button>
      {estado.mensagem && !estado.ok && <span className="w-full text-[11px] text-red-600">{estado.mensagem}</span>}
    </form>
  );
}
