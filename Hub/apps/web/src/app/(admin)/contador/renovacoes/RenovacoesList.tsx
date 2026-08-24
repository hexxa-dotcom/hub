'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, CreditCard, Mail, CheckCircle2, Loader2 } from 'lucide-react';
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
      <div className={`rounded-3xl border p-6 shadow-sm ${urgente
        ? 'border-red-500/20 bg-red-500/10'
        : 'border-amber-500/20 bg-amber-500/10'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {urgente ? <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" /> : <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              <Link href={`/contador/clientes/${item.companyId}`} className="font-serif font-bold text-base text-[#231F20] hover:underline dark:text-[#FEFDF3]">
                {item.nome}
              </Link>
            </div>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{item.email}</p>
            <p className="text-xs font-medium text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Plano {item.plano} · {BRL.format(item.valor)}/mês</p>
          </div>
          <div className="shrink-0 text-right">
            {item.tipo === 'trial' && (
              item.diasRestantes !== undefined ? (
                <span className={`text-xs sm:text-sm font-bold ${item.diasRestantes <= 2 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {item.diasRestantes} dia{item.diasRestantes !== 1 ? 's' : ''} restante{item.diasRestantes !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sem data de referência</span>
              )
            )}
            {item.tipo === 'inadimplente' && (
              item.diasAtraso !== undefined ? (
                <span className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400">{item.diasAtraso} dias em atraso</span>
              ) : (
                <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sem data de referência</span>
              )
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/contador/clientes/${item.companyId}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] transition-all shadow-xs">
            <CreditCard className="h-3.5 w-3.5" /> Ver cobrança / Asaas
          </Link>
          {item.email !== '—' && (
            <a href={`mailto:${item.email}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors">
              <Mail className="h-3.5 w-3.5" /> {item.tipo === 'trial' ? 'E-mail de conversão' : 'E-mail de cobrança'}
            </a>
          )}
          {item.tipo === 'inadimplente' && (
            <button type="button" onClick={() => resolver(item)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400 transition-colors">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {busy ? 'Regularizando…' : 'Marcar regularizado'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Renovações em Risco</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Trials expirando e clientes inadimplentes que precisam de ação</p>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-xs font-bold text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {trials.length === 0 && inadimplentes.length === 0 && resolvidos.length === 0 && (
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-12 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-3 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nenhuma renovação em risco!</p>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Todos os clientes estão em dia.</p>
        </div>
      )}

      {trials.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-serif font-bold text-sm text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" /> Trials expirando ({trials.length})
          </h2>
          {trials.map((i) => <Card key={i.id} item={i} />)}
        </section>
      )}

      {inadimplentes.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-serif font-bold text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> Inadimplentes ({inadimplentes.length})
          </h2>
          {inadimplentes.map((i) => <Card key={i.id} item={i} />)}
        </section>
      )}

      {resolvidos.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-serif font-bold text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Resolvidos nesta sessão ({resolvidos.length})
          </h2>
          {resolvidos.map((i) => (
            <div key={i.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 opacity-60">
              <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">✓ {i.nome}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Regularizado</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

