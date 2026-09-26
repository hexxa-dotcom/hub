'use client';

import { Printer } from 'lucide-react';

/** Imprime o informe. O sócio costuma querer o papel para juntar ao IRPF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
    >
      <Printer className="h-3.5 w-3.5" />
      Imprimir
    </button>
  );
}
