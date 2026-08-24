'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';

export function IntegrationStatusBlock({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function disconnect() {
    setLoading(true);
    try {
      await fetch(`/api/integrations/${providerId}/disconnect`, { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-3.5 mt-auto space-y-2">
      <div className="flex items-center gap-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>Credenciais salvas e autenticadas.</span>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={disconnect}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-400 hover:underline disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Desconectar
        </button>
      </div>
    </div>
  );
}

