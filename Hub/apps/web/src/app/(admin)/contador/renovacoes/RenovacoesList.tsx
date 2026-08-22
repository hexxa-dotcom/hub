'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Warning, Clock, CreditCard, EnvelopeSimple, CheckCircle, Spinner } from '@phosphor-icons/react';
import { changeSubscriptionStatusAction } from '../clientes/actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type RiscoItem = {
  id: string;
  companyId: string;
  nome: string;
  email: string;
  plano: string;
  valor: number;
  tipo: 'trial' | 'inadimplente';
  diasRestantes?: number;
  diasAtraso?: number;
  asaasCustomerId?: string;
};

export function RenovacoesList({ initial }: { initial: RiscoItem[] }) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function resolver(item: RiscoItem) {
    setError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const res = await changeSubscriptionStatusAction(item.id, 'ACTIVE');
      setPendingId(null);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setResolved((prev) => new Set(prev).add(item.id));
    });
  }

  const trials = initial.filter((i) => i.tipo === 'trial' && !resolved.has(i.id));
  const inadimplentes = initial.filter((i) => i.tipo === 'inadimplente' && !resolved.has(i.id));
  const resolvidos = initial.filter((i) => resolved.has(i.id));

  function Card({ item }: { item: RiscoItem }) {
    const urgente =
      (item.tipo === 'trial' && (item.diasRestantes ?? 99) <= 2) ||
      (item.tipo === 'inadimplente' && (item.diasAtraso ?? 0) >= 30);
    const busy = pendingId === item.id;

    return (
      <div className={`rounded-2xl border p-5 shadow-sm ${urgente
        ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'
        : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/40 dark:bg-yellow-900/10'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {urgente ? <Warning className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-yellow-500" />}
              <Link href={`/contador/clientes/${item.companyId}`} className="font-semibold text-slate-900 hover:underline dark:text-white">
                {item.nome}
              </Link>
            </div>
            <p className="text-xs text-slate-500">{item.email}</p>
            <p className="text-xs text-slate-500 mt-0.5">Plano {item.plano} · {BRL.format(item.valor)}/mês</p>
          </div>
          <div className="shrink-0 text-right">
            {item.tipo === 'trial' && (
              item.diasRestantes !== undefined ? (
                <span className={`text-sm font-bold ${item.diasRestantes <= 2 ? 'text-red-600' : 'text-yellow-700 dark:text-yellow-400'}`}>
                  {item.diasRestantes} dia{item.diasRestantes !== 1 ? 's' : ''} restante{item.diasRestantes !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Sem data de referência</span>
              )
            )}
            {item.tipo === 'inadimplente' && (
              item.diasAtraso !== undefined ? (
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{item.diasAtraso} dias em atraso</span>
              ) : (
                <span className="text-xs text-slate-400">Sem data de referência</span>
              )
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/contador/clientes/${item.companyId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors">
            <CreditCard className="h-3.5 w-3.5" /> Ver cobrança / Asaas
          </Link>
          {item.email !== '—' && (
            <a href={`mailto:${item.email}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 transition-colors">
              <EnvelopeSimple className="h-3.5 w-3.5" /> {item.tipo === 'trial' ? 'E-mail de conversão' : 'E-mail de cobrança'}
            </a>
          )}
          {item.tipo === 'inadimplente' && (
            <button type="button" onClick={() => resolver(item)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-60 dark:border-green-700 dark:bg-slate-800 dark:text-green-400 transition-colors">
              {busy ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              {busy ? 'Regularizando…' : 'Marcar regularizado'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Renovações em Risco</h1>
        <p className="text-sm text-slate-500">Trials expirando e clientes inadimplentes que precisam de ação</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-400">
          {error}
        </div>
      )}

      {trials.length === 0 && inadimplentes.length === 0 && resolvidos.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
          <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">Nenhuma renovação em risco!</p>
          <p className="text-sm text-slate-400">Todos os clientes estão em dia.</p>
        </div>
      )}

      {trials.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
            <Clock className="h-4 w-4" /> Trials expirando ({trials.length})
          </h2>
          {trials.map((i) => <Card key={i.id} item={i} />)}
        </section>
      )}

      {inadimplentes.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <Warning className="h-4 w-4" /> Inadimplentes ({inadimplentes.length})
          </h2>
          {inadimplentes.map((i) => <Card key={i.id} item={i} />)}
        </section>
      )}

      {resolvidos.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
            <CheckCircle className="h-4 w-4" /> Resolvidos nesta sessão ({resolvidos.length})
          </h2>
          {resolvidos.map((i) => (
            <div key={i.id} className="rounded-2xl border border-green-200 bg-green-50 p-4 opacity-60 dark:border-green-900/30 dark:bg-green-900/10">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">✓ {i.nome}</p>
              <p className="text-xs text-green-600 dark:text-green-500">Regularizado</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
