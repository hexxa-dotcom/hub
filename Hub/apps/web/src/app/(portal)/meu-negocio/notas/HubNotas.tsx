'use client';

import { useState, useTransition, useActionState } from 'react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
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
  config,
  onEmitir,
  onConfig,
  onCancel,
}: Props & {
  onEmitir: (name?: string, doc?: string) => void;
  onConfig: () => void;
  onCancel: (id: string, protocol: string) => void;
}) {
  const ready = certOk && fiscalOk;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const issuedThisMonth = recent.filter((n) => n.status === 'ISSUED' && n.referenceMonth === currentMonth);
  const totalThisMonth = issuedThisMonth.reduce((s, n) => s + n.amount, 0);
  const taxThisMonth = issuedThisMonth.reduce((s, n) => s + (n.taxAmount ?? 0), 0);

  const inProgress = recent.filter((n) => n.status === 'ISSUING');
  const withError = recent.filter((n) => n.status === 'ERROR');

  const issuedDocs = new Set(issuedThisMonth.map((n) => n.customer?.document).filter(Boolean));
  const clientesSemNota = customers.filter((c) => c.document && !issuedDocs.has(c.document));

  return (
    <div className="space-y-6">
      {/* Status de Ambiente */}
      {!ready && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-amber-50 dark:bg-amber-950/30 p-4 sm:p-5 text-sm text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>
              <strong>Modo de teste:</strong> As notas não são enviadas ao governo. Configure o cadastro fiscal e certificado digital.
            </span>
          </div>
          <button
            type="button"
            onClick={onConfig}
            className="rounded-full bg-amber-200/70 hover:bg-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900 px-4 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 transition-colors"
          >
            Configurar agora →
          </button>
        </div>
      )}

      {/* Hero: Faturamento & Emissão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Faturamento em Destaque */}
        <div className="md:col-span-2 relative overflow-hidden rounded-3xl bg-[#1E3328] text-[#FEFDF3] border border-[#2F4A3C] p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-[#DFFFAE] text-xs font-bold uppercase tracking-wider mb-2">
              <FileText className="h-4 w-4" />
              <span>Faturamento de {currentMonthLabel}</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#FEFDF3] mb-6">
              {fmt(totalThisMonth)}
            </h2>
          </div>

          <div className="relative z-10 flex flex-wrap gap-3 text-xs sm:text-sm font-bold">
            <div className="bg-[#2F4A3C]/70 border border-[#DFFFAE]/20 rounded-2xl px-4 py-2 text-[#DFFFAE]">
              <span className="text-[10px] text-[#DFFFAE]/70 uppercase tracking-wider block">Emitidas no mês</span>
              <span className="text-lg font-bold">{issuedThisMonth.length} notas</span>
            </div>
            <div className="bg-amber-900/40 border border-amber-300/20 rounded-2xl px-4 py-2 text-amber-100" title="Soma do imposto estimado de cada nota emitida neste mês — vence normalmente dia 20 do mês seguinte (DAS).">
              <span className="text-[10px] text-amber-200/80 uppercase tracking-wider block">Imposto acumulado no mês</span>
              <span className="text-lg font-bold">{fmt(taxThisMonth)}</span>
            </div>
            {(inProgress.length > 0 || withError.length > 0) && (
              <div className="bg-amber-900/50 border border-amber-400/30 rounded-2xl px-4 py-2 text-amber-200">
                <span className="text-[10px] text-amber-300 uppercase tracking-wider block">Pendentes / Erros</span>
                <span className="text-lg font-bold">{inProgress.length + withError.length} notas</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA Nova Nota */}
        <div
          onClick={() => onEmitir()}
          className="group relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-sm min-h-[180px]"
        >
          <div className="h-14 w-14 rounded-2xl bg-[#1E3328] text-[#DFFFAE] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </div>
          <h3 className="font-serif text-base sm:text-lg font-bold text-[#231F20] dark:text-[#FEFDF3]">
            Nova Nota Fiscal
          </h3>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">
            Emissão avulsa ou vinculada a cliente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Notas Emitidas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">
              Notas Recentes
            </h3>
            <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{recent.length} registros</span>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-12 text-center">
              <FileText className="h-8 w-8 mx-auto text-[#6E6A61] dark:text-[#A8A49C] opacity-40 mb-3" />
              <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Nenhuma nota emitida ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((n) => {
                const isExpanded = expandedId === n.id;
                const isLongKey = n.nfseNumber === n.providerProtocol && n.nfseNumber && n.nfseNumber.length > 20;
                const displayNum = isLongKey ? 'Gerando...' : n.nfseNumber ?? '—';
                const isCanceled = n.status === 'CANCELED';

                return (
                  <div
                    key={n.id}
                    className="overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Linha Header do Card */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : n.id)}
                      className="flex items-center justify-between p-4 sm:p-5 cursor-pointer gap-4"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="hidden sm:block shrink-0 w-16 text-center">
                          <span className="text-xs font-mono font-bold text-[#6E6A61] dark:text-[#A8A49C] bg-black/5 dark:bg-white/5 py-1 px-2 rounded-xl block">
                            {displayNum}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold text-sm truncate ${isCanceled ? 'text-[#6E6A61] line-through' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>
                            {n.customer?.name ?? 'Cliente Avulso'}
                          </p>
                          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] truncate mt-0.5">
                            {n.referenceMonth} • {n.serviceDescription}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5 shrink-0">
                        {n.providerMode === 'mock' && (
                          <span
                            title="Nota de teste — não foi enviada ao governo"
                            className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 border border-amber-200"
                          >
                            <FlaskConical className="h-3 w-3" /> Teste
                          </span>
                        )}
                        <StatusBadge status={n.status} />
                        <div className="text-right w-24">
                          <p className={`font-serif font-bold text-sm sm:text-base tabular ${isCanceled ? 'text-[#6E6A61] line-through' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>
                            {fmt(n.amount)}
                          </p>
                        </div>
                        <button className="text-[#6E6A61] hover:text-[#231F20]">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Detalhes Expansíveis */}
                    {isExpanded && (
                      <div className="border-t border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/20 p-5 sm:p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] mb-1">Tomador do Serviço</p>
                            <p className="font-bold text-[#231F20] dark:text-[#FEFDF3] text-sm">{n.customer?.name}</p>
                            {n.customer?.document && <p className="text-[#6E6A61] dark:text-[#A8A49C]">{n.customer.document}</p>}
                          </div>
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] mb-1">Descrição</p>
                            <p className="text-[#231F20] dark:text-[#FEFDF3] leading-relaxed whitespace-pre-wrap">{n.serviceDescription}</p>
                          </div>
                        </div>

                        {n.taxAmount != null && n.taxAmount > 0 && (
                          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3.5 text-xs">
                            <div>
                              <p className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-0.5">Valor da nota</p>
                              <p className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{fmt(n.amount)}</p>
                            </div>
                            <div>
                              <p className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-0.5">
                                Imposto {n.taxRate != null ? `(${pctFmt(n.taxRate)}%)` : ''}
                              </p>
                              <p className="font-serif font-bold text-sm text-amber-800 dark:text-amber-300">{fmt(n.taxAmount)}</p>
                            </div>
                            <div>
                              <p className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-0.5">Valor líquido</p>
                              <p className="font-serif font-bold text-sm text-[#2F4A3C] dark:text-[#DFFFAE]">{fmt(n.amount - n.taxAmount)}</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] mb-1">Chave / Protocolo</p>
                          <code className="text-xs font-mono text-[#6E6A61] bg-black/5 dark:bg-white/5 p-2 rounded-xl block break-all select-all">
                            {n.providerProtocol ?? 'Aguardando retorno da Sefin...'}
                          </code>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                          {n.status === 'ISSUED' && n.providerProtocol && (
                            <>
                              <a
                                href={`/meu-negocio/notas/${n.id}/danfse`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105"
                              >
                                <FileText className="h-3.5 w-3.5" /> PDF (DANFSe)
                              </a>
                              <a
                                href={`/api/nfse/${n.id}/xml`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/5"
                              >
                                <Download className="h-3.5 w-3.5" /> Baixar XML
                              </a>
                              <button
                                onClick={() => onCancel(n.id, n.providerProtocol!)}
                                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 ml-auto"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Cancelar Nota
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
          <h3 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">
            Faturamentos Pendentes
          </h3>

          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm space-y-4">
            {clientesSemNota.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {clientesSemNota.length} clientes sem nota neste mês
                  </p>
                </div>
                <div className="space-y-2.5">
                  {clientesSemNota.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/60 dark:bg-black/20">
                      <p className="text-xs font-bold truncate text-[#231F20] dark:text-[#FEFDF3]">{c.name}</p>
                      <button
                        onClick={() => onEmitir(c.name, c.document ?? undefined)}
                        className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE] px-3 py-1 text-[11px] font-bold shadow-sm"
                      >
                        Emitir →
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-[#2F4A3C] dark:text-[#DFFFAE] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Tudo em dia!</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">Nenhum cliente cadastrado está pendente neste mês.</p>
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
  profiles?: any[];
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
    'mt-1 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
  const lbl = 'text-xs font-bold text-[#6E6A61] uppercase tracking-wider dark:text-[#A8A49C]';

  return (
    <div className="space-y-5 w-full mx-auto animate-fade-up">
      {mode === 'gov' ? (
        <div className="flex items-center gap-2.5 rounded-3xl bg-[#EFFFD6] border border-[#DFFFAE] p-4 text-xs font-bold text-[#2F4A3C]">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          Emitindo no Emissor Nacional — ambiente de produção real
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-3xl bg-amber-50 border border-amber-200 p-4 text-xs font-bold text-amber-900">
          <FlaskConical className="h-5 w-5 shrink-0" />
          Modo de teste — a nota será gravada no banco local para simulação.
        </div>
      )}

      <form action={action} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-8 shadow-sm space-y-7">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">
            Emitir Nova Nota Fiscal de Serviço
          </h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">
            Preencha os dados do tomador e as especificações do serviço
          </p>
        </div>

        {/* Destinatário */}
        <div className="space-y-4 bg-white/60 dark:bg-black/20 p-5 rounded-3xl border border-black/5 dark:border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className={lbl}>Tomador do Serviço</p>
            <div className="flex gap-2">
              {DEST_TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleModeChange(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      destMode === t.key
                        ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                        : 'border border-black/10 dark:border-white/10 bg-white text-[#6E6A61] hover:bg-black/5'
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={lbl}>Nome / Razão Social</label>
                <input value={cusName} onChange={(e) => setCusName(e.target.value)} placeholder="Razão social ou nome completo" className={field} />
              </div>
              <div>
                <label className={lbl}>CPF / CNPJ</label>
                <input value={cusDoc} onChange={(e) => setCusDoc(e.target.value)} placeholder="00.000.000/0001-00" className={field} />
              </div>
              <div>
                <label className={lbl}>E-mail (opcional)</label>
                <input type="email" value={cusEmail} onChange={(e) => setCusEmail(e.target.value)} placeholder="financeiro@tomador.com" className={field} />
              </div>
            </div>
          )}
        </div>

        {/* Serviço e Valores */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className={lbl}>Valor Total (R$) *</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0,00"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className={`${field} font-serif text-lg font-bold text-[#1E3328] dark:text-[#DFFFAE]`}
            />
            {amount > 0 && taxRatePercent > 0 && (
              <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                Imposto estimado ({pctFmt(taxRatePercent)}%): <strong>{fmt(previewTax)}</strong> · Líquido: <strong>{fmt(previewNet)}</strong>
              </p>
            )}
          </div>
          <div>
            <label className={lbl}>Competência *</label>
            <input name="competenciaDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Descrição Completa do Serviço *</label>
            <textarea
              name="serviceDescription"
              required
              rows={4}
              placeholder="Ex.: Prestação de serviços de assessoria contábil referente ao período de..."
              className={field}
              value={serviceDesc}
              onChange={(e) => setServiceDesc(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-4 justify-between border-t border-black/5 dark:border-white/5">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-8 py-3 text-xs sm:text-sm font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {pending ? 'Processando Emissão...' : 'Emitir Nota Fiscal (NFSe)'}
          </button>

          {state.message && (
            <div className={`flex-1 rounded-2xl p-3 text-xs font-bold ${
              state.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <p className="flex items-center gap-2">
                {state.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                {state.message}
              </p>
              {state.ok && state.taxAmount != null && state.taxAmount > 0 && (
                <p className="mt-1.5 pl-6 font-normal text-green-900/80">
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

type TabKey = 'dashboard' | 'emitir' | 'config';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'dashboard', label: 'Visão Geral' },
  { id: 'emitir', label: 'Nova Emissão' },
  { id: 'config', label: 'Cadastro Fiscal' },
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
            taxRatePercent={props.taxRatePercent}
          />
        )}
        {tab === 'config' && (
          <FiscalForm config={props.config} temCert={props.certOk} profiles={props.profiles} />
        )}
      </div>
    </div>
  );
}
