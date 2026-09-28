'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import type { EnvioIncerto } from '@/lib/server/saude-oneflow';
import { resolverEnvioIncertoAction, tentarDeNovoAction } from './actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const botao =
  'inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[0.06]';

/**
 * Envios incertos: o escritório procura o documento HUB-… no OneFlow e diz
 * se está lá. É a única saída segura — reenviar sozinho poderia duplicar.
 */
export function EnviosIncertos({ itens }: { itens: EnvioIncerto[] }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const decidir = (id: string, decisao: 'ESTA_LA' | 'REENVIAR') =>
    iniciar(async () => {
      setOcupado(id);
      const r = await resolverEnvioIncertoAction(id, decisao);
      setAviso(r.mensagem);
      setOcupado(null);
    });

  return (
    <div>
      <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
        {itens.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block text-sm text-ink">
                {i.empresa} · <span className="font-mono text-xs">{i.documento}</span>
              </span>
              <span className="block text-xs text-ink-soft">
                {i.data} · {BRL.format(i.valor)} · {i.memo}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              <button type="button" disabled={ocupado === i.id} onClick={() => decidir(i.id, 'ESTA_LA')} className={botao}>
                {ocupado === i.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Está no OneFlow
              </button>
              <button type="button" disabled={ocupado === i.id} onClick={() => decidir(i.id, 'REENVIAR')} className={botao}>
                Não está — reenviar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {aviso && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{aviso}</p>}
    </div>
  );
}

/** Empresas com envio parado por recusa repetida: "Tentar de novo" depois de corrigir a causa. */
export function EnviosEsgotados({ itens }: { itens: { companyId: string; empresa: string; partidas: number }[] }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  return (
    <div className="mt-4 space-y-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
      <p className="text-xs text-ink-soft">Paradas depois de 3 recusas — corrigida a causa, tente de novo:</p>
      {itens.map((e) => (
        <div key={e.companyId} className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink">
            {e.empresa} <span className="text-xs text-ink-soft">· {e.partidas} lançamentos</span>
          </span>
          <button
            type="button"
            disabled={ocupado === e.companyId}
            onClick={() =>
              iniciar(async () => {
                setOcupado(e.companyId);
                const r = await tentarDeNovoAction(e.companyId);
                setAviso(r.mensagem);
                setOcupado(null);
              })
            }
            className={botao}
          >
            {ocupado === e.companyId && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Tentar de novo
          </button>
        </div>
      ))}
      {aviso && <p className="text-xs text-emerald-700 dark:text-emerald-400">{aviso}</p>}
    </div>
  );
}
