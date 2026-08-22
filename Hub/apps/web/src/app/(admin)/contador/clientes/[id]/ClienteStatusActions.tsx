'use client';

import { useState, useTransition } from 'react';
import { ArrowsClockwise, CheckCircle } from '@phosphor-icons/react';
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
          className="flex w-full items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60 dark:bg-green-900/20 dark:text-green-400 transition-colors">
          <ArrowsClockwise className="h-4 w-4" /> {pending ? 'Regularizando…' : 'Regularizar conta'}
        </button>
      ) : (
        <button onClick={ativar} disabled={pending}
          className="flex w-full items-center gap-2 rounded-xl bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-500/20 disabled:opacity-60 dark:text-brand-400 transition-colors">
          <CheckCircle className="h-4 w-4" /> {pending ? 'Ativando…' : 'Ativar conta'}
        </button>
      )}
      {error && <p className="px-1 text-[11px] text-red-600">{error}</p>}
    </>
  );
}
