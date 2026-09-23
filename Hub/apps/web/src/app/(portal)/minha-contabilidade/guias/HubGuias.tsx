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
  ChevronLeft,
  ChevronRight,
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
  EyeOff,
} from 'lucide-react';
import type { TaxGuideRecord, TaxGuideStatusValue } from '@hexxa/db';
import { registrarGuiaAction, marcarGuiaPagaAction } from './actions';
import { normalizeDocument } from '@hexxa/core/document-br';
import { categoriaDe, type GuiaCategoria } from '@/lib/guias';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { GuiasHero } from './GuiasHero';

// ── Types ─────────────────────────────────────────────────────────────────────

type GuiaStatus = TaxGuideStatusValue;
type Guia = TaxGuideRecord;

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getMonthLabel(yearMonth: string): string {
  if (yearMonth === 'all') return 'Todos os períodos';
  const parts = yearMonth.split('-');
  const y = parts[0] ?? '';
  const m = parts[1] ?? '01';
  const monthIdx = parseInt(m, 10) - 1;
  const name = MONTH_NAMES[monthIdx] ?? m;
  return `${name} de ${y}`;
}

function addMonths(yearMonth: string, delta: number): string {
  if (yearMonth === 'all') {
    const d = new Date();
    yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const parts = yearMonth.split('-');
  const y = Number(parts[0]) || new Date().getFullYear();
  const m = Number(parts[1]) || 1;
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  const newY = date.getUTCFullYear();
  const newM = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
}

// ── Config ────────────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<GuiaCategoria, { label: string; cls: string }> = {
  DAS:          { label: 'DAS',          cls: 'bg-hexxa-forest/10 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime border border-hexxa-forest/20 dark:border-hexxa-lime/20' },
  DARF:         { label: 'DARF',         cls: 'bg-black/5 text-ink dark:bg-white/10 dark:text-white border border-black/10 dark:border-white/10' },
  ISS:          { label: 'ISS',          cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20' },
  PARCELAMENTO: { label: 'Parcelamento', cls: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20' },
  FGTS:         { label: 'FGTS',         cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' },
  DIVERSA:      { label: 'Diversa',      cls: 'bg-black/5 text-ink-soft dark:bg-white/5 dark:text-ink-soft border border-black/5 dark:border-white/10' },
};

const STATUS_CONFIG: Record<GuiaStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  OPEN:     { label: 'Pendente',  cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20', icon: Clock },
  PAID:     { label: 'Paga',      cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
  OVERDUE:  { label: 'Em atraso', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20', icon: AlertTriangle },
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
  if (status === 'PAID') return 'text-ink-soft';
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'text-rose-600 dark:text-rose-400 font-bold';
  if (days <= 5) return 'text-amber-600 dark:text-amber-400 font-bold';
  return 'text-ink-soft';
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copiar Pix' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`tap-target pressable focusable inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold active:scale-95 transition-all ${
        copied
          ? 'bg-emerald-600 text-white shadow-(--elev-1)'
          : 'bg-hexxa-forest hover:brightness-110 text-hexxa-lime shadow-(--elev-1)'
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado!' : label}
    </button>
  );
}

// ── EmitirDasBtn ──────────────────────────────────────────────────────────────

const PGMEI_BASE =
  'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao';

/**
 * Leva o MEI ao PGMEI para emitir o DAS.
 *
 * ── Por que é um LINK e não um botão que emite ──────────────────────────
 *
 * A versão anterior prometia emitir o DAS aqui dentro, chamando uma rota que
 * raspava o PGMEI. Duas coisas a impediam de funcionar, e as duas foram
 * verificadas:
 *
 *   1. A rota chamada (`/api/pgmei/das`) NÃO EXISTE — respondia 404, então o
 *      cliente via um erro vermelho em toda tentativa.
 *
 *   2. Mesmo a rota que existe (`/api/das`) não podia funcionar: o PGMEI é
 *      protegido por hCaptcha invisível. O POST de emissão volta 302 para a
 *      tela de identificação sem o token do captcha.
 *
 * Captcha existe justamente para impedir automação, e contorná-lo não é
 * opção. Então a tela passa a dizer a verdade: o DAS do MEI se emite no
 * portal da Receita, e daqui sai o atalho com o CNPJ já preenchido.
 */
function EmitirDasBtn({ competencia, cnpj }: { competencia: string; cnpj: string }) {
  const so = cnpj.replace(/\D/g, '');
  const pa = competencia.includes('/')
    ? `${competencia.split('/')[1]}${(competencia.split('/')[0] ?? '').padStart(2, '0')}`
    : competencia;

  return (
    <div className="flex flex-col gap-1.5">
      <a
        href={`${PGMEI_BASE}?cnpj=${so}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#B8D7E3] hover:brightness-105 text-[#162832] shadow-(--elev-1) px-3.5 py-1.5 text-xs font-bold active:scale-95 transition-all"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Emitir DAS no portal da Receita
      </a>
      <p className="text-xs text-ink-soft">
        O portal da Receita pede uma verificação de segurança, então a emissão é feita lá.
        Seu CNPJ já vai preenchido — escolha a competência {pa} e baixe a guia.
      </p>
    </div>
  );
}

// ── Form Nova Guia ────────────────────────────────────────────────────────────

const field =
  'w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-[#B8D7E3] transition-all';
const lbl = 'text-caption font-bold text-ink-soft tracking-wider uppercase';

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
    const anexo = fd.get('anexo') as File | null;
    const res = await registrarGuiaAction({
      taxName: `${CAT_CONFIG[tipo as GuiaCategoria]?.label ?? tipo} — ${descricao}`,
      referenceMonth,
      dueDate,
      amount: Number(String(fd.get('valor') ?? '0').replace(',', '.')),
      pixCode: String(fd.get('pix') ?? '').trim() || null,
      anexo: anexo && anexo.size > 0 ? anexo : null,
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
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-2) p-6 space-y-4 card-finish animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-ink">Registrar Nova Guia</p>
        <button type="button" onClick={onClose} className="tap-target pressable focusable rounded-full p-1.5 text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
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
        <div className="sm:col-span-2">
          <label className={lbl}>PDF da Guia (opcional)</label>
          <input name="anexo" type="file" accept="application/pdf,image/*" className={`mt-1.5 ${field} file:mr-3 file:rounded-full file:border-0 file:bg-hexxa-forest/15 file:px-3.5 file:py-1.5 file:text-xs file:font-bold file:text-hexxa-forest dark:file:bg-hexxa-lime/15 dark:file:text-hexxa-lime cursor-pointer`} />
          <p className="mt-1 text-caption text-ink-soft">Sobe o PDF que você baixou do OneFlow/Omie (ou de onde for) — máx. 4MB.</p>
        </div>
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="tap-target pressable focusable inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 text-hexxa-lime shadow-(--elev-1) active:scale-95 px-5 py-2.5 text-xs font-bold transition-all disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar Guia
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-4 py-2.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
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

export function HubGuias({ initial, insightSlot }: { initial: Guia[]; insightSlot?: React.ReactNode }) {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
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

  // Filtro por mês/competência
  const guiasDoMes = guiasAvulsas.filter((g) => {
    if (selectedMonth === 'all') return true;
    const refM = g.referenceMonth ? g.referenceMonth.slice(0, 7) : '';
    const dueM = g.dueDate ? g.dueDate.slice(0, 7) : '';
    return refM === selectedMonth || dueM === selectedMonth;
  });

  const filtered = guiasDoMes.filter(
    (g) =>
      (catFilter === 'todas' || categoriaDe(g.taxName) === catFilter) &&
      (statusFilter === 'todas' || g.status === statusFilter),
  );

  const pendentes = guiasDoMes.filter((g) => g.status === 'OPEN');
  const vencidas = guiasDoMes.filter((g) => g.status === 'OVERDUE');
  const pagas = guiasDoMes.filter((g) => g.status === 'PAID');

  const totalAberto = [...pendentes, ...vencidas].reduce((s, g) => s + g.amount, 0);
  const totalVencido = vencidas.reduce((s, g) => s + g.amount, 0);
  const totalPago = pagas.reduce((s, g) => s + g.amount, 0);

  const monthLabel = getMonthLabel(selectedMonth);
  const isCurrentMonth = selectedMonth === currentMonthStr;

  const [isDismissed, setIsDismissed] = useState(true);

  const isOverdue = vencidas.length > 0;
  const isUpcoming = !isOverdue && pendentes.length > 0;
  const isOk = !isOverdue && !isUpcoming;

  const overdueHeadline = vencidas.length > 0
    ? `${vencidas[0]?.taxName ?? 'Guia'} (${BRL.format(vencidas[0]?.amount ?? 0)}) venceu ${fmtDate(vencidas[0]?.dueDate ?? '')}`
    : undefined;

  const upcomingHeadline = pendentes.length > 0
    ? `${pendentes[0]?.taxName ?? 'Guia'} (${BRL.format(pendentes[0]?.amount ?? 0)}) vence ${fmtDate(pendentes[0]?.dueDate ?? '')}`
    : undefined;

  const currentStatusConfig = isOverdue
    ? {
        badgeLabel: vencidas.length === 1 ? '1 guia em atraso' : `${vencidas.length} guias em atraso`,
        headline: overdueHeadline || (vencidas.length === 1 ? 'Guia com vencimento ultrapassado' : `${vencidas.length} guias em atraso`),
        prefixColor: 'text-rose-600 dark:text-rose-400',
        detail: 'Regularize o quanto antes para evitar acréscimo de multas e juros de mora.',
        tagClass: 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25',
        dotClass: 'bg-rose-500 animate-pulse',
      }
    : isUpcoming
    ? {
        badgeLabel: pendentes.length === 1 ? '1 guia a vencer' : `${pendentes.length} guias a vencer`,
        headline: upcomingHeadline || (pendentes.length === 1 ? 'Guia próxima do vencimento' : `${pendentes.length} guias a vencer`),
        prefixColor: 'text-amber-700 dark:text-amber-400',
        detail: 'Código Pix copia e cola e linha digitável disponíveis para pagamento.',
        tagClass: 'bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
        dotClass: 'bg-amber-500',
      }
    : {
        badgeLabel: 'Tudo em dia',
        headline: 'Obrigações fiscais quitadas',
        prefixColor: 'text-emerald-700 dark:text-emerald-400',
        detail: 'Todas as guias e tributos deste mês estão apurados e pagos sem pendências.',
        tagClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
      };

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
  };

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const planos = new Map<string, Guia[]>();
  for (const g of guias) {
    if (!g.installmentGroupId) continue;
    const arr = planos.get(g.installmentGroupId) ?? [];
    arr.push(g);
    planos.set(g.installmentGroupId, arr);
  }

  return (
    <div className="space-y-16">
      {/* Hero Card da Central de Guias com Título e Seletor Harmônico de Mês */}
      <GuiasHero
        selectedMonth={selectedMonth}
        monthLabel={monthLabel}
        isCurrentMonth={isCurrentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onCurrentMonth={handleCurrentMonth}
        rightSlot={
          <div className="shrink-0 flex items-center justify-end">
            {isOk ? (
              <span className="focus-hide-ok-tag inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 text-xs font-bold shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Tudo em dia
              </span>
            ) : isDismissed ? (
              <button
                type="button"
                onClick={() => setIsDismissed(false)}
                title="Clique para ver os detalhes da pendência"
                className={`tap-target pressable focusable group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer ${currentStatusConfig.tagClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${currentStatusConfig.dotClass}`} />
                <span>{currentStatusConfig.badgeLabel}</span>
                <span className="text-[11px] font-normal opacity-60 group-hover:opacity-100 transition-opacity ml-0.5">
                  · Ver detalhes
                </span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl sm:rounded-full bg-surface-card border border-black/5 dark:border-white/10 px-4 py-1.5 shadow-(--elev-inset) animate-in fade-in">
                <span className={`font-bold text-xs ${currentStatusConfig.prefixColor}`}>
                  Aviso:
                </span>
                <span className="font-semibold text-xs text-ink">
                  {currentStatusConfig.headline}
                </span>
                <span className="text-xs text-ink-soft hidden lg:inline">
                  — {currentStatusConfig.detail}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  title="Ocultar detalhes e exibir apenas a tag"
                  className="tap-target pressable focusable inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft hover:text-ink px-2 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer ml-1"
                >
                  <EyeOff className="h-3 w-3" />
                  <span>Ocultar</span>
                </button>
              </div>
            )}
          </div>
        }
      />

      {insightSlot}

      {/* Selector de Abas Principais + Ação Primária + Informações de Status/Aviso das Guias à Direita */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset)">
            <button
              type="button"
              onClick={() => setMainTab('guias')}
              className={`tap-target pressable focusable inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                mainTab === 'guias'
                  ? 'bg-surface text-ink shadow-(--elev-1)'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" /> Guias & Impostos
            </button>
            <button
              type="button"
              onClick={() => setMainTab('timeline')}
              className={`tap-target pressable focusable inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                mainTab === 'timeline'
                  ? 'bg-surface text-ink shadow-(--elev-1)'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" /> Linha do Tempo & Alertas
            </button>
            <button
              type="button"
              onClick={() => setMainTab('parcelamentos')}
              className={`tap-target pressable focusable inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                mainTab === 'parcelamentos'
                  ? 'bg-surface text-ink shadow-(--elev-1)'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Parcelamentos {planos.size > 0 ? `(${planos.size})` : ''}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="tap-target pressable focusable inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 text-hexxa-lime shadow-(--elev-1) active:scale-95 px-5 py-2 text-xs font-bold transition-all"
          >
            <Plus className="h-4 w-4" /> Registrar Guia
          </button>
        </div>

        {/* Lado Direito: Seletor Harmônico de Mês */}
        <div className="shrink-0 flex items-center justify-end gap-1.5">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mês anterior"
              className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 px-1.5 py-1 text-xs sm:text-sm font-bold text-ink capitalize tracking-tight select-none">
              <Calendar className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime shrink-0" />
              <span>{monthLabel}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Próximo mês"
              className="tap-target pressable focusable grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleCurrentMonth}
              title="Voltar ao mês atual"
              className="tap-target pressable focusable inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-hexxa-forest dark:text-hexxa-lime hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              Mês atual
            </button>
          )}
        </div>
      </div>

      {mainTab === 'timeline' && (
        <div className="space-y-4 animate-in fade-in">
          <Card level={1} className="p-6 sm:p-8 space-y-5 card-finish">
            <h2 className="font-serif font-bold text-xl text-ink flex items-center gap-2">
              <Calendar className="h-5 w-5 text-hexxa-forest dark:text-hexxa-lime" />
              Linha do Tempo das Obrigações do Mês
            </h2>
            <p className="text-xs sm:text-sm text-ink-soft">
              Acompanhe o cronograma exato de vencimentos e obrigações fiscais para evitar multas e juros.
            </p>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-black/10 dark:before:bg-white/10">
              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Dia 07 do Mês</span>
                    <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold">
                      Concluído
                    </span>
                  </div>
                  <p className="text-sm font-bold text-ink">Pagamento de FGTS & Pró-labore</p>
                  <p className="text-xs text-ink-soft">
                    Recolhimento do FGTS dos funcionários e retenção do pró-labore dos sócios.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Dia 20 do Mês (Próximo Vencimento)</span>
                    <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold">
                      Aguardando Pagamento
                    </span>
                  </div>
                  <p className="text-sm font-bold text-ink">Guia Unificada do Simples Nacional (DAS)</p>
                  <p className="text-xs text-ink-soft">
                    Imposto mensal apurado sobre o faturamento do mês anterior. Confira a alíquota na Bússola Tributária.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-hexxa-forest/60 dark:bg-hexxa-lime/60 ring-4 ring-hexxa-forest/15 dark:ring-hexxa-lime/15" />
                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-hexxa-forest dark:text-hexxa-lime">Dia 30 do Mês</span>
                    <span className="rounded-full bg-black/5 dark:bg-white/10 text-ink-soft px-2.5 py-0.5 text-[10px] font-bold">
                      Agendado
                    </span>
                  </div>
                  <p className="text-sm font-bold text-ink">Fechamento Contábil & Envio de Extratos</p>
                  <p className="text-xs text-ink-soft">
                    Consolidação automática das notas fiscais emitidas e despesas para apuração contábil.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {mainTab === 'parcelamentos' && (
        <div className="space-y-4 animate-in fade-in">
          {planos.size === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
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
                <Card key={groupId} level={1} className="overflow-hidden card-finish">
                  <div className="p-6 sm:p-8 border-b border-black/5 dark:border-white/10 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-serif font-bold text-lg text-ink">{desc}</h2>
                        <p className="text-xs sm:text-sm text-ink-soft mt-0.5">
                          {pagas} de {total} parcelas pagas · restam <span className="font-serif tabular font-semibold text-ink">{BRL.format(restante)}</span>
                        </p>
                      </div>
                      {proxima && (
                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Próxima parcela</p>
                          <p className={`text-sm font-serif tabular font-bold ${vencClass(proxima.dueDate, proxima.status)}`}>{fmtDate(proxima.dueDate)} · {BRL.format(proxima.amount)}</p>
                        </div>
                      )}
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div className="h-full rounded-full bg-hexxa-forest dark:bg-hexxa-lime transition-[width] duration-700 ease-out" style={{ width: `${(pagas / total) * 100}%` }} />
                    </div>
                    <p className="text-xs text-ink-soft">Valor total do plano: <strong className="font-serif tabular text-ink">{BRL.format(totalValor)}</strong></p>
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
                            className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <span className="w-14 shrink-0 text-xs font-bold text-ink-soft">{p.installmentNumber}/{p.installmentCount}</span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs sm:text-sm font-bold ${vencClass(p.dueDate, p.status)}`}>{p.status === 'PAID' ? 'Paga' : `Vence ${fmtDate(p.dueDate)}`}</p>
                            </div>
                            <span className="shrink-0 text-sm font-serif tabular font-bold text-ink">{BRL.format(p.amount)}</span>
                            <span className={`hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${st.cls}`}>
                              <StatusIcon className="h-3 w-3" /> {st.label}
                            </span>
                            {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                          </button>
                          {isExp && (
                            <div className="mx-5 mb-4 flex flex-wrap gap-2 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4">
                              {p.pixCode && <CopyBtn text={p.pixCode} />}
                              {p.fileUrl && (
                                <a
                                  href={p.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
                                >
                                  <Download className="h-3.5 w-3.5" /> Baixar Guia
                                </a>
                              )}
                              {p.status !== 'PAID' && (
                                <button
                                  type="button"
                                  onClick={() => markPaid(p.id)}
                                  className="tap-target pressable focusable inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-4 py-2 text-xs font-bold hover:bg-emerald-500/25 transition-colors"
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
                </Card>
              );
            })
          )}
        </div>
      )}

      {mainTab === 'guias' && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card level={1} className="card-finish p-6 sm:p-7 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-caption font-bold text-ink-soft">Total a Pagar</p>
                  <p className="mt-1 font-serif font-bold text-2xl sm:text-3xl text-ink tabular">{BRL.format(totalAberto)}</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
                <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 text-[11px] font-bold">
                  {pendentes.length + vencidas.length} guia(s)
                </span>
                <span>no período selecionado</span>
              </div>
            </Card>

            <Card level={1} className={`p-6 sm:p-7 card-finish flex flex-col justify-between ${
              vencidas.length > 0 ? 'border-rose-500/30' : ''
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-caption font-bold text-ink-soft">Guias em Atraso</p>
                  <p className={`mt-1 font-serif font-bold text-2xl sm:text-3xl tabular ${vencidas.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink'}`}>
                    {BRL.format(totalVencido)}
                  </p>
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-full shrink-0 ${
                  vencidas.length > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-surface text-ink-soft shadow-(--elev-inset)'
                }`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  vencidas.length > 0 ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {vencidas.length > 0 ? `${vencidas.length} guia(s) vencida(s)` : 'Nenhuma pendência'}
                </span>
                <span>{vencidas.length > 0 ? 'ação imediata' : 'regularidade fiscal'}</span>
              </div>
            </Card>

            <Card
              tone={pagas.length > 0 && vencidas.length === 0 ? "forest" : "default"}
              level={1}
              className="p-6 sm:p-7 card-finish flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-caption font-bold ${pagas.length > 0 && vencidas.length === 0 ? 'text-white/75' : 'text-ink-soft'}`}>
                    Total Quitado
                  </p>
                  <p className={`mt-1 font-serif font-bold text-2xl sm:text-3xl tabular ${
                    pagas.length > 0 && vencidas.length === 0 ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {BRL.format(totalPago)}
                  </p>
                </div>
                {pagas.length > 0 && vencidas.length === 0 ? (
                  <div className="w-12 h-8 flex items-center justify-end shrink-0">
                    <svg className="w-10 h-6 text-[#DFFFAE]" viewBox="0 0 50 20" fill="none">
                      <path d="M 0 15 Q 12 5, 25 12 T 50 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className={`mt-4 flex items-center gap-2 text-xs ${pagas.length > 0 && vencidas.length === 0 ? 'text-white/80' : 'text-ink-soft'}`}>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  pagas.length > 0 && vencidas.length === 0 ? 'bg-white/15 text-white' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {pagas.length} guia(s) paga(s)
                </span>
                <span>comprovantes arquivados</span>
              </div>
            </Card>
          </div>

          {/* Unified Filters Toolbar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pt-1">
            <div className="overflow-x-auto no-scrollbar py-0.5">
              <SegmentedTabs
                tabs={cats.map((c) => ({
                  id: c.key,
                  label: `${c.label} ${c.key !== 'todas' ? `(${guiasDoMes.filter((g) => categoriaDe(g.taxName) === c.key).length})` : `(${guiasDoMes.length})`}`,
                }))}
                activeTab={catFilter}
                onChange={setCatFilter}
                layoutId="guiasCatIndicator"
                size="sm"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
              <div className="inline-flex items-center gap-1 p-1 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset)">
                <span className="pl-2 pr-0.5">
                  <Filter className="h-3 w-3 text-ink-soft" />
                </span>
                {statuses.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    className={`tap-target pressable focusable rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      statusFilter === s.key
                        ? 'border border-black/5 dark:border-white/5 bg-surface text-ink shadow-(--elev-inset)'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
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
              className="tap-target pressable focusable inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {cnpjMei ? `CNPJ Configurado: ${cnpjMei}` : 'Configurar CNPJ para emissão rápida de DAS'}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-3">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-ink-soft" />
              <input
                value={cnpjInput}
                onChange={(e) => setCnpjInput(normalizeDocument(e.target.value).slice(0, 14))}
                placeholder="CNPJ (14 caracteres, sem pontuação)"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
              />
              <button
                type="button"
                onClick={() => {
                  setCnpjMei(normalizeDocument(cnpjInput));
                  setShowCnpjConfig(false);
                }}
                className="tap-target pressable focusable rounded-full bg-hexxa-forest hover:brightness-110 text-hexxa-lime shadow-(--elev-1) active:scale-95 px-4 py-1.5 text-xs font-bold transition-all"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setShowCnpjConfig(false)}
                className="tap-target pressable focusable rounded-full p-1 text-ink-soft hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Guide list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
              <Receipt className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                Nenhuma guia encontrada para {monthLabel}
                {catFilter !== 'todas' ? ` na categoria ${catFilter}` : ''}
                {statusFilter !== 'todas' ? ` com status ${statusFilter}` : ''}.
              </p>
              {selectedMonth !== 'all' && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth('all')}
                    className="tap-target pressable focusable text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline cursor-pointer"
                  >
                    Ver guias de todos os períodos
                  </button>
                  {!isCurrentMonth && (
                    <>
                      <span className="text-xs text-ink-soft">·</span>
                      <button
                        type="button"
                        onClick={handleCurrentMonth}
                        className="tap-target pressable focusable text-xs font-bold text-ink hover:underline cursor-pointer"
                      >
                        Voltar a {getMonthLabel(currentMonthStr)}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
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
                      className="group flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${cat.cls}`}>{cat.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{g.taxName}</p>
                        <p className="text-xs text-ink-soft">Competência: {competencia}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-serif tabular font-bold text-ink">{BRL.format(g.amount)}</p>
                        <p className={`text-[11px] sm:text-xs ${vencClass(g.dueDate, g.status)}`}>
                          <Calendar className="mr-1 inline h-3 w-3" />
                          {g.status === 'PAID' ? 'Paga' : `Vence ${fmtDate(g.dueDate)}`}
                        </p>
                      </div>
                      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${st.cls}`}>
                        <StatusIcon className="h-3 w-3" />
                        {st.label}
                      </span>

                      {/* Ações Rápidas direto na linha (1 clique para Pix ou Baixar) */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {g.status !== 'PAID' && g.pixCode && (
                          <button
                            type="button"
                            title="Copiar Pix Copia e Cola"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(g.pixCode!);
                              setCopiedId(g.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className={`tap-target pressable focusable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                              copiedId === g.id
                                ? 'bg-emerald-600 text-white shadow-(--elev-1)'
                                : 'bg-hexxa-forest/10 hover:bg-hexxa-forest hover:text-hexxa-lime text-hexxa-forest dark:bg-hexxa-lime/15 dark:hover:bg-hexxa-lime dark:hover:text-[#1E3328] dark:text-hexxa-lime'
                            }`}
                          >
                            {copiedId === g.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span className="hidden md:inline">{copiedId === g.id ? 'Copiado!' : 'Pix'}</span>
                          </button>
                        )}
                        {g.fileUrl && (
                          <a
                            href={g.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Baixar Guia (PDF)"
                            onClick={(e) => e.stopPropagation()}
                            className="tap-target pressable focusable inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-surface-card text-ink-soft hover:text-ink shadow-(--elev-1) transition-all"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="shrink-0 p-1 text-ink-soft group-hover:text-ink transition-colors">
                        {isExp ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {isExp && (
                      <div className="mx-5 mb-4 space-y-4 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-5">
                        <div className="grid gap-3 sm:grid-cols-3 text-sm">
                          <div>
                            <p className={lbl}>Valor da Guia</p>
                            <p className="font-serif tabular font-bold text-base text-ink">{BRL.format(g.amount)}</p>
                          </div>
                          <div>
                            <p className={lbl}>Vencimento</p>
                            <p className={`font-bold ${vencClass(g.dueDate, g.status)}`}>{fmtDate(g.dueDate)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {/*
                            Guia sem Pix e sem arquivo existe de verdade: a
                            importação do OneFlow traz o VALOR apurado antes de
                            o arquivo da guia ficar pronto lá. Sem esta linha o
                            cliente vê a cobrança, não vê como pagar, e a única
                            coisa clicável é "Marcar como Paga" — que o levaria
                            a marcar como paga uma guia que ele não pagou.
                          */}
                          {!g.pixCode && !g.fileUrl && g.status !== 'PAID' && (
                            <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                              Valor já apurado pela contabilidade. O arquivo para pagamento ainda
                              não foi liberado — assim que ele sair, o Pix e o PDF aparecem aqui.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {g.pixCode && <CopyBtn text={g.pixCode} />}
                            {g.fileUrl && (
                              <a
                                href={g.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" /> Baixar Guia
                              </a>
                            )}
                            {g.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => markPaid(g.id)}
                                className="tap-target pressable focusable inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-4 py-2 text-xs font-bold hover:bg-emerald-500/25 transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Paga
                              </button>
                            )}
                          </div>
                          {categoria === 'DAS' &&
                            (cnpjMei ? (
                              <EmitirDasBtn competencia={competencia} cnpj={cnpjMei} />
                            ) : (
                              <p className="text-xs text-ink-soft">
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

