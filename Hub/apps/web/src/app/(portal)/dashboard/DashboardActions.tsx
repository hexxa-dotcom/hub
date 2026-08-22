'use client';

import { Plus, Receipt, Signature } from '@phosphor-icons/react';
import Link from 'next/link';

export function DashboardActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/meu-negocio/notas" className="btn-primary px-4 py-2.5 text-sm hover:scale-105 transition-transform">
        <Receipt className="h-4 w-4" />
        Nova Nota
      </Link>
      <Link href="/meu-negocio/hub-financeiro" className="btn-primary px-4 py-2.5 text-sm hover:scale-105 transition-transform">
        <Plus className="h-4 w-4" />
        Lançar Despesa
      </Link>
      <Link href="/meu-negocio/contratos" className="btn-primary hidden sm:inline-flex px-4 py-2.5 text-sm hover:scale-105 transition-transform">
        <Signature className="h-4 w-4" />
        Novo Contrato
      </Link>
    </div>
  );
}
