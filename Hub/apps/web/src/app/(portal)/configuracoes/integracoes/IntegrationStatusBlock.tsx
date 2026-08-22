'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Spinner } from '@phosphor-icons/react';

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
    <div className="rounded-xl bg-surface-card border border-line dark:bg-white/5 p-3.5 mt-auto space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
        <ShieldCheck className="h-3.5 w-3.5 text-ok" />
        Credenciais salvas com segurança. Importação automática de dados ainda não está disponível.
      </div>
      <button
        type="button"
        onClick={disconnect}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-critical hover:underline disabled:opacity-50"
      >
        {loading && <Spinner className="h-3 w-3 animate-spin" />}
        Desconectar
      </button>
    </div>
  );
}
