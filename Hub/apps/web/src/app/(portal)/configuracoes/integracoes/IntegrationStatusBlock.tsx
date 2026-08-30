'use client';

import Link from 'next/link';
import { ShieldCheck, Settings } from 'lucide-react';
import type { Route } from 'next';

export function IntegrationStatusBlock({ providerId }: { providerId: string }) {
  return (
    <div className="rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-3.5 mt-auto space-y-2">
      <div className="flex items-center gap-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>Credenciais salvas e autenticadas.</span>
      </div>
      <div className="flex justify-end pt-1">
        <Link
          href={`/configuracoes/integracoes/${providerId}` as Route}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] hover:underline"
        >
          <Settings className="h-3.5 w-3.5" />
          Gerenciar Conexão
        </Link>
      </div>
    </div>
  );
}

