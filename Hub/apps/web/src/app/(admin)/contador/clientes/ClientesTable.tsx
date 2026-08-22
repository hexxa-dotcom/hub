'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlass, CaretDown, CaretUp, EnvelopeSimple, CreditCard, WarningCircle, CheckCircle, Clock, ArrowSquareOut, FileText, ArrowsClockwise } from '@phosphor-icons/react';
import { AsaasModal } from '@/components/contador/AsaasModal';
import { ManualAuthorization } from './ManualAuthorization';
import {
  changeSubscriptionPlanAction,
  changeSubscriptionStatusAction,
  linkAsaasSubscriptionAction,
  unlinkAsaasSubscriptionAction,
} from './actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Status = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED';

export type Cliente = {
  id: string; // subscription.id
  companyId: string;
  razao: string;
  fantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  plano: string;
  status: Status;
  mrr: number;
  desde: string;
  responsavel: string;
  regime: string;
  municipio: string;
  pendencias: number;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
};

const STATUS_CFG: Record<Status, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ACTIVE: { label: 'Ativo', cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  TRIAL: { label: 'Trial', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  PAST_DUE: { label: 'Inadimplente', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: WarningCircle },
  CANCELED: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500', icon: WarningCircle },
};

const PLANO_PALETTE = ['bg-brand-500/10 text-brand-700 dark:text-brand-400', 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'];

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function ClientesTable({ initial, planos }: { initial: Cliente[]; planos: string[] }) {
  const [clientes, setClientes] = useState(initial);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'todos'>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editPlano, setEditPlano] = useState<string | null>(null);
  const [asaasModal, setAsaasModal] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const asaasCliente = asaasModal ? clientes.find(c => c.id === asaasModal) ?? null : null;

  const filtered = clientes.filter(c => {
    const match = [c.razao, c.fantasia, c.cnpj, c.email, c.responsavel].some(v => v.toLowerCase().includes(search.toLowerCase()));
    const statusOk = filterStatus === 'todos' || c.status === filterStatus;
    return match && statusOk;
  });

  async function aplicarPlano(id: string, plano: string) {
    setBusy(id);
    const res = await changeSubscriptionPlanAction(id, plano);
    if (!('error' in res)) {
      setClientes(prev => prev.map(c => c.id === id ? { ...c, plano } : c));
    }
    setEditPlano(null);
    setBusy(null);
  }

  async function alterarStatus(id: string, status: Status) {
    setBusy(id);
    const res = await changeSubscriptionStatusAction(id, status);
    if (!('error' in res)) {
      setClientes(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    }
    setBusy(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Clientes</h1>
          <p className="text-sm text-slate-500">{clientes.length} empresas cadastradas</p>
        </div>
        <div className="flex items-center gap-3">
          <ManualAuthorization />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <MagnifyingGlass className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…" className="w-48 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200" />
        </div>
        {(['todos', 'ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
            }`}>
            {s === 'todos' ? `Todos (${clientes.length})` : `${STATUS_CFG[s].label} (${clientes.filter(c => c.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {filtered.map(c => {
          const st = STATUS_CFG[c.status];
          const StatusIcon = st.icon;
          const isExp = expanded === c.id;

          return (
            <div key={c.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
              <button type="button" onClick={() => setExpanded(isExp ? null : c.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {c.fantasia.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 dark:text-white">{c.razao}</p>
                    {c.pendencias > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        {c.pendencias} pendência{c.pendencias > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{c.cnpj} · {c.municipio}</p>
                </div>
                <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${PLANO_PALETTE[planos.indexOf(c.plano) % PLANO_PALETTE.length] ?? PLANO_PALETTE[0]}`}>{c.plano}</span>
                <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-300 lg:block w-24 text-right">{c.mrr > 0 ? BRL.format(c.mrr) : '—'}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
                  <StatusIcon className="h-3 w-3" />{st.label}
                </span>
                {isExp ? <CaretUp className="h-4 w-4 shrink-0 text-slate-400" /> : <CaretDown className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>

              {isExp && (
                <div className="mx-5 mb-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 text-sm">
                    {[
                      ['Responsável', c.responsavel],
                      ['E-mail', c.email],
                      ['Telefone', c.telefone],
                      ['Regime', c.regime],
                      ['Cliente desde', fmtDate(c.desde)],
                      ['MRR', c.mrr > 0 ? BRL.format(c.mrr) : 'Trial / isento'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-slate-400">{k}</p>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/contador/clientes/${c.companyId}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
                      <ArrowSquareOut className="h-3.5 w-3.5" /> Ver detalhe
                    </Link>

                    {editPlano === c.id ? (
                      <div className="flex items-center gap-1.5">
                        {planos.map(p => (
                          <button key={p} disabled={busy === c.id} onClick={() => aplicarPlano(c.id, p)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${c.plano === p ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400'}`}>
                            {p}
                          </button>
                        ))}
                        <button onClick={() => setEditPlano(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditPlano(c.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        <CreditCard className="h-3.5 w-3.5" /> Alterar plano
                      </button>
                    )}

                    {c.status === 'PAST_DUE' && (
                      <button disabled={busy === c.id} onClick={() => alterarStatus(c.id, 'ACTIVE')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400">
                        <ArrowsClockwise className="h-3.5 w-3.5" /> Regularizar
                      </button>
                    )}
                    {c.status === 'TRIAL' && (
                      <button disabled={busy === c.id} onClick={() => alterarStatus(c.id, 'ACTIVE')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="h-3.5 w-3.5" /> Ativar conta
                      </button>
                    )}
                    <a href={`mailto:${c.email}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      <EnvelopeSimple className="h-3.5 w-3.5" /> Enviar e-mail
                    </a>
                    <Link href="/contador/notas"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      <FileText className="h-3.5 w-3.5" /> Ver NFs
                    </Link>
                    <button
                      onClick={() => setAsaasModal(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                        c.asaasSubscriptionId
                          ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                          : 'border border-dashed border-brand-400 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20'
                      }`}>
                      <CreditCard className="h-3.5 w-3.5" />
                      {c.asaasSubscriptionId ? 'Cobrança Asaas ✓' : 'Vincular cobrança'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-400">Nenhum cliente encontrado.</div>
        )}
      </div>

      {asaasCliente && (
        <AsaasModal
          cliente={asaasCliente}
          onClose={() => setAsaasModal(null)}
          onLinked={async (customerId, subscriptionId) => {
            await linkAsaasSubscriptionAction(asaasCliente.id, customerId, subscriptionId);
            setClientes(prev => prev.map(c =>
              c.id === asaasCliente.id
                ? { ...c, asaasCustomerId: customerId, asaasSubscriptionId: subscriptionId, status: 'ACTIVE' }
                : c,
            ));
          }}
          onCanceled={async () => {
            await unlinkAsaasSubscriptionAction(asaasCliente.id);
            setClientes(prev => prev.map(c =>
              c.id === asaasCliente.id
                ? { ...c, asaasCustomerId: undefined, asaasSubscriptionId: undefined, status: 'CANCELED' }
                : c,
            ));
            setAsaasModal(null);
          }}
        />
      )}
    </div>
  );
}
