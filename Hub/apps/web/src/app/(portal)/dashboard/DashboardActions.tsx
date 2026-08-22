'use client';

import { Plus, Receipt, FileSignature, FileText } from 'lucide-react';
import Link from 'next/link';

export function DashboardActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/meu-negocio/notas"
        className="inline-flex items-center gap-2 rounded-full bg-[#DFFFAE] hover:bg-[#c9f58c] text-[#1E3328] px-4 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-105"
      >
        <Receipt className="h-4 w-4" />
        Nova Nota Fiscal
      </Link>
      <Link
        href="/meu-negocio/hub-financeiro"
        className="inline-flex items-center gap-2 rounded-full bg-[#2F4A3C] hover:bg-[#1E3328] text-[#FEFDF3] px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-sm transition-all hover:scale-105"
      >
        <Plus className="h-4 w-4" />
        Lançar Despesa
      </Link>
      <Link
        href="/meu-negocio/contratos"
        className="hidden sm:inline-flex items-center gap-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-[#231F20] dark:text-[#FEFDF3] border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all hover:scale-105"
      >
        <FileSignature className="h-4 w-4" />
        Novo Contrato
      </Link>
      <Link
        href={'/meu-negocio/relatorios/balanco' as any}
        className="hidden sm:inline-flex items-center gap-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-[#231F20] dark:text-[#FEFDF3] border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all hover:scale-105"
      >
        <FileText className="h-4 w-4" />
        Gerar Balanço
      </Link>
    </div>
  );
}
