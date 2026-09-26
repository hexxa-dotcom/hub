'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Aviso curto no rodapé da tela, que some sozinho — no lugar do alert() do
 * navegador, que trava a página e foge do visual do sistema.
 */
export function useAviso() {
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((texto: string, ok = true) => {
    if (timer.current) clearTimeout(timer.current);
    setAviso({ texto, ok });
    timer.current = setTimeout(() => setAviso(null), 4000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const elemento = aviso ? (
    <div role="status" className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 px-4">
      <p
        className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-(--elev-3) ${
          aviso.ok ? 'bg-hexxa-forest text-hexxa-lime' : 'bg-rose-600 text-white'
        }`}
      >
        {aviso.texto}
      </p>
    </div>
  ) : null;

  return { avisar, elemento };
}
