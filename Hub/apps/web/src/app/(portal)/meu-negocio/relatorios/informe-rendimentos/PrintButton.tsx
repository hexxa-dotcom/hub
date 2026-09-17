'use client';

import { Printer } from 'lucide-react';

/** Imprime o informe. O sócio costuma querer o papel para juntar ao IRPF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="tap-target pressable focusable inline-flex items-center gap-2 rounded-full bg-hexxa-green-dark px-4 py-2 text-footnote font-semibold text-hexxa-cream transition-colors hover:bg-hexxa-green"
    >
      <Printer className="h-3.5 w-3.5" />
      Imprimir
    </button>
  );
}
