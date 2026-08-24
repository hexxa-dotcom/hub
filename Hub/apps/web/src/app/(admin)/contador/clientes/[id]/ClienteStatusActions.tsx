'use client';

import { useState, useTransition } from 'react';
import { RotateCw, CheckCircle2 } from 'lucide-react';
import { changeSubscriptionStatusAction } from '../actions';

export function ClienteStatusActions({ subscriptionId, status }: { subscriptionId: string; status: 'PAST_DUE' | 'TRIAL' }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ativar() {
    setError(null);
    startTransition(async () => {
      const res = await changeSubscriptionStatusAction(subscriptionId, 'ACTIVE');
      if (res?.error) setError(res.error);
    });
  }

  return (
    <>
      {status === 'PAST_DUE' ? (
        <button onClick={ativar} disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400 transition-all shadow-xs">
          <RotateCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} /> {pending ? 'Regularizando…' : 'Regularizar conta'}
        </button>
      ) : (
        <button onClick={ativar} disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] disabled:opacity-60 transition-all shadow-xs">
          <CheckCircle2 className="h-3.5 w-3.5" /> {pending ? 'Ativando…' : 'Ativar conta'}
        </button>
      )}
      {error && <p className="px-1 text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}

