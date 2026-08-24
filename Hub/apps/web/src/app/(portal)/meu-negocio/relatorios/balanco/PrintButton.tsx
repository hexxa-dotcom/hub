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
      className="hidden sm:flex items-center gap-2 bg-white/10 hover:bg-white/20 text-[#DFFFAE] border border-white/20 px-4 py-2 rounded-full backdrop-blur-sm print:hidden text-xs font-bold transition-all"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
