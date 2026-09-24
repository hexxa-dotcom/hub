'use client';

import { useEffect } from 'react';
import { Download, X } from 'lucide-react';

/** O contrato aberto dentro da Hexx, quase em tela cheia — ler sem baixar. */
export function VerContrato({ id, titulo, onClose }: { id: string; titulo: string; onClose: () => void }) {
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-surface shadow-(--elev-3) dark:border-white/10"
      >
        <div className="flex items-center justify-between gap-4 border-b border-black/5 px-6 py-3.5 dark:border-white/10">
          <p className="min-w-0 truncate text-sm font-light uppercase tracking-[0.06em] text-ink">{titulo}</p>
          <div className="flex shrink-0 items-center gap-4">
            <a href={`/api/contratos/${id}/pdf?modo=baixar`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
              <Download className="h-3.5 w-3.5" /> Baixar
            </a>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe title="Contrato" src={`/api/contratos/${id}/pdf#navpanes=0&view=FitH`} className="min-h-0 w-full flex-1 border-0 bg-white" />
      </div>
    </div>
  );
}
