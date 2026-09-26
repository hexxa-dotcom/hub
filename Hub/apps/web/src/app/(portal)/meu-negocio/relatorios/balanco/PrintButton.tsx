'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ scope, label }: { scope: 'balanco' | 'dre'; label: string }) {
  function handlePrint() {
    const cls = `print-scope-${scope}`;
    document.documentElement.classList.add(cls);
    const cleanup = () => {
      document.documentElement.classList.remove(cls);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="hidden items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink sm:inline-flex print:hidden"
    >
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
