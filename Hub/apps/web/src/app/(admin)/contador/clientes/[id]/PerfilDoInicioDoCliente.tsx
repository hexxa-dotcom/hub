'use client';

import { useState, useTransition } from 'react';
import { alterarPerfilDoInicioAction } from '../actions';

const PERFIS = [
  { id: 'BASICO', rotulo: 'Básico' },
  { id: 'PERSONALIZADO', rotulo: 'Personalizado' },
  { id: 'COMPLETO', rotulo: 'Completo' },
] as const;

/** Quanto a Início do cliente mostra — o contador define para quem é mais leigo. */
export function PerfilDoInicioDoCliente({ companyId, perfil }: { companyId: string; perfil: string }) {
  const [atual, setAtual] = useState(perfil);
  const [, iniciar] = useTransition();
  return (
    <div className="mt-0.5 inline-flex gap-1 rounded-full bg-black/5 p-0.5 dark:bg-white/10">
      {PERFIS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={atual === p.id}
          onClick={() =>
            iniciar(async () => {
              setAtual(p.id);
              await alterarPerfilDoInicioAction(companyId, p.id);
            })
          }
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            atual === p.id ? 'bg-white text-[#231F20] shadow-sm dark:bg-white/20 dark:text-[#F5F6F4]' : 'text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C]'
          }`}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  );
}
