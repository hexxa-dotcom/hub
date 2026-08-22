'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Mail,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
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

const STATUS_CFG: Record<Status, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  ACTIVE: { label: 'Ativo', cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#1E3328] dark:text-[#DFFFAE] border border-[#DFFFAE]', icon: CheckCircle2 },
  TRIAL: { label: 'Trial', cls: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200', icon: Clock },
  PAST_DUE: { label: 'Inadimplente', cls: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200', icon: AlertTriangle },
  CANCELED: { label: 'Cancelado', cls: 'bg-black/5 text-[#6E6A61]', icon: AlertTriangle },
};

const PLANO_PALETTE = ['bg-[#2F4A3C] text-[#DFFFAE]', 'bg-[#5F6E46] text-[#FEFDF3]', 'bg-[#A2C1CD] text-[#1E3328]'];

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
    <div className="w-full space-y-7 animate-fade-up">
      {/* Header */}
      <div className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Gestão de Empresas
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              Carteira de Clientes
            </h1>
            <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              {clientes.length} empresas cadastradas no ecossistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ManualAuthorization />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] px-4 py-2 shadow-sm focus-within:border-[#2F4A3C]">
          <Search className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por razão, CNPJ..."
            className="w-48 sm:w-64 bg-transparent text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none placeholder:text-[#6E6A61] dark:placeholder:text-[#A8A49C]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(['todos', 'ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                filterStatus === s
                  ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                  : 'border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
              }`}
            >
              {s === 'todos' ? `Todos (${clientes.length})` : `${STATUS_CFG[s].label} (${clientes.filter(c => c.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] shadow-sm">
        {filtered.map(c => {
          const st = STATUS_CFG[c.status];
          const StatusIcon = st.icon;
          const isExp = expanded === c.id;

          return (
            <div key={c.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
              <button
                type="button"
                onClick={() => setExpanded(isExp ? null : c.id)}
                className="flex w-full items-center gap-4 p-5 sm:p-6 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#2F4A3C] text-xs font-bold text-[#DFFFAE] shadow-sm">
                  {c.fantasia.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-bold text-sm sm:text-base text-[#231F20] dark:text-[#FEFDF3]">{c.razao}</p>
                    {c.pendencias > 0 && (
                      <span className="rounded-full bg-red-100 dark:bg-red-950/50 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200">
                        {c.pendencias} pendência{c.pendencias > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.cnpj} · {c.municipio}</p>
                </div>
                <span className={`hidden rounded-full px-3 py-1 text-xs font-bold sm:inline-flex shadow-sm ${PLANO_PALETTE[planos.indexOf(c.plano) % PLANO_PALETTE.length] ?? PLANO_PALETTE[0]}`}>
                  {c.plano}
                </span>
                <span className="hidden text-sm font-serif font-bold text-[#231F20] dark:text-[#FEFDF3] lg:block w-28 text-right tabular">
                  {c.mrr > 0 ? BRL.format(c.mrr) : '—'}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shrink-0 ${st.cls}`}>
                  <StatusIcon className="h-3.5 w-3.5" />{st.label}
                </span>
                {isExp ? <ChevronUp className="h-5 w-5 shrink-0 text-[#6E6A61]" /> : <ChevronDown className="h-5 w-5 shrink-0 text-[#6E6A61]" />}
              </button>

              {isExp && (
                <div className="border-t border-black/5 dark:border-white/10 p-5 sm:p-6 bg-white/50 dark:bg-black/20 space-y-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-xs sm:text-sm">
                    {[
                      ['Responsável', c.responsavel],
                      ['E-mail', c.email],
                      ['Telefone', c.telefone],
                      ['Regime', c.regime],
                      ['Cliente desde', fmtDate(c.desde)],
                      ['MRR', c.mrr > 0 ? BRL.format(c.mrr) : 'Trial / isento'],
                    ].map(([k, v]) => (
                      <div key={k} className="space-y-0.5">
                        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{k}</p>
                        <p className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2.5 pt-2 border-t border-black/5 dark:border-white/5">
                    <Link
                      href={`/contador/clientes/${c.companyId}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Ver Detalhe
                    </Link>

                    {editPlano === c.id ? (
                      <div className="flex items-center gap-2">
                        {planos.map(p => (
                          <button
                            key={p}
                            disabled={busy === c.id}
                            onClick={() => aplicarPlano(c.id, p)}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
                              c.plano === p
                                ? 'bg-[#1E3328] text-[#DFFFAE]'
                                : 'border border-black/10 dark:border-white/10 bg-[#F4EFE4] text-[#6E6A61] hover:bg-black/5'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button onClick={() => setEditPlano(null)} className="text-xs text-[#6E6A61] hover:text-[#231F20] px-2 font-bold">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditPlano(c.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/5"
                      >
                        <CreditCard className="h-3.5 w-3.5" /> Alterar Plano
                      </button>
                    )}

                    {c.status === 'PAST_DUE' && (
                      <button
                        disabled={busy === c.id}
                        onClick={() => alterarStatus(c.id, 'ACTIVE')}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] px-4 py-2 text-xs font-bold text-[#2F4A3C] border border-[#DFFFAE] hover:bg-[#DFFFAE]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Regularizar
                      </button>
                    )}
                    {c.status === 'TRIAL' && (
                      <button
                        disabled={busy === c.id}
                        onClick={() => alterarStatus(c.id, 'ACTIVE')}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] px-4 py-2 text-xs font-bold text-[#2F4A3C] border border-[#DFFFAE] hover:bg-[#DFFFAE]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ativar Conta
                      </button>
                    )}
                    <a
                      href={`mailto:${c.email}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/5"
                    >
                      <Mail className="h-3.5 w-3.5" /> Enviar E-mail
                    </a>
                    <Link
                      href="/contador/notas"
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/5"
                    >
                      <FileText className="h-3.5 w-3.5" /> Ver NFs
                    </Link>
                    <button
                      onClick={() => setAsaasModal(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                        c.asaasSubscriptionId
                          ? 'bg-[#EFFFD6] text-[#2F4A3C] border border-[#DFFFAE]'
                          : 'border border-dashed border-[#2F4A3C] text-[#2F4A3C] dark:text-[#DFFFAE] hover:bg-[#EFFFD6]'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {c.asaasSubscriptionId ? 'Cobrança Asaas ✓' : 'Vincular Cobrança'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Nenhum cliente encontrado.
          </div>
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
