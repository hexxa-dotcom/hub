'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, ChevronDown, ChevronUp, Mail,
  CreditCard, Edit2, AlertCircle, CheckCircle2, Clock,
  ExternalLink, FileText, RefreshCw,
} from 'lucide-react';
import { AsaasModal } from '@/components/admin/AsaasModal';
import { ManualAuthorization } from './ManualAuthorization';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Status = 'ativo' | 'trial' | 'inadimplente' | 'inativo';
type Plano = 'Início' | 'Crescimento' | 'Escala';

type Cliente = {
  id: string;
  razao: string;
  fantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  plano: Plano;
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

const SEED: Cliente[] = [
  { id: '1', razao: 'Hexxa Demo Serviços LTDA', fantasia: 'Hexxa Demo', cnpj: '00.000.000/0001-00', email: 'demo@hexxa.com.br', telefone: '(47) 99999-0000', plano: 'Início', status: 'ativo', mrr: 149.90, desde: '2024-01-15', responsavel: 'Carlos Mendes', regime: 'Simples Nacional', municipio: 'Joinville/SC', pendencias: 0 },
  { id: '2', razao: 'Tech Soluções ME', fantasia: 'TechSol', cnpj: '11.111.111/0001-11', email: 'contato@techsol.com.br', telefone: '(48) 98888-1111', plano: 'Crescimento', status: 'ativo', mrr: 299.90, desde: '2024-03-01', responsavel: 'Ana Beatriz Lima', regime: 'Lucro Presumido', municipio: 'Florianópolis/SC', pendencias: 1 },
  { id: '3', razao: 'Consultoria Silva & Cia', fantasia: 'Silva Consultoria', cnpj: '22.222.222/0001-22', email: 'silva@silvaconsult.com.br', telefone: '(51) 97777-2222', plano: 'Início', status: 'ativo', mrr: 149.90, desde: '2024-06-10', responsavel: 'Roberto Silva', regime: 'Simples Nacional', municipio: 'Porto Alegre/RS', pendencias: 0 },
  { id: '4', razao: 'Studio Criativo LTDA', fantasia: 'Studio Criativo', cnpj: '33.333.333/0001-33', email: 'hello@studiocriativo.com', telefone: '(11) 96666-3333', plano: 'Crescimento', status: 'trial', mrr: 0, desde: '2026-06-01', responsavel: 'Julia Castro', regime: 'MEI', municipio: 'São Paulo/SP', pendencias: 0 },
  { id: '5', razao: 'Advocacia Mendes Associados', fantasia: 'Mendes Adv', cnpj: '44.444.444/0001-44', email: 'adv@mendesassociados.com.br', telefone: '(41) 95555-4444', plano: 'Início', status: 'inadimplente', mrr: 149.90, desde: '2023-11-20', responsavel: 'Diego Mendes', regime: 'Simples Nacional', municipio: 'Curitiba/PR', pendencias: 2 },
  { id: '6', razao: 'DEF Comércio e Serviços ME', fantasia: 'DEF Serviços', cnpj: '55.555.555/0001-55', email: 'def@defservicos.com.br', telefone: '(62) 94444-5555', plano: 'Início', status: 'ativo', mrr: 149.90, desde: '2025-02-14', responsavel: 'Fernanda Oliveira', regime: 'MEI', municipio: 'Goiânia/GO', pendencias: 0 },
];

const STATUS_CFG: Record<Status, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ativo: { label: 'Ativo', cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  trial: { label: 'Trial', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  inadimplente: { label: 'Inadimplente', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  inativo: { label: 'Inativo', cls: 'bg-slate-100 text-slate-500', icon: AlertCircle },
};

const PLANO_CLS: Record<Plano, string> = {
  'Início': 'bg-brand-500/10 text-brand-700 dark:text-brand-400',
  'Crescimento': 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Escala': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function AdminClientes() {
  const [clientes, setClientes] = useState(SEED);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'todos'>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editPlano, setEditPlano] = useState<{ id: string; plano: Plano } | null>(null);
  const [asaasModal, setAsaasModal] = useState<string | null>(null); // id do cliente

  const asaasCliente = asaasModal ? clientes.find(c => c.id === asaasModal) ?? null : null;

  const filtered = clientes.filter(c => {
    const match = [c.razao, c.fantasia, c.cnpj, c.email, c.responsavel].some(v => v.toLowerCase().includes(search.toLowerCase()));
    const statusOk = filterStatus === 'todos' || c.status === filterStatus;
    return match && statusOk;
  });

  function aplicarPlano(id: string, plano: Plano) {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, plano, mrr: plano === 'Início' ? 149.9 : plano === 'Crescimento' ? 299.9 : 499.9 } : c));
    setEditPlano(null);
  }

  function alterarStatus(id: string, status: Status) {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, status } : c));
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
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…" className="w-48 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200" />
        </div>
        {(['todos', 'ativo', 'trial', 'inadimplente', 'inativo'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
            }`}>
            {s === 'todos' ? `Todos (${clientes.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${clientes.filter(c => c.status === s).length})`}
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
                {/* Avatar */}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {c.fantasia.slice(0, 2).toUpperCase()}
                </span>
                {/* Info */}
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
                {/* Plano */}
                <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${PLANO_CLS[c.plano]}`}>{c.plano}</span>
                {/* MRR */}
                <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-300 lg:block w-24 text-right">{c.mrr > 0 ? BRL.format(c.mrr) : '—'}</span>
                {/* Status */}
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
                  <StatusIcon className="h-3 w-3" />{st.label}
                </span>
                {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>

              {/* Detail panel */}
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

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/admin/clientes/${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver detalhe
                    </Link>

                    {/* Alterar plano */}
                    {editPlano?.id === c.id ? (
                      <div className="flex items-center gap-1.5">
                        {(['Início', 'Crescimento', 'Escala'] as Plano[]).map(p => (
                          <button key={p} onClick={() => aplicarPlano(c.id, p)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${c.plano === p ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400'}`}>
                            {p}
                          </button>
                        ))}
                        <button onClick={() => setEditPlano(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditPlano({ id: c.id, plano: c.plano })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        <CreditCard className="h-3.5 w-3.5" /> Alterar plano
                      </button>
                    )}

                    {c.status === 'inadimplente' && (
                      <button onClick={() => alterarStatus(c.id, 'ativo')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                        <RefreshCw className="h-3.5 w-3.5" /> Regularizar
                      </button>
                    )}
                    {c.status === 'trial' && (
                      <button onClick={() => alterarStatus(c.id, 'ativo')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ativar conta
                      </button>
                    )}
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      <Mail className="h-3.5 w-3.5" /> Enviar e-mail
                    </button>
                    <Link href="/admin/notas"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      <FileText className="h-3.5 w-3.5" /> Ver NFs
                    </Link>
                    {/* Asaas */}
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

      {/* Modal Asaas */}
      {asaasCliente && (
        <AsaasModal
          cliente={asaasCliente}
          onClose={() => setAsaasModal(null)}
          onLinked={(customerId, subscriptionId) => {
            setClientes(prev => prev.map(c =>
              c.id === asaasCliente.id
                ? { ...c, asaasCustomerId: customerId, asaasSubscriptionId: subscriptionId, status: 'ativo' }
                : c,
            ));
          }}
          onCanceled={() => {
            setClientes(prev => prev.map(c =>
              c.id === asaasCliente.id
                ? { ...c, asaasCustomerId: undefined, asaasSubscriptionId: undefined, status: 'inativo' }
                : c,
            ));
            setAsaasModal(null);
          }}
        />
      )}
    </div>
  );
}
