'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { QUICK_ACTIONS_CATALOG, type QuickActionId } from '@/lib/quickActions';
import { QuickNfseForm } from '@/app/(portal)/meu-negocio/notas/QuickNfseForm';
import { QuickDespesaForm } from '@/app/(portal)/meu-negocio/hub-financeiro/QuickDespesaForm';

/**
 * Painel deslizante da direita pras ações rápidas do dashboard (emitir nota,
 * lançar despesa) sem sair da tela atual. Renderizado via portal direto no
 * <body> — os cabeçalhos do AppShell usam `backdrop-blur`, e isso cria uma
 * containing block pra elementos `fixed` (regra do CSS), o que prendia esse
 * painel dentro da barrinha do header em vez de ocupar a tela inteira.
 */
export function QuickActionDrawer({ actionId, onClose }: { actionId: QuickActionId | null; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (actionId) {
      const raf = requestAnimationFrame(() => setShow(true));
      document.body.style.overflow = 'hidden';
      return () => {
        cancelAnimationFrame(raf);
        document.body.style.overflow = '';
      };
    }
    setShow(false);
    document.body.style.overflow = '';
  }, [actionId]);

  useEffect(() => {
    if (!actionId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [actionId, onClose]);

  if (!actionId || !mounted) return null;
  const meta = QUICK_ACTIONS_CATALOG.find((a) => a.id === actionId);

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-[#FEFDF3] shadow-2xl transition-transform duration-300 ease-out dark:bg-[#121614] sm:inset-y-3 sm:right-3 sm:w-[440px] sm:rounded-3xl ${
          show ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/5 px-6 py-5 dark:border-white/10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6E6A61] dark:text-[#A8A49C]">
              Ação Rápida
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-bold leading-tight text-[#231F20] dark:text-[#FEFDF3]">
              {meta?.label}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-xl p-2 text-[#6E6A61] transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {actionId === 'nfse' && <QuickNfseForm onDone={onClose} />}
          {actionId === 'despesa' && <QuickDespesaForm onDone={onClose} />}
        </div>
      </div>
    </div>,
    document.body
  );
}
