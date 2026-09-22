'use client';

import { useState, useTransition, useActionState } from 'react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Card, CardHeader, Metric } from '@/components/ui/Card';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  ShieldCheck,
  RefreshCw,
  Plus,
  Users,
  UserX,
  ChevronDown,
  ChevronUp,
  Download,
  XCircle,
  Calendar,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { emitNfseAction, cancelNfseAction, type EmitState } from '../nfse/actions';
import type { NfseConfig, NfseServiceProfile } from '@/lib/server/fiscal';
import { DfeNacionalCard } from './DfeNacionalCard';

// ── Types ─────────────────────────────────────────────────────────────────────

type Nota = {
  id: string;
  nfseNumber?: string | null;
  serviceDescription: string;
  referenceMonth: string;
  status: string;
  amount: number;
  providerProtocol?: string | null;
  providerMode?: string | null;
  customer?: { name?: string; document?: string; email?: string } | null;
  taxAmount?: number | null;
  taxRate?: number | null;
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
  taxRatePercent: number;
};

const pctFmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const currentMonth = new Date().toISOString().slice(0, 7);
const currentMonthLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ISSUING: 'Processando',
  ISSUED: 'Emitida',
  CANCELED: 'Cancelada',
  ERROR: 'Falha',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ISSUED: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#1E3328] dark:text-[#DFFFAE] border border-[#DFFFAE]',
    ISSUING: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200',
    DRAFT: 'bg-black/5 text-[#6E6A61] dark:bg-white/5 dark:text-[#A8A49C]',
    CANCELED: 'bg-black/5 text-[#6E6A61] line-through',
    ERROR: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200',
  };
  const Icon =
    status === 'ISSUED'
      ? CheckCircle2
      : status === 'ERROR' || status === 'CANCELED'
      ? AlertTriangle
      : status === 'ISSUING'
      ? RefreshCw
      : Clock;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? 'bg-black/5 text-[#6E6A61]'}`}>
      <Icon className={`h-3 w-3 ${status === 'ISSUING' ? 'animate-spin' : ''}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({
  recent,
  customers,
  mode,
  certOk,
  fiscalOk,
  onEmitir,
  onCancel,
}: Props & {
  onEmitir: (name?: string, doc?: string) => void;
  onCancel: (id: string, protocol: string) => void;
}) {
  const ready = certOk && fiscalOk;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtro de meses
  const allMonths = Array.from(new Set(recent.map(n => n.referenceMonth).filter(Boolean)));
  if (!allMonths.includes(currentMonth)) allMonths.push(currentMonth);
  allMonths.sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const monthNotes = recent.filter(n => n.referenceMonth === selectedMonth);
  
  const issuedThisMonth = monthNotes.filter((n) => n.status === 'ISSUED');
  const totalThisMonth = issuedThisMonth.reduce((s, n) => s + n.amount, 0);
  const taxThisMonth = issuedThisMonth.reduce((s, n) => s + (n.taxAmount ?? 0), 0);

  const inProgress = monthNotes.filter((n) => n.status === 'ISSUING');
  const withError = monthNotes.filter((n) => n.status === 'ERROR');

  const issuedDocs = new Set(issuedThisMonth.map((n) => n.customer?.document).filter(Boolean));
  const clientesSemNota = customers.filter((c) => c.document && !issuedDocs.has(c.document));

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Status de Ambiente */}
      {!ready && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-4 sm:p-5 text-sm text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>
              <strong>Modo de teste:</strong> As notas não são enviadas ao governo. Configure o cadastro fiscal e certificado digital.
            </span>
          </div>
          <Link
            href="/configuracoes/fiscal"
            className="rounded-full bg-amber-200/70 hover:bg-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900 px-5 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 transition-colors"
          >
            Configurar Certificado
          </Link>
        </div>
      )}

      {/* Navegação de Meses & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SegmentedTabs
          tabs={allMonths.map(m => ({ id: m, label: m === currentMonth ? 'Este Mês' : m }))}
          activeTab={selectedMonth}
          onChange={setSelectedMonth}
          layoutId="notasMonthTabs"
        />
        
        {/* CTA Nova Nota Slim */}
        <button
          onClick={() => onEmitir()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-6 py-2.5 text-sm font-bold text-hexxa-lime shadow-(--elev-1) transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Nova Nota Fiscal
        </button>
      </div>

      {/* Hero: Faturamento em Destaque */}
      <Card level={3} tone="deep" className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <CardHeader label={`Faturamento • ${selectedMonth}`} icon={FileText} />
          <Metric value={fmt(totalThisMonth)} size="hero" className="mt-4 text-ink" />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold">
          <div className="bg-surface-card shadow-(--elev-inset) rounded-2xl px-5 py-3 text-ink">
            <span className="text-caption text-ink-soft uppercase tracking-wider block mb-1">Emitidas</span>
            <span className="text-xl font-serif font-bold tabular">{issuedThisMonth.length} notas</span>
          </div>
          
          <div className="bg-amber-500/10 shadow-(--elev-inset) rounded-2xl px-5 py-3 text-amber-700 dark:text-amber-300" title="Imposto acumulado no mês">
            <span className="text-caption text-amber-600/80 dark:text-amber-400 uppercase tracking-wider block mb-1">Imposto</span>
            <span className="text-xl font-serif font-bold tabular">{fmt(taxThisMonth)}</span>
          </div>
          
          {(inProgress.length > 0 || withError.length > 0) && (
            <div className="bg-red-500/10 shadow-(--elev-inset) rounded-2xl px-5 py-3 text-red-700 dark:text-red-300">
              <span className="text-caption text-red-600/80 dark:text-red-400 uppercase tracking-wider block mb-1">Pendentes</span>
              <span className="text-xl font-serif font-bold tabular">{inProgress.length + withError.length} notas</span>
            </div>
          )}
        </div>
      </Card>

      <DfeNacionalCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Esquerda: Notas Recentes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-serif font-bold text-title2 text-ink">
              Histórico • {selectedMonth}
            </h3>
            <span className="text-footnote text-ink-soft">{monthNotes.length} registros</span>
          </div>

          {monthNotes.length === 0 ? (
            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) p-12 text-center">
              <FileText className="h-8 w-8 mx-auto text-ink-soft opacity-40 mb-4" />
              <p className="text-sm font-bold text-ink">Nenhuma nota neste mês.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {monthNotes.map((n) => {
                const isExpanded = expandedId === n.id;
                const isLongKey = n.nfseNumber === n.providerProtocol && n.nfseNumber && n.nfseNumber.length > 20;
                const displayNum = isLongKey ? 'Gerando...' : n.nfseNumber ?? '—';
                const isCanceled = n.status === 'CANCELED';

                return (
                  <div
                    key={n.id}
                    className="overflow-hidden rounded-2xl bg-surface-card shadow-(--elev-1) transition-shadow hover:shadow-(--elev-2)"
                  >
                    {/* Linha Header do Card */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : n.id)}
                      className="flex items-center justify-between p-4 cursor-pointer gap-4"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="hidden sm:flex shrink-0 w-16 items-center justify-center">
                          <span className="text-xs font-mono font-bold text-ink-soft bg-surface-card shadow-(--elev-inset) py-1 px-2 rounded-md">
                            {displayNum}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold text-sm truncate ${isCanceled ? 'text-ink-soft line-through' : 'text-ink'}`}>
                              {n.customer?.name ?? 'Cliente Avulso'}
                            </p>
                            {n.providerMode === 'mock' && (
                              <span title="Nota de teste" className="hidden sm:inline-block rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                                Teste
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-ink-soft truncate mt-0.5">
                            {n.serviceDescription}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:block">
                          <StatusBadge status={n.status} />
                        </div>
                        <div className="text-right w-24">
                          <p className={`font-serif font-bold text-sm sm:text-base tabular ${isCanceled ? 'text-ink-soft line-through' : 'text-ink'}`}>
                            {fmt(n.amount)}
                          </p>
                        </div>
                        <button className="tap-target pressable focusable text-ink-soft hover:text-ink p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Detalhes Expansíveis */}
                    {isExpanded && (
                      <div className="border-t border-black/5 dark:border-white/5 bg-surface-card/40 p-4 sm:p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-caption font-bold uppercase tracking-wider text-ink-soft mb-1">Tomador</p>
                            <p className="font-semibold text-ink">{n.customer?.name}</p>
                            {n.customer?.document && <p className="text-ink-soft text-xs mt-0.5">{n.customer.document}</p>}
                          </div>
                          <div>
                            <p className="text-caption font-bold uppercase tracking-wider text-ink-soft mb-1">Descrição</p>
                            <p className="text-ink leading-relaxed whitespace-pre-wrap">{n.serviceDescription}</p>
                          </div>
                        </div>

                        {n.taxAmount != null && n.taxAmount > 0 && (
                          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-surface-card shadow-(--elev-inset) p-3.5 text-sm">
                            <div>
                              <p className="text-caption font-bold uppercase tracking-wider text-ink-soft mb-1">Valor da nota</p>
                              <p className="font-serif font-bold tabular text-ink">{fmt(n.amount)}</p>
                            </div>
                            <div>
                              <p className="text-caption font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                                Imposto {n.taxRate != null ? `(${pctFmt(n.taxRate)}%)` : ''}
                              </p>
                              <p className="font-serif font-bold tabular text-amber-700 dark:text-amber-300">{fmt(n.taxAmount)}</p>
                            </div>
                            <div>
                              <p className="text-caption font-bold uppercase tracking-wider text-hexxa-green dark:text-hexxa-lime mb-1">Valor líquido</p>
                              <p className="font-serif font-bold tabular text-hexxa-green dark:text-hexxa-lime">
                                {fmt(n.amount - n.taxAmount)}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-black/5 dark:border-white/5 pt-3">
                          <p className="text-caption font-bold uppercase tracking-wider text-ink-soft mb-1">Chave / Protocolo</p>
                          <code className="text-xs font-mono text-ink-soft bg-surface-card shadow-(--elev-inset) p-2 rounded-lg block break-all select-all">
                            {n.providerProtocol ?? 'Aguardando retorno da Sefin...'}
                          </code>
                        </div>

                        {/* Botões VISÍVEIS */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          {n.status === 'ISSUED' && n.providerProtocol && (
                            <>
                              <a
                                href={`/meu-negocio/notas/${n.id}/danfse`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-4 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
                              >
                                <FileText className="h-3.5 w-3.5" /> PDF
                              </a>
                              <a
                                href={`/api/nfse/${n.id}/xml`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) px-4 py-2 text-xs font-bold text-ink transition-all"
                              >
                                <Download className="h-3.5 w-3.5" /> XML
                              </a>
                              <button
                                onClick={() => onCancel(n.id, n.providerProtocol!)}
                                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-expense hover:bg-red-500/10 ml-auto transition-colors"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna Direita: Faturamento Pendente */}
        <div className="space-y-4">
          <div className="px-2">
            <h3 className="font-serif font-bold text-title2 text-ink">
              Pendentes • {selectedMonth}
            </h3>
          </div>

          <div className="rounded-3xl bg-surface-card shadow-(--elev-1) p-5 space-y-4">
            {clientesSemNota.length > 0 ? (
              <>
                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> {clientesSemNota.length} aguardando
                  </p>
                </div>
                <div className="space-y-2">
                  {clientesSemNota.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-card shadow-(--elev-inset)">
                      <p className="text-sm font-semibold truncate text-ink">{c.name}</p>
                      
                      <button
                        onClick={() => onEmitir(c.name, c.document ?? undefined)}
                        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-hexxa-forest hover:bg-hexxa-green text-hexxa-lime px-4 py-1.5 text-caption font-bold shadow-(--elev-1) transition-all cursor-pointer"
                      >
                        Emitir →
                      </button>
                    </div>
                  ))}
                  {clientesSemNota.length > 5 && (
                    <p className="text-xs text-center font-medium text-ink-soft pt-2">
                      + {clientesSemNota.length - 5} clientes
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 text-[#2F4A3C] dark:text-[#DFFFAE] mx-auto mb-3" />
                <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Tudo em dia!</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-2 leading-relaxed">
                  Todos os clientes já possuem<br />nota neste mês.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Emitir Nota Form ─────────────────────────────────────────────────────────

type DestinatarioMode = 'cliente' | 'avulso';

const DEST_TABS: { key: DestinatarioMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'cliente', label: 'Cliente Cadastrado', icon: Users },
  { key: 'avulso', label: 'Tomador Avulso', icon: UserX },
];

function EmitirNota({
  mode,
  customers,
  prefillName,
  prefillDoc,
  certOk,
  fiscalOk,
  profiles,
  taxRatePercent,
}: {
  mode: 'gov' | 'mock';
  customers: Customer[];
  prefillName?: string;
  prefillDoc?: string;
  certOk: boolean;
  fiscalOk: boolean;
  profiles?: NfseServiceProfile[];
  taxRatePercent: number;
}) {
  const emitInitial: EmitState = { ok: false, message: '' };
  const [state, action, pending] = useActionState(emitNfseAction, emitInitial);
  const [amount, setAmount] = useState(0);
  const previewTax = (amount * taxRatePercent) / 100;
  const previewNet = amount - previewTax;

  const hasPrefill = Boolean(prefillDoc || prefillName);
  const [destMode, setDestMode] = useState<DestinatarioMode>(
    hasPrefill ? 'avulso' : customers.length > 0 ? 'cliente' : 'avulso'
  );
  const [selectedId, setSelectedId] = useState('');
  const [cusName, setCusName] = useState(prefillName ?? '');
  const [cusDoc, setCusDoc] = useState(prefillDoc ?? '');
  const [cusEmail, setCusEmail] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [profileId, setProfileId] = useState(profiles?.[0]?.id ?? '');

  // Endereço do tomador — a DPS/NFS-e pede endereço completo; resolvido a
  // partir só do CEP via ViaCEP (também devolve o código IBGE do município,
  // sem precisar de um seletor de cidade separado).
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidadeUf, setCidadeUf] = useState('');
  const [cMun, setCMun] = useState('');
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  async function handleCepBlur() {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepStatus('loading');
    try {
      const res = await fetch(`/api/cep/${digits}`);
      if (!res.ok) {
        setCepStatus('error');
        return;
      }
      const data = await res.json();
      setLogradouro(data.logradouro);
      setBairro(data.bairro);
      setCidadeUf(`${data.cidade} - ${data.uf}`);
      setCMun(data.codigoMunicipio);
      setCepStatus('ok');
    } catch {
      setCepStatus('error');
    }
  }

  function handleClientSelect(id: string) {
    setSelectedId(id);
    const c = customers.find((c) => c.id === id);
    if (c) {
      setCusName(c.name);
      setCusDoc(c.document ?? '');
      setCusEmail(c.email ?? '');
    } else {
      setCusName('');
      setCusDoc('');
      setCusEmail('');
    }
  }

  function handleModeChange(m: DestinatarioMode) {
    setDestMode(m);
    setSelectedId('');
    setCusName('');
    setCusDoc('');
    setCusEmail('');
  }

  const canSubmit = !pending && (destMode !== 'cliente' || Boolean(selectedId));

  const field =
    'mt-1.5 w-full bg-surface-card shadow-(--elev-inset) rounded-2xl px-4 py-3.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all placeholder:text-ink-soft/40';
  const lbl = 'text-caption font-bold text-ink-soft uppercase tracking-wider ml-1 block';

  return (
    <div className="space-y-6 w-full max-w-4xl animate-fade-up">
      {mode === 'gov' ? (
        <div className="flex items-center gap-2.5 rounded-3xl bg-hexxa-forest/10 border border-hexxa-green/20 p-4 text-xs font-bold text-hexxa-green dark:text-hexxa-lime">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          Emitindo no Emissor Nacional — ambiente de produção real
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-3xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs font-bold text-amber-700 dark:text-amber-300">
          <FlaskConical className="h-5 w-5 shrink-0" />
          Modo de teste — a nota será gravada no banco local para simulação.
        </div>
      )}

      <form action={action} className="space-y-6">
        {/* Card 1: Valor */}
        <div className="rounded-3xl bg-surface-card shadow-(--elev-1) p-6 sm:p-8">
          <h3 className="text-caption font-bold uppercase tracking-wider text-ink-soft mb-6 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-card shadow-(--elev-inset) text-[10px]">1</span>
            Qual o valor faturado?
          </h3>
          
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-6xl font-light text-ink-soft/40 select-none">R$</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0,00"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent font-serif tabular text-5xl sm:text-7xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-soft/20"
            />
          </div>
          
          {amount > 0 && taxRatePercent > 0 && (
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold">
              <div className="rounded-2xl bg-amber-500/10 shadow-(--elev-inset) px-5 py-3 text-amber-700 dark:text-amber-300">
                <span className="text-caption uppercase tracking-wider block mb-1 opacity-80">Imposto Estimado ({pctFmt(taxRatePercent)}%)</span>
                <span className="font-serif tabular">{fmt(previewTax)}</span>
              </div>
              <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) px-5 py-3 text-ink">
                <span className="text-caption uppercase tracking-wider block mb-1 opacity-60">Valor Líquido</span>
                <span className="font-serif tabular">{fmt(previewNet)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Serviço e Competência */}
        <div className="rounded-3xl bg-surface-card shadow-(--elev-1) p-6 sm:p-8">
          <h3 className="text-caption font-bold uppercase tracking-wider text-ink-soft mb-6 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-card shadow-(--elev-inset) text-[10px]">2</span>
            Detalhes do Serviço
          </h3>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className={lbl}>Descrição Completa *</label>
              <textarea
                name="serviceDescription"
                required
                rows={4}
                placeholder="Ex.: Prestação de serviços de consultoria técnica referente a..."
                className={`${field} resize-none`}
                value={serviceDesc}
                onChange={(e) => setServiceDesc(e.target.value)}
              />
            </div>
            <div>
              <label className={lbl}>Data de Competência *</label>
              <input name="competenciaDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
            </div>
            <div className="md:col-span-3">
              <label className={lbl}>Perfil Fiscal (item da lista de serviço)</label>
              {profiles && profiles.length > 1 ? (
                <select name="profileId" value={profileId} onChange={(e) => setProfileId(e.target.value)} className={field}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} — item {p.itemListaServico}</option>
                  ))}
                </select>
              ) : profiles && profiles.length === 1 ? (
                <>
                  <input type="hidden" name="profileId" value={profiles[0]!.id} />
                  <p className={`${field} text-ink-soft`}>
                    {profiles[0]!.nome} — item {profiles[0]!.itemListaServico}
                    {profiles[0]!.aliquotaIss != null ? ` · ISS ${profiles[0]!.aliquotaIss}%` : ''}
                  </p>
                </>
              ) : (
                <p className="text-xs font-bold text-expense">
                  Nenhum perfil fiscal cadastrado — <Link href="/configuracoes/fiscal" className="underline">cadastre um</Link> antes de emitir.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Destinatário */}
        <div className="rounded-3xl bg-surface-card shadow-(--elev-1) p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-[10px]">3</span>
              Dados do Tomador
            </h3>
            <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-full">
              {DEST_TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleModeChange(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all ${
                      destMode === t.key
                        ? 'bg-white dark:bg-[#231F20] text-[#231F20] dark:text-[#F5F6F4] shadow-sm'
                        : 'bg-transparent text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#F5F6F4]'
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
              <label className={lbl}>Selecione o Cliente</label>
              <select
                value={selectedId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className={field}
              >
                <option value="">— Selecione um cliente cadastrado —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {destMode !== 'cliente' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className={lbl}>CPF / CNPJ *</label>
                <input value={cusDoc} onChange={(e) => setCusDoc(e.target.value)} placeholder="00.000.000/0001-00" className={field} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Nome / Razão Social *</label>
                <input value={cusName} onChange={(e) => setCusName(e.target.value)} placeholder="Empresa Cliente LTDA" className={field} />
              </div>
              <div className="md:col-span-3">
                <label className={lbl}>E-mail (opcional)</label>
                <input type="email" value={cusEmail} onChange={(e) => setCusEmail(e.target.value)} placeholder="financeiro@tomador.com" className={field} />
              </div>
            </div>
          )}

          {/* Endereço do tomador — resolvido a partir do CEP (ViaCEP já devolve
              o código IBGE do município junto, sem precisar de outro campo). */}
          <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/10">
            <p className={`${lbl} mb-4`}>Endereço do Tomador (opcional, mas evita rejeição da nota por alguns municípios)</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className={lbl}>CEP</label>
                <input
                  name="cep"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  className={field}
                />
                {cepStatus === 'loading' && <p className="mt-1 text-[11px] text-[#6E6A61]">Buscando…</p>}
                {cepStatus === 'ok' && <p className="mt-1 text-[11px] font-bold text-emerald-700">✓ Endereço preenchido</p>}
                {cepStatus === 'error' && <p className="mt-1 text-[11px] font-bold text-amber-700">CEP não encontrado</p>}
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Logradouro</label>
                <input name="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua / Avenida" className={field} />
              </div>
              <div>
                <label className={lbl}>Número</label>
                <input name="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" className={field} />
              </div>
              <div>
                <label className={lbl}>Complemento</label>
                <input name="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Sala, apto…" className={field} />
              </div>
              <div>
                <label className={lbl}>Bairro</label>
                <input name="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" className={field} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Cidade / UF</label>
                <input value={cidadeUf} disabled placeholder="Preenchido automaticamente pelo CEP" className={`${field} bg-black/5 dark:bg-white/5`} />
              </div>
            </div>
            <input type="hidden" name="cMun" value={cMun} />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 flex flex-col items-start gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-10 py-4 text-base font-bold text-hexxa-lime shadow-(--elev-1) transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {pending ? 'Processando Emissão...' : 'Emitir Nota Fiscal (NFSe)'}
          </button>

          {state.message && (
            <div className={`w-full rounded-3xl p-5 text-sm font-bold shadow-(--elev-1) ${
              state.ok ? 'bg-surface-card text-hexxa-green dark:text-hexxa-lime' : 'bg-red-500/10 text-expense shadow-(--elev-inset)'
            }`}>
              <p className="flex items-center gap-2">
                {state.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
                {state.message}
              </p>
              {state.ok && state.taxAmount != null && state.taxAmount > 0 && (
                <p className="mt-2 pl-7 font-normal opacity-90 text-xs">
                  Imposto estimado{state.taxRate != null ? ` (${pctFmt(state.taxRate)}%)` : ''}: {fmt(state.taxAmount)} · Valor líquido: {fmt(state.netAmount ?? 0)}
                </p>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Main Hub Notas ──────────────────────────────────────────────────────────

type TabKey = 'dashboard' | 'emitir';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'dashboard', label: 'Visão Geral' },
  { id: 'emitir', label: 'Nova Emissão' },
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
    if (confirm('Tem certeza que deseja cancelar esta NFS-e?')) {
      startTransition(async () => {
        const res = await cancelNfseAction(id, protocol);
        if (res.ok) {
          alert('Nota fiscal cancelada com sucesso!');
        } else {
          alert('Erro ao cancelar: ' + res.message);
        }
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex">
        <SegmentedTabs
          tabs={TABS}
          activeTab={tab}
          onChange={setTab}
          layoutId="notasTabsIndicator"
        />
      </div>

      {isPending && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-900 border border-amber-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cancelando nota fiscal junto à Sefin...
        </div>
      )}

      {/* Panels */}
      <div>
        {tab === 'dashboard' && (
          <Dashboard {...props} onEmitir={goEmitir} onCancel={handleCancel} />
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
            taxRatePercent={props.taxRatePercent}
          />
        )}
      </div>
    </div>
  );
}
