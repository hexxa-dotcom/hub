'use client';

import { useState, useTransition } from 'react';
import {
  FileText, AlertTriangle, CheckCircle2, Clock, FlaskConical,
  ShieldCheck, AlertCircle, RefreshCw, Plus, Users, UserX,
  ChevronDown, ChevronUp, Download, XCircle, CalendarClock
} from 'lucide-react';
import { useActionState } from 'react';
import { emitNfseAction, cancelNfseAction, type EmitState } from '../nfse/actions';
import { FiscalForm } from '../fiscal/FiscalForm';
import type { NfseConfig } from '@/lib/server/fiscal';

// ── Types ─────────────────────────────────────────────────────────────────────

type Nota = {
  id: string;
  nfseNumber?: string | null;
  serviceDescription: string;
  referenceMonth: string;
  status: string;
  amount: number;
  providerProtocol?: string | null;
  customer?: { name?: string; document?: string; email?: string } | null;
};

type Customer = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
};

type Props = {
  recent: Nota[];
  customers: Customer[];
  mode: 'gov' | 'mock';
  certOk: boolean;
  fiscalOk: boolean;
  config: NfseConfig | null;
  profiles: any[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const currentMonth = new Date().toISOString().slice(0, 7);
const currentMonthLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho', ISSUING: 'Processando',
  ISSUED: 'Emitida', CANCELED: 'Cancelada', ERROR: 'Falha',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ISSUED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ISSUING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    CANCELED: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-500',
    ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const Icon = status === 'ISSUED' ? CheckCircle2
    : status === 'ERROR' || status === 'CANCELED' ? AlertCircle
    : status === 'ISSUING' ? RefreshCw
    : Clock;
    
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-semibold ${map[status] ?? 'bg-slate-100 text-slate-700'}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'ISSUING' ? 'animate-spin' : ''}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Dashboard (Redesign) ──────────────────────────────────────────────────────

function Dashboard({ recent, customers, mode, certOk, fiscalOk, config, onEmitir, onConfig, onCancel }: Props & { onEmitir: (name?: string, doc?: string) => void; onConfig: () => void; onCancel: (id: string, protocol: string) => void }) {
  const ready = certOk && fiscalOk;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const issuedThisMonth = recent.filter(n => n.status === 'ISSUED' && n.referenceMonth === currentMonth);
  const totalThisMonth = issuedThisMonth.reduce((s, n) => s + n.amount, 0);
  
  const inProgress = recent.filter(n => n.status === 'ISSUING');
  const withError = recent.filter(n => n.status === 'ERROR');

  const issuedDocs = new Set(issuedThisMonth.map(n => n.customer?.document).filter(Boolean));
  const clientesSemNota = customers.filter(c => c.document && !issuedDocs.has(c.document));

  return (
    <div className="space-y-6">
      
      {/* ── Status de Ambiente ── */}
      {!ready && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
          <FlaskConical className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <strong>Modo de teste:</strong> As notas não são enviadas ao governo. Configure o cadastro fiscal e certificado digital.
          </span>
          <button type="button" onClick={onConfig} className="rounded-xl bg-amber-200/50 px-3 py-1.5 text-xs font-semibold hover:bg-amber-200/80 transition-colors">
            Configurar agora →
          </button>
        </div>
      )}

      {/* ── Hero: Faturamento & Emissão ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Faturamento (Liquid Glass) */}
        <div className="md:col-span-2 relative overflow-hidden rounded-3xl card-highlight p-6 sm:p-8 flex flex-col justify-center">
          
          {/* Liquid Glass Orbs */}
          <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-3xl mix-blend-overlay pointer-events-none" />
          <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-brand-900/40 blur-3xl mix-blend-multiply pointer-events-none" />
          
          {/* Reflexo / Borda de Vidro */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-white/20 backdrop-blur-[2px] pointer-events-none border border-white/20 rounded-3xl" />

          <div className="relative z-10">
            <p className="text-white/90 font-medium text-sm sm:text-base mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 opacity-80" /> Faturamento de {currentMonthLabel}
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/80 drop-shadow-sm">
              {fmt(totalThisMonth)}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm font-medium">
              <div className="bg-white/10 border border-white/20 rounded-2xl px-5 py-2.5 backdrop-blur-md shadow-sm">
                <span className="text-brand-100 block text-xs uppercase tracking-wider mb-0.5">Emitidas com sucesso</span>
                <span className="text-xl font-bold">{issuedThisMonth.length} notas</span>
              </div>
              {(inProgress.length > 0 || withError.length > 0) && (
                <div className="bg-amber-400/20 border border-amber-400/30 rounded-2xl px-5 py-2.5 backdrop-blur-md shadow-sm">
                  <span className="text-amber-100 block text-xs uppercase tracking-wider mb-0.5">Pendentes / Erros</span>
                  <span className="text-xl font-bold text-amber-200">{inProgress.length + withError.length} notas</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CTA Emissão (Glass Card) */}
        <div 
          onClick={() => onEmitir()}
          className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/40 dark:border-brand-800/50 dark:bg-brand-900/20 p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/60 dark:hover:bg-brand-900/30 transition-all duration-300 min-h-[200px] shadow-sm backdrop-blur-md"
        >
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-brand-500/30 transition-all duration-300">
            <Plus className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova Nota Fiscal</h3>
          <p className="text-sm text-slate-500 mt-1 font-medium">Avulsa ou para clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ── Coluna Esquerda: Notas Emitidas (Accordion) ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notas Recentes</h3>
            <span className="text-sm text-slate-500">{recent.length} registros</span>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
              <FileText className="h-8 w-8 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm font-medium">Nenhuma nota emitida ainda.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recent.map(n => {
                const isExpanded = expandedId === n.id;
                const isLongKey = n.nfseNumber === n.providerProtocol && n.nfseNumber && n.nfseNumber.length > 20;
                const displayNum = isLongKey ? 'Gerando...' : (n.nfseNumber ?? '—');
                const isCanceled = n.status === 'CANCELED';

                return (
                  <div key={n.id} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    
                    {/* Linha Visível (Header do Card) */}
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : n.id)}
                      className="flex items-center justify-between p-4 cursor-pointer gap-4"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="hidden sm:block shrink-0 w-16 text-center">
                          <p className="text-xs font-mono font-medium text-slate-500 bg-slate-50 dark:bg-slate-800 py-1 rounded-xl">
                            {displayNum}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold truncate ${isCanceled ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {n.customer?.name ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {n.referenceMonth} • {n.serviceDescription}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        <StatusBadge status={n.status} />
                        <div className="text-right w-24">
                          <p className={`font-bold ${isCanceled ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                            {fmt(n.amount)}
                          </p>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Detalhes Expansíveis (Accordion Content) */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          
                          {/* Info */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tomador do Serviço</p>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.customer?.name}</p>
                              {n.customer?.document && <p className="text-xs text-slate-500">{n.customer.document}</p>}
                            </div>
                            
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Descrição</p>
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {n.serviceDescription}
                              </p>
                            </div>
                          </div>

                          {/* Ações e Meta */}
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Chave de Acesso / Protocolo</p>
                              <code className="text-xs font-mono text-slate-600 bg-slate-200/50 dark:bg-slate-800 dark:text-slate-400 px-2 py-1 rounded break-all select-all block">
                                {n.providerProtocol ?? 'Aguardando sincronização...'}
                              </code>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              {n.status === 'ISSUED' && n.providerProtocol && (
                                <>
                                  <a href={`/meu-negocio/notas/${n.id}/danfse`} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
                                    <FileText className="h-3.5 w-3.5" /> PDF (DANFSe)
                                  </a>
                                  <a href={`/api/nfse/${n.id}/xml`} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                                    <Download className="h-3.5 w-3.5" /> Baixar XML
                                  </a>
                                  <button onClick={() => onCancel(n.id, n.providerProtocol!)}
                                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors dark:text-red-400 dark:hover:bg-red-900/20 ml-auto">
                                    <XCircle className="h-3.5 w-3.5" /> Cancelar Nota
                                  </button>
                                </>
                              )}
                              {n.status === 'ERROR' && (
                                <button onClick={() => alert('Verifique o cadastro fiscal e tente emitir novamente.')}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800">
                                  Tentar novamente
                                </button>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Coluna Direita: Insights & Faturamento Pendente ── */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Faturamentos Pendentes</h3>
          
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {clientesSemNota.length > 0 ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {clientesSemNota.length} clientes sem nota
                  </p>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div className="space-y-3">
                  {clientesSemNota.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate text-slate-700 dark:text-slate-300">{c.name}</p>
                      <button onClick={() => onEmitir(c.name, c.document ?? undefined)}
                        className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                        Emitir →
                      </button>
                    </div>
                  ))}
                  {clientesSemNota.length > 5 && (
                    <p className="text-xs text-center text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      + {clientesSemNota.length - 5} outros clientes
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Tudo em dia!</p>
                <p className="text-xs text-slate-500 mt-1">Nenhum cliente cadastrado está pendente neste mês.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Emitir Nota ───────────────────────────────────────────────────────────────

type DestinatarioMode = 'cliente' | 'avulso';

const DEST_TABS: { key: DestinatarioMode; label: string; icon: React.ElementType }[] = [
  { key: 'cliente', label: 'Cliente', icon: Users },
  { key: 'avulso',  label: 'Não cliente', icon: UserX },
];

function EmitirNota({ mode, customers, prefillName, prefillDoc, certOk, fiscalOk, profiles }: {
  mode: 'gov' | 'mock';
  customers: Customer[];
  prefillName?: string;
  prefillDoc?: string;
  certOk: boolean;
  fiscalOk: boolean;
  profiles?: any[];
}) {
  const emitInitial: EmitState = { ok: false, message: '' };
  const [state, action, pending] = useActionState(emitNfseAction, emitInitial);

  const hasPrefill = Boolean(prefillDoc || prefillName);
  const [destMode, setDestMode] = useState<DestinatarioMode>(
    hasPrefill ? 'avulso' : customers.length > 0 ? 'cliente' : 'avulso',
  );
  const [selectedId, setSelectedId] = useState('');
  const [cusName, setCusName] = useState(prefillName ?? '');
  const [cusDoc, setCusDoc] = useState(prefillDoc ?? '');
  const [cusEmail, setCusEmail] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');

  function handleClientSelect(id: string) {
    setSelectedId(id);
    const c = customers.find(c => c.id === id);
    if (c) {
      setCusName(c.name);
      setCusDoc(c.document ?? '');
      setCusEmail(c.email ?? '');
    } else {
      setCusName(''); setCusDoc(''); setCusEmail('');
    }
  }

  function handleModeChange(m: DestinatarioMode) {
    setDestMode(m);
    setSelectedId('');
    setCusName('');
    setCusDoc('');
    setCusEmail('');
  }

  const ready = certOk && fiscalOk;
  const canSubmit = !pending && (destMode !== 'cliente' || Boolean(selectedId));

  const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors dark:border-slate-700 dark:bg-slate-900';
  const lbl = 'text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400';

  return (
    <div className="space-y-4 w-full mx-auto">
      {mode === 'gov' ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800 dark:bg-green-900/20 dark:text-green-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Emitindo no Emissor Nacional — produção
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <FlaskConical className="h-4 w-4 shrink-0" />
          <span>Modo de <strong>teste</strong> — a nota é salva, mas não vai ao governo.</span>
        </div>
      )}

      <form action={action} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-8 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Emitir NFSe</h2>
          <p className="text-sm text-slate-500 mt-1">Preencha os dados do tomador e do serviço</p>
        </div>

        {/* ── Destinatário ── */}
        <div className="space-y-4 bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className={lbl}>Destinatário</p>
            <div className="flex gap-2">
              {DEST_TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleModeChange(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors border ${
                      destMode === t.key
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <input type="hidden" name="customerName" value={cusName} />
          <input type="hidden" name="customerDocument" value={cusDoc} />
          <input type="hidden" name="customerEmail" value={cusEmail} />

          {destMode === 'cliente' && (
            <div>
              <select
                value={selectedId}
                onChange={e => handleClientSelect(e.target.value)}
                className={field}
              >
                <option value="">— Selecione um cliente cadastrado —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedId && (
                <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm space-y-1 dark:border-brand-900/50 dark:bg-brand-900/10">
                  <p className="font-bold text-brand-900 dark:text-brand-100">{cusName}</p>
                  {cusDoc && <p className="text-brand-700 dark:text-brand-400 font-mono text-xs">{cusDoc}</p>}
                  {cusEmail && <p className="text-brand-700 dark:text-brand-400 text-xs">{cusEmail}</p>}
                </div>
              )}
            </div>
          )}

          {destMode !== 'cliente' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={lbl}>Nome / Razão social</label>
                <input value={cusName} onChange={e => setCusName(e.target.value)} placeholder="Nome ou Razão Social" className={field} />
              </div>
              <div>
                <label className={lbl}>CPF / CNPJ</label>
                <input value={cusDoc} onChange={e => setCusDoc(e.target.value)} placeholder="00.000.000/0001-00" className={field} />
              </div>
              <div>
                <label className={lbl}>E-mail (opcional)</label>
                <input type="email" value={cusEmail} onChange={e => setCusEmail(e.target.value)} placeholder="email@cliente.com" className={field} />
              </div>
            </div>
          )}
        </div>

        {/* ── Perfil Fiscal de Serviço ── */}
        {profiles && profiles.length > 0 && (
          <div>
            <label className={lbl}>Perfil Fiscal de Serviço</label>
            <select 
              name="profileId" 
              className={field} 
              required={profiles.length > 1}
              onChange={(e) => {
                const profile = profiles.find(p => p.id === e.target.value);
                if (profile?.defaultDescription) {
                  setServiceDesc(profile.defaultDescription);
                }
              }}
            >
              <option value="">Selecione um Perfil Fiscal</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.nome} (Item LC116: {p.itemListaServico})</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Retenção e Endereço do Tomador ── */}
        <div className="rounded-2xl border border-slate-100 p-5 space-y-4 dark:border-slate-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="retainIss" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              O ISSQN será retido na fonte pelo tomador
            </span>
          </label>
          <div className="pl-7 space-y-4">
            <p className="text-xs text-slate-500">
              Se marcado, preencha obrigatoriamente o endereço do tomador abaixo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={lbl}>CEP</label><input name="cep" placeholder="00000-000" className={field} /></div>
              <div><label className={lbl}>Cód. IBGE Município</label><input name="cMun" placeholder="Ex: 4211306" className={field} /></div>
              <div className="md:col-span-2"><label className={lbl}>Logradouro</label><input name="logradouro" placeholder="Rua / Avenida" className={field} /></div>
              <div><label className={lbl}>Número</label><input name="numero" placeholder="123" className={field} /></div>
              <div><label className={lbl}>Complemento</label><input name="complemento" placeholder="Sala 03" className={field} /></div>
              <div className="md:col-span-2"><label className={lbl}>Bairro</label><input name="bairro" placeholder="Centro" className={field} /></div>
            </div>
          </div>
        </div>

        {/* ── Serviço ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className={lbl}>Valor Total (R$)</label>
            <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0,00" className={`${field} text-lg font-semibold text-brand-700`} />
          </div>
          <div>
            <label className={lbl}>Competência</label>
            <input name="competenciaDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Descrição Completa do Serviço</label>
            <textarea 
              name="serviceDescription" 
              required 
              rows={4} 
              placeholder="Ex.: Consultoria contábil prestada referente ao mês de Junho..." 
              className={field} 
              value={serviceDesc}
              onChange={(e) => setServiceDesc(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Observações / Infos. Adicionais (opcional)</label>
            <textarea name="additionalInfo" rows={2} placeholder="Ex.: Dados bancários para pagamento, etc." className={field} />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-4 justify-between border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-brand-500/20"
          >
            {pending ? <RefreshCw className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
            {pending ? 'Emitindo Nota...' : 'Emitir NFSe Agora'}
          </button>
          
          {state.message && (
            <p className={`flex-1 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
              state.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {state.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
              {state.message}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Notas Agendadas (Simulação de Aba) ─────────────────────────────────────────

function Agendamentos() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="h-16 w-16 bg-brand-100 text-brand-600 dark:bg-brand-900/50 dark:text-brand-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        <CalendarClock className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Agendamento Automático de Notas</h3>
      <p className="text-slate-500 max-w-md mb-8">
        Em breve você poderá vincular os perfis fiscais aos contratos recorrentes. O sistema irá gerar as notas fiscais automaticamente todos os meses, sem que você precise apertar nenhum botão.
      </p>
      <button disabled className="rounded-xl bg-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600">
        Configurar Regras (Em breve)
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabKey = 'dashboard' | 'emitir' | 'agendamentos' | 'config';

const TABS: { key: TabKey; label: string; icon?: React.ElementType }[] = [
  { key: 'dashboard', label: 'Visão Geral' },
  { key: 'emitir', label: 'Nova Emissão' },
  { key: 'agendamentos', label: 'Agendamentos' },
  { key: 'config', label: 'Cadastro Fiscal' },
];

export function HubNotas(props: Props) {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [prefillName, setPrefillName] = useState<string | undefined>();
  const [prefillDoc, setPrefillDoc] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition(); 

  function goEmitir(name?: string, doc?: string) {
    setPrefillName(name);
    setPrefillDoc(doc);
    setTab('emitir');
  }

  function handleCancel(id: string, protocol: string) {
    if (confirm('Tem certeza que deseja cancelar esta NFS-e? Esta operação não pode ser desfeita.')) {
      startTransition(async () => {
        const res = await cancelNfseAction(id, protocol);
        if (res.ok) {
          alert('Nota fiscal cancelada com sucesso!');
        } else {
          alert('Erro ao cancelar nota fiscal: ' + res.message);
        }
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Tab bar Moderno ── */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-px">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative whitespace-nowrap px-4 py-3 text-sm font-bold transition-colors ${
              tab === t.key
                ? 'text-brand-600 border-b-2 border-brand-500 dark:text-brand-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.key === 'config' && !props.certOk && (
              <span className="absolute top-3 right-1 h-2 w-2 rounded-full bg-amber-400 shadow-sm" />
            )}
          </button>
        ))}
      </div>

      {isPending && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 p-4 text-sm font-semibold text-brand-700 shadow-sm border border-brand-100">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Cancelando nota fiscal junto à Sefin...
        </div>
      )}

      {/* Panels */}
      <div className="pt-2">
        {tab === 'dashboard' && (
          <Dashboard {...props} onEmitir={goEmitir} onConfig={() => setTab('config')} onCancel={handleCancel} />
        )}
        {tab === 'emitir' && (
          <EmitirNota
            mode={props.mode}
            customers={props.customers}
            certOk={props.certOk}
            fiscalOk={props.fiscalOk}
            prefillName={prefillName}
            prefillDoc={prefillDoc}
            profiles={props.profiles}
          />
        )}
        {tab === 'agendamentos' && <Agendamentos />}
        {tab === 'config' && (
          <FiscalForm config={props.config} temCert={props.certOk} profiles={props.profiles} />
        )}
      </div>
    </div>
  );
}
