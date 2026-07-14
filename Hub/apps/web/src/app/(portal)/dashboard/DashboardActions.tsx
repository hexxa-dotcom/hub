'use client';

import { Plus, Receipt, FileSignature, ChevronDown } from 'lucide-react';
import Link from 'next/link';

export function DashboardActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/meu-negocio/notas" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 hover:scale-105 backdrop-blur-md border border-white/10">
        <Receipt className="h-4 w-4" />
        Nova Nota
      </Link>
      <Link href="/meu-negocio/hub-financeiro" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 hover:scale-105 backdrop-blur-md border border-white/10">
        <Plus className="h-4 w-4" />
        Lançar Despesa
      </Link>
      <Link href="/meu-negocio/contratos" className="hidden sm:flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 hover:scale-105 backdrop-blur-md border border-white/10">
        <FileSignature className="h-4 w-4" />
        Novo Contrato
      </Link>
      <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 transition-all hover:bg-slate-50 hover:scale-105 shadow-sm sm:ml-2">
        Mês Atual <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}
