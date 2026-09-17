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
import { Card } from '@/components/ui/Card';

// ── Types ─────────────────────────────────────────────────────────────────────

type GuiaStatus = TaxGuideStatusValue;
type Guia = TaxGuideRecord;

// ── Config ────────────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<GuiaCategoria, { label: string; cls: string }> = {
  DAS:          { label: 'DAS',          cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C]/40 dark:text-[#DFFFAE] border border-[#2F4A3C]/10 dark:border-[#DFFFAE]/20' },
  DARF:         { label: 'DARF',         cls: 'bg-[#D8DDD6] text-[#231F20] dark:bg-white/10 dark:text-[#F5F6F4] border border-black/5 dark:border-white/10' },
  ISS:          { label: 'ISS',          cls: 'bg-[#DCE7EB] text-[#23434E] dark:bg-[#A2C1CD]/15 dark:text-[#A2C1CD] border border-[#A2C1CD]/30' },
  PARCELAMENTO: { label: 'Parcelamento', cls: 'bg-[#E7EAE5] text-[#6E6A61] dark:bg-[#1A201C] dark:text-[#A8A49C] border border-black/5 dark:border-white/10' },
  FGTS:         { label: 'FGTS',         cls: 'bg-[#E2EDE5] text-[#1E3328] dark:bg-[#1E3328]/50 dark:text-[#DFFFAE] border border-[#2F4A3C]/20' },
  DIVERSA:      { label: 'Diversa',      cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C] border border-black/5 dark:border-white/10' },
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
  if (status === 'PAID') return 'text-ink-soft';
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'text-red-600 dark:text-red-400 font-bold';
  if (days <= 5) return 'text-amber-600 dark:text-amber-400 font-bold';
  return 'text-ink-soft';
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copiar Pix' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) px-3.5 py-1.5 text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
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
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) px-3.5 py-1.5 text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
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
  'w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
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
          <input name="anexo" type="file" accept="application/pdf,image/*" className={`mt-1.5 ${field} file:mr-3 file:rounded-full file:border-0 file:bg-hexxa-forest file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-hexxa-lime`} />
          <p className="mt-1 text-caption text-ink-soft">Sobe o PDF que você baixou do OneFlow/Omie (ou de onde for) — máx. 4MB.</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold transition-all disabled:opacity-60"
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
              ? 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)'
              : 'border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) text-ink-soft hover:text-ink'
          }`}
        >
          <Receipt className="h-3.5 w-3.5" /> Guias & Impostos
        </button>
        <button
          type="button"
          onClick={() => setMainTab('timeline')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all ${
            mainTab === 'timeline'
              ? 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)'
              : 'border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) text-ink-soft hover:text-ink'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" /> Linha do Tempo & Alertas
        </button>
        <button
          type="button"
          onClick={() => setMainTab('parcelamentos')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all ${
            mainTab === 'parcelamentos'
              ? 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)'
              : 'border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) text-ink-soft hover:text-ink'
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Parcelamentos {planos.size > 0 ? `(${planos.size})` : ''}
        </button>
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
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-hexxa-forest dark:bg-hexxa-lime ring-4 ring-hexxa-forest/20 dark:ring-hexxa-lime/20" />
                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-hexxa-forest dark:text-hexxa-lime">Dia 30 do Mês</span>
                    <span className="rounded-full bg-hexxa-forest text-hexxa-lime px-2.5 py-0.5 text-[10px] font-bold shadow-(--elev-inset)">
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
                            className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
                                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
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
            <Card level={1} className="card-finish p-6">
              <div className="flex items-start justify-between">
                <p className="text-caption font-bold text-ink-soft uppercase tracking-wider">Total em Aberto</p>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-amber-600 dark:text-amber-400 tabular">{BRL.format(totalAberto)}</p>
              <p className="mt-1 text-caption text-ink-soft">{pendentes.length + vencidas.length} guia(s) a pagar</p>
            </Card>

            <Card level={1} className={`p-6 card-finish ${
              vencidas.length > 0 ? 'border-red-500/30' : ''
            }`}>
              <div className="flex items-start justify-between">
                <p className="text-caption font-bold text-ink-soft uppercase tracking-wider">Em Atraso</p>
                <div className={`p-2 rounded-xl ${vencidas.length > 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-surface-card shadow-(--elev-inset) text-ink-soft'}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <p className={`mt-3 font-serif font-bold text-2xl sm:text-3xl tabular ${vencidas.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-ink'}`}>
                {BRL.format(totalVencido)}
              </p>
              <p className="mt-1 text-caption text-ink-soft">{vencidas.length} guia(s) vencida(s)</p>
            </Card>

            <Card level={1} className="card-finish p-6">
              <div className="flex items-start justify-between">
                <p className="text-caption font-bold text-ink-soft uppercase tracking-wider">Total Pago</p>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(totalPago)}</p>
              <p className="mt-1 text-caption text-ink-soft">{pagas.length} guia(s) quitada(s)</p>
            </Card>
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
              <div className="inline-flex items-center gap-1 p-1 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset)">
                <span className="pl-2 pr-1">
                  <Filter className="h-3.5 w-3.5 text-ink-soft" />
                </span>
                {statuses.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      statusFilter === s.key
                        ? 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold transition-all"
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition-colors"
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
                className="rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) px-4 py-1.5 text-xs font-bold hover:brightness-110"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setShowCnpjConfig(false)}
                className="rounded-full p-1 text-ink-soft hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Guide list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
              <Receipt className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma guia encontrada com este filtro.</p>
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
                      className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cat.cls}`}>{cat.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{g.taxName}</p>
                        <p className="text-xs text-ink-soft">Competência: {competencia}</p>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-sm font-serif tabular font-bold text-ink">{BRL.format(g.amount)}</p>
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
                        <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />
                      )}
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
                                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
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

