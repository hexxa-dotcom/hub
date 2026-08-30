'use client';

import { useState } from 'react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  Receipt,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Download,
  Calendar,
  DollarSign,
  Filter,
  Loader2,
  ExternalLink,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import type { TaxGuideRecord, TaxGuideStatusValue } from '@hexxa/db';
import { registrarGuiaAction, marcarGuiaPagaAction } from './actions';
import { normalizeDocument } from '@hexxa/core/document-br';
import { categoriaDe, type GuiaCategoria } from '@/lib/guias';

// ── Types ─────────────────────────────────────────────────────────────────────

type GuiaStatus = TaxGuideStatusValue;
type Guia = TaxGuideRecord;

// ── Config ────────────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<GuiaCategoria, { label: string; cls: string }> = {
  DAS:          { label: 'DAS',          cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]' },
  DARF:         { label: 'DARF',         cls: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  ISS:          { label: 'ISS',          cls: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
  PARCELAMENTO: { label: 'Parcelamento', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  FGTS:         { label: 'FGTS',         cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  DIVERSA:      { label: 'Diversa',      cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]' },
};

const STATUS_CONFIG: Record<GuiaStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  OPEN:     { label: 'Pendente',  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', icon: Clock },
  PAID:     { label: 'Paga',      cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', icon: CheckCircle2 },
  OVERDUE:  { label: 'Em atraso', cls: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300', icon: AlertTriangle },
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtCompetencia(iso: string) {
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}

function vencClass(iso: string, status: GuiaStatus) {
  if (status === 'PAID') return 'text-[#6E6A61] dark:text-[#A8A49C]';
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'text-red-600 dark:text-red-400 font-bold';
  if (days <= 5) return 'text-amber-600 dark:text-amber-400 font-bold';
  return 'text-[#6E6A61] dark:text-[#A8A49C]';
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copiar Pix' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] px-3.5 py-1.5 text-xs font-bold text-[#2F4A3C] hover:bg-[#DFFFAE] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] transition-all"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado!' : label}
    </button>
  );
}

// ── EmitirDasBtn ──────────────────────────────────────────────────────────────

type DasState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; linhaDigitavel: string; pgmeiUrl: string }
  | { status: 'error'; msg: string; pgmeiUrl?: string };

function EmitirDasBtn({ competencia, cnpj }: { competencia: string; cnpj: string }) {
  const [state, setState] = useState<DasState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  async function emitir() {
    setState({ status: 'loading' });
    try {
      const res = await fetch(
        `/api/das?cnpj=${encodeURIComponent(cnpj)}&pa=${encodeURIComponent(competencia)}`,
      );
      const json = await res.json() as { linhaDigitavel?: string; pgmeiUrl?: string; error?: string };
      if (res.ok && json.linhaDigitavel) {
        setState({ status: 'ok', linhaDigitavel: json.linhaDigitavel, pgmeiUrl: json.pgmeiUrl ?? '' });
      } else {
        setState({ status: 'error', msg: json.error ?? 'Erro desconhecido', pgmeiUrl: json.pgmeiUrl });
      }
    } catch {
      setState({ status: 'error', msg: 'Falha de conexão com o servidor.' });
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state.status === 'ok') {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">DAS emitido — linha digitável</p>
        <p className="break-all font-mono text-xs text-[#231F20] dark:text-[#FEFDF3] bg-white/60 dark:bg-black/40 p-2.5 rounded-xl">{state.linhaDigitavel}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => copy(state.linhaDigitavel)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] px-3.5 py-1.5 text-xs font-bold text-[#DFFFAE] hover:bg-[#2F4A3C] transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado!' : 'Copiar linha'}
          </button>
          {state.pgmeiUrl && (
            <a
              href={state.pgmeiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir no PGMEI
            </a>
          )}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-xs text-red-700 dark:text-red-400">{state.msg}</p>
        <div className="flex flex-wrap gap-2">
          {state.pgmeiUrl && (
            <a
              href={state.pgmeiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Emitir no portal do governo
            </a>
          )}
          <button
            type="button"
            onClick={() => setState({ status: 'idle' })}
            className="text-xs text-[#6E6A61] dark:text-[#A8A49C] underline hover:text-[#231F20]"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={emitir}
      disabled={!cnpj || state.status === 'loading'}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] px-3.5 py-1.5 text-xs font-bold text-[#DFFFAE] hover:bg-[#2F4A3C] transition-all disabled:opacity-50"
    >
      {state.status === 'loading' ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Emitindo…
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5" /> Emitir DAS
        </>
      )}
    </button>
  );
}

// ── Nova Guia Form ────────────────────────────────────────────────────────────

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-colors';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] tracking-wide uppercase';

function NovaGuiaForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const tipo = String(fd.get('categoria') ?? '');
    const descricao = String(fd.get('descricao') ?? '').trim();
    const competencia = String(fd.get('competencia') ?? '').trim(); // MM/AAAA
    const dueDate = String(fd.get('vencimento') ?? '');
    const [mes, ano] = competencia.split('/');
    const referenceMonth = ano && mes ? `${ano}-${mes.padStart(2, '0')}-01` : dueDate;

    setSubmitting(true);
    setError(null);
    const res = await registrarGuiaAction({
      taxName: `${CAT_CONFIG[tipo as GuiaCategoria]?.label ?? tipo} — ${descricao}`,
      referenceMonth,
      dueDate,
      amount: Number(String(fd.get('valor') ?? '0').replace(',', '.')),
      pixCode: String(fd.get('pix') ?? '').trim() || null,
    });
    setSubmitting(false);
    if ('error' in res) {
      setError(res.error!);
      return;
    }
    onAdded();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 p-6 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Registrar Nova Guia</p>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>Tipo de Guia</label>
          <select name="categoria" className={`mt-1.5 ${field}`}>
            <option value="DAS">DAS — Simples Nacional</option>
            <option value="DARF">DARF — Federal</option>
            <option value="ISS">ISS — Municipal</option>
            <option value="FGTS">FGTS</option>
            <option value="DIVERSA">Guia Diversa</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Competência</label>
          <input name="competencia" required placeholder="MM/AAAA" pattern="\d{2}/\d{4}" className={`mt-1.5 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição</label>
          <input name="descricao" required placeholder="Ex.: Simples Nacional — Junho/2026" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Vencimento</label>
          <input name="vencimento" type="date" required className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Valor (R$)</label>
          <input name="valor" inputMode="decimal" required placeholder="0,00" className={`mt-1.5 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Código Pix (opcional)</label>
          <input name="pix" placeholder="Cole aqui o código Pix copia e cola da guia" className={`mt-1.5 ${field}`} />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] transition-all hover:scale-105 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar Guia
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type CatFilter = GuiaCategoria | 'todas';
type StatusFilter = GuiaStatus | 'todas';

export function HubGuias({ initial }: { initial: Guia[] }) {
  const [guias, setGuias] = useState<Guia[]>(initial);
  const [catFilter, setCatFilter] = useState<CatFilter>('todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cnpjMei, setCnpjMei] = useState('');
  const [showCnpjConfig, setShowCnpjConfig] = useState(false);
  const [cnpjInput, setCnpjInput] = useState('');

  // Guias com plano de parcelamento têm aba própria — não duplicam aqui.
  const guiasAvulsas = guias.filter((g) => !g.installmentGroupId);

  const filtered = guiasAvulsas.filter(
    (g) =>
      (catFilter === 'todas' || categoriaDe(g.taxName) === catFilter) &&
      (statusFilter === 'todas' || g.status === statusFilter),
  );

  const pendentes = guiasAvulsas.filter((g) => g.status === 'OPEN');
  const vencidas = guiasAvulsas.filter((g) => g.status === 'OVERDUE');
  const pagas = guiasAvulsas.filter((g) => g.status === 'PAID');

  const totalAberto = [...pendentes, ...vencidas].reduce((s, g) => s + g.amount, 0);
  const totalVencido = vencidas.reduce((s, g) => s + g.amount, 0);
  const totalPago = pagas.reduce((s, g) => s + g.amount, 0);

  async function refetch() {
    const res = await fetch('/api/guias');
    if (res.ok) setGuias(await res.json());
  }

  async function markPaid(id: string) {
    setGuias((prev) => prev.map((g) => (g.id === id ? { ...g, status: 'PAID' as GuiaStatus } : g)));
    await marcarGuiaPagaAction(id);
  }

  const cats: { key: CatFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'DAS', label: 'DAS' },
    { key: 'DARF', label: 'DARF' },
    { key: 'ISS', label: 'ISS' },
    { key: 'FGTS', label: 'FGTS' },
    { key: 'DIVERSA', label: 'Diversas' },
  ];

  const statuses: { key: StatusFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'OPEN', label: 'Pendentes' },
    { key: 'OVERDUE', label: 'Em atraso' },
    { key: 'PAID', label: 'Pagas' },
  ];

  const [mainTab, setMainTab] = useState<'guias' | 'timeline' | 'parcelamentos'>('guias');

  const planos = new Map<string, Guia[]>();
  for (const g of guias) {
    if (!g.installmentGroupId) continue;
    const arr = planos.get(g.installmentGroupId) ?? [];
    arr.push(g);
    planos.set(g.installmentGroupId, arr);
  }

  return (
    <div className="space-y-6">
      {/* Selector de Abas Principais */}
      <div className="flex flex-wrap gap-2 border-b border-black/5 dark:border-white/10 pb-4">
        <button
          type="button"
          onClick={() => setMainTab('guias')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all ${
            mainTab === 'guias'
              ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
              : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
          }`}
        >
          <Receipt className="h-3.5 w-3.5" /> Guias & Impostos
        </button>
        <button
          type="button"
          onClick={() => setMainTab('timeline')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all ${
            mainTab === 'timeline'
              ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
              : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" /> Linha do Tempo & Alertas
        </button>
        <button
          type="button"
          onClick={() => setMainTab('parcelamentos')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all ${
            mainTab === 'parcelamentos'
              ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
              : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Parcelamentos {planos.size > 0 ? `(${planos.size})` : ''}
        </button>
      </div>

      {mainTab === 'timeline' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-5 shadow-sm">
            <h2 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
              Linha do Tempo das Obrigações do Mês
            </h2>
            <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Acompanhe o cronograma exato de vencimentos e obrigações fiscais para evitar multas e juros.
            </p>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-black/10 dark:before:bg-white/10">
              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Dia 07 do Mês</span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold">
                      Concluído
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Pagamento de FGTS & Pró-labore</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                    Recolhimento do FGTS dos funcionários e retenção do pró-labore dos sócios.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Dia 20 do Mês (Próximo Vencimento)</span>
                    <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-bold">
                      Aguardando Pagamento
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Guia Unificada do Simples Nacional (DAS)</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                    Imposto mensal apurado sobre o faturamento do mês anterior. Confira a alíquota na Bússola Tributária.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-[#2F4A3C] ring-4 ring-[#2F4A3C]/20" />
                <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">Dia 30 do Mês</span>
                    <span className="rounded-full bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] px-2.5 py-0.5 text-[10px] font-bold">
                      Agendado
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Fechamento Contábil & Envio de Extratos</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                    Consolidação automática das notas fiscais emitidas e despesas para apuração contábil.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'parcelamentos' && (
        <div className="space-y-4 animate-in fade-in">
          {planos.size === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
              <Layers className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum parcelamento cadastrado pela contabilidade no momento.</p>
            </div>
          ) : (
            [...planos.entries()].map(([groupId, parcelas]) => {
              const ordered = [...parcelas].sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0));
              const pagas = ordered.filter((p) => p.status === 'PAID').length;
              const total = ordered[0]?.installmentCount ?? ordered.length;
              const totalValor = ordered.reduce((s, p) => s + p.amount, 0);
              const restante = ordered.filter((p) => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0);
              const desc = ordered[0]?.taxName.replace(/\s*\(\d+\/\d+\)$/, '') ?? 'Parcelamento';
              const proxima = ordered.find((p) => p.status !== 'PAID');
              return (
                <div key={groupId} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md overflow-hidden shadow-sm">
                  <div className="p-6 sm:p-8 border-b border-black/5 dark:border-white/10 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">{desc}</h2>
                        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
                          {pagas} de {total} parcelas pagas · restam {BRL.format(restante)}
                        </p>
                      </div>
                      {proxima && (
                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Próxima parcela</p>
                          <p className={`text-sm font-bold ${vencClass(proxima.dueDate, proxima.status)}`}>{fmtDate(proxima.dueDate)} · {BRL.format(proxima.amount)}</p>
                        </div>
                      )}
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div className="h-full rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE] transition-[width] duration-700 ease-out" style={{ width: `${(pagas / total) * 100}%` }} />
                    </div>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Valor total do plano: <strong className="text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(totalValor)}</strong></p>
                  </div>

                  <div className="divide-y divide-black/5 dark:divide-white/10">
                    {ordered.map((p) => {
                      const st = STATUS_CONFIG[p.status];
                      const StatusIcon = st.icon;
                      const isExp = expanded === p.id;
                      return (
                        <div key={p.id}>
                          <button
                            type="button"
                            onClick={() => setExpanded(isExp ? null : p.id)}
                            className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            <span className="w-14 shrink-0 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">{p.installmentNumber}/{p.installmentCount}</span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs sm:text-sm font-bold ${vencClass(p.dueDate, p.status)}`}>{p.status === 'PAID' ? 'Paga' : `Vence ${fmtDate(p.dueDate)}`}</p>
                            </div>
                            <span className="shrink-0 text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(p.amount)}</span>
                            <span className={`hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${st.cls}`}>
                              <StatusIcon className="h-3 w-3" /> {st.label}
                            </span>
                            {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />}
                          </button>
                          {isExp && (
                            <div className="mx-5 mb-4 flex flex-wrap gap-2 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4">
                              {p.pixCode && <CopyBtn text={p.pixCode} />}
                              {p.fileUrl && (
                                <a
                                  href={p.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
                                >
                                  <Download className="h-3.5 w-3.5" /> Baixar Guia
                                </a>
                              )}
                              {p.status !== 'PAID' && (
                                <button
                                  type="button"
                                  onClick={() => markPaid(p.id)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Paga
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {mainTab === 'guias' && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Total em Aberto</p>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-amber-600 dark:text-amber-400">{BRL.format(totalAberto)}</p>
              <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{pendentes.length + vencidas.length} guia(s) a pagar</p>
            </div>

            <div className={`rounded-3xl border p-6 shadow-sm ${
              vencidas.length > 0
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md'
            }`}>
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Em Atraso</p>
                <div className={`p-2 rounded-xl ${vencidas.length > 0 ? 'bg-red-500/10 text-red-600' : 'bg-black/5 text-[#6E6A61]'}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <p className={`mt-3 font-serif font-bold text-2xl sm:text-3xl ${vencidas.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>
                {BRL.format(totalVencido)}
              </p>
              <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{vencidas.length} guia(s) vencida(s)</p>
            </div>

            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Total Pago</p>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-emerald-700 dark:text-emerald-400">{BRL.format(totalPago)}</p>
              <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{pagas.length} guia(s) quitada(s)</p>
            </div>
          </div>

          {/* Filters + action */}
          <div className="space-y-3">
            <div className="flex">
              <SegmentedTabs
                tabs={cats.map((c) => ({
                  id: c.key,
                  label: `${c.label} ${c.key !== 'todas' ? `(${guiasAvulsas.filter((g) => categoriaDe(g.taxName) === c.key).length})` : `(${guiasAvulsas.length})`}`,
                }))}
                activeTab={catFilter}
                onChange={setCatFilter}
                layoutId="guiasCatIndicator"
                size="sm"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-full border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md">
                <span className="pl-2 pr-1">
                  <Filter className="h-3.5 w-3.5 text-[#6E6A61] dark:text-[#A8A49C]" />
                </span>
                {statuses.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      statusFilter === s.key
                        ? 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]'
                        : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
              >
                <Plus className="h-4 w-4" /> Registrar Guia
              </button>
            </div>
          </div>

          {showForm && <NovaGuiaForm onClose={() => setShowForm(false)} onAdded={refetch} />}

          {/* CNPJ MEI para emissão de DAS */}
          {!showCnpjConfig ? (
            <button
              type="button"
              onClick={() => {
                setShowCnpjConfig(true);
                setCnpjInput(cnpjMei);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {cnpjMei ? `CNPJ Configurado: ${cnpjMei}` : 'Configurar CNPJ para emissão rápida de DAS'}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 p-3">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#6E6A61]" />
              <input
                value={cnpjInput}
                onChange={(e) => setCnpjInput(normalizeDocument(e.target.value).slice(0, 14))}
                placeholder="CNPJ (14 caracteres, sem pontuação)"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none placeholder:text-[#6E6A61]"
              />
              <button
                type="button"
                onClick={() => {
                  setCnpjMei(normalizeDocument(cnpjInput));
                  setShowCnpjConfig(false);
                }}
                className="rounded-full bg-[#1E3328] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] hover:bg-[#2F4A3C]"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setShowCnpjConfig(false)}
                className="rounded-full p-1 text-[#6E6A61] hover:text-[#231F20]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Guide list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
              <Receipt className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma guia encontrada com este filtro.</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10 overflow-hidden shadow-sm">
              {filtered.map((g) => {
                const categoria = categoriaDe(g.taxName);
                const cat = CAT_CONFIG[categoria];
                const st = STATUS_CONFIG[g.status];
                const StatusIcon = st.icon;
                const isExp = expanded === g.id;
                const competencia = fmtCompetencia(g.referenceMonth);
                return (
                  <div key={g.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExp ? null : g.id)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cat.cls}`}>{cat.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{g.taxName}</p>
                        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Competência: {competencia}</p>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(g.amount)}</p>
                        <p className={`text-xs ${vencClass(g.dueDate, g.status)}`}>
                          <Calendar className="mr-1 inline h-3 w-3" />
                          {g.status === 'PAID' ? 'Paga' : `Vence ${fmtDate(g.dueDate)}`}
                        </p>
                      </div>
                      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${st.cls}`}>
                        <StatusIcon className="h-3 w-3" />
                        {st.label}
                      </span>
                      {isExp ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
                      )}
                    </button>

                    {isExp && (
                      <div className="mx-5 mb-4 space-y-4 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-5">
                        <div className="grid gap-3 sm:grid-cols-3 text-sm">
                          <div>
                            <p className={lbl}>Valor da Guia</p>
                            <p className="font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(g.amount)}</p>
                          </div>
                          <div>
                            <p className={lbl}>Vencimento</p>
                            <p className={`font-bold ${vencClass(g.dueDate, g.status)}`}>{fmtDate(g.dueDate)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            {g.pixCode && <CopyBtn text={g.pixCode} />}
                            {g.fileUrl && (
                              <a
                                href={g.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
                              >
                                <Download className="h-3.5 w-3.5" /> Baixar Guia
                              </a>
                            )}
                            {g.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => markPaid(g.id)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Paga
                              </button>
                            )}
                          </div>
                          {categoria === 'DAS' &&
                            (cnpjMei ? (
                              <EmitirDasBtn competencia={competencia} cnpj={cnpjMei} />
                            ) : (
                              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                                Configure o CNPJ acima para emitir o DAS diretamente por aqui.
                              </p>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

