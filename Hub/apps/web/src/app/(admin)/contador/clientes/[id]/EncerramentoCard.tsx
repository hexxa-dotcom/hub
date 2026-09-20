'use client';

import { useState, useTransition } from 'react';
import { Loader2, Power } from 'lucide-react';
import { encerrarCliente, reativarCliente } from './encerramento-actions';

/**
 * Encerrar o cliente — com motivo, e sem apagar nada.
 *
 * O botão pede confirmação num segundo passo porque encerrar para a operação
 * inteira da empresa de uma vez; reverter é possível, mas o que deixou de
 * rodar enquanto isso (um fechamento, um envio) não roda retroativamente.
 */
export function EncerramentoCard({
  companyId,
  encerradaEm,
  motivo,
}: {
  companyId: string;
  encerradaEm: string | null;
  motivo: string | null;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (encerradaEm) {
    return (
      <div className="rounded-3xl border border-black/10 bg-black/[0.03] p-6 dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Cliente encerrado em {encerradaEm}</p>
        {motivo && <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{motivo}</p>}
        <p className="mt-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Nenhuma rotina automática opera sobre esta empresa. Os dados continuam aqui.
        </p>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => iniciar(async () => setMsg((await reativarCliente(companyId)).mensagem))}
          className="mt-3 rounded-full border border-black/10 px-4 py-1.5 text-xs font-bold text-[#231F20] disabled:opacity-40 dark:border-white/15 dark:text-[#F5F6F4]"
        >
          Reativar cliente
        </button>
        {msg && <p className="mt-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/5 p-6 dark:border-white/10">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6A61] hover:text-rose-700 dark:text-[#A8A49C] dark:hover:text-rose-400"
        >
          <Power className="h-3.5 w-3.5" /> Encerrar cliente
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-[#231F20] dark:text-[#F5F6F4]">
            Para fechamento, envio ao OneFlow, despesas fixas, cobrança de contratos, Nibo e
            honorários desta empresa. Os dados ficam guardados.
          </p>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="motivo — ex.: deixou de ser cliente"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmando(false)}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Cancelar</button>
            <button
              type="button"
              disabled={ocupado || texto.trim().length < 3}
              onClick={() => iniciar(async () => {
                const r = await encerrarCliente(companyId, texto);
                setMsg(r.mensagem);
                if (r.ok) setConfirmando(false);
              })}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            >
              {ocupado && <Loader2 className="h-3 w-3 animate-spin" />} Encerrar
            </button>
          </div>
          {msg && <p className="text-xs text-rose-700 dark:text-rose-400">{msg}</p>}
        </div>
      )}
    </div>
  );
}
