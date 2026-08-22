'use client';

import { useState } from 'react';
import { Receipt, Copy, Check, CheckCircle, Clock, Warning, CaretDown, CaretUp, Plus, X, DownloadSimple, CalendarBlank, CurrencyDollar, Funnel, Spinner, ArrowSquareOut, Faders } from '@phosphor-icons/react';
import type { TaxGuideRecord, TaxGuideStatusValue } from '@hexxa/db';
import { registrarGuiaAction, marcarGuiaPagaAction } from './actions';
import { categoriaDe, type GuiaCategoria } from '@/lib/guias';

// ── Types ─────────────────────────────────────────────────────────────────────

type GuiaStatus = TaxGuideStatusValue;
type Guia = TaxGuideRecord;

// ── Config ────────────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<GuiaCategoria, { label: string; cls: string }> = {
  DAS:          { label: 'DAS',          cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400' },
  DARF:         { label: 'DARF',         cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  ISS:          { label: 'ISS',          cls: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  PARCELAMENTO: { label: 'Parcelamento', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  FGTS:         { label: 'FGTS',         cls: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  DIVERSA:      { label: 'Diversa',      cls: 'bg-ink/10 text-ink-soft' },
};

const STATUS_CONFIG: Record<GuiaStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  OPEN:     { label: 'Pendente',  cls: 'bg-warn/10 text-warn',          icon: Clock },
  PAID:     { label: 'Paga',      cls: 'bg-ok/10 text-ok',              icon: CheckCircle },
  OVERDUE:  { label: 'Em atraso', cls: 'bg-critical/10 text-critical', icon: Warning },
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
  if (days < 0) return 'text-critical font-medium';
  if (days <= 5) return 'text-warn font-medium';
  return 'text-ink-soft';
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copiar Pix' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
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
      <div className="flex flex-col gap-2 rounded-xl border border-ok/20 bg-ok/5 p-3">
        <p className="text-xs font-semibold text-ok">DAS emitido — linha digitável</p>
        <p className="break-all font-mono text-xs text-ink">{state.linhaDigitavel}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(state.linhaDigitavel)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400">
            {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado!' : 'Copiar linha'}
          </button>
          {state.pgmeiUrl && (
            <a href={state.pgmeiUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-ink/10">
              <ArrowSquareOut className="h-3.5 w-3.5" /> Abrir no PGMEI
            </a>
          )}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-critical/20 bg-critical/5 p-3">
        <p className="text-xs text-critical">{state.msg}</p>
        <div className="flex flex-wrap gap-2">
          {state.pgmeiUrl && (
            <a href={state.pgmeiUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-ink/10">
              <ArrowSquareOut className="h-3.5 w-3.5" /> Emitir no portal do governo
            </a>
          )}
          <button type="button" onClick={() => setState({ status: 'idle' })}
            className="text-xs text-ink-soft underline">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={emitir} disabled={!cnpj || state.status === 'loading'}
      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400 disabled:opacity-50">
      {state.status === 'loading'
        ? <><Spinner className="h-3.5 w-3.5 animate-spin" /> Emitindo…</>
        : <><DownloadSimple className="h-3.5 w-3.5" /> Emitir DAS</>}
    </button>
  );
}

// ── Nova Guia Form ────────────────────────────────────────────────────────────

const field = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

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
    if ('error' in res) { setError(res.error!); return; }
    onAdded();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Registrar guia</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>Tipo</label>
          <select name="categoria" className={`mt-1 ${field}`}>
            <option value="DAS">DAS — Simples Nacional</option>
            <option value="DARF">DARF — Federal</option>
            <option value="ISS">ISS — Municipal</option>
            <option value="PARCELAMENTO">Parcelamento</option>
            <option value="FGTS">FGTS</option>
            <option value="DIVERSA">Guia Diversa</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Competência</label>
          <input name="competencia" required placeholder="MM/AAAA" pattern="\d{2}/\d{4}" className={`mt-1 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição</label>
          <input name="descricao" required placeholder="Ex.: Simples Nacional — junho/2026" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Vencimento</label>
          <input name="vencimento" type="date" required className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Valor (R$)</label>
          <input name="valor" inputMode="decimal" required placeholder="0,00" className={`mt-1 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Código Pix (opcional)</label>
          <input name="pix" placeholder="Cole aqui o código Pix real obtido no portal/guia (não geramos código automaticamente)" className={`mt-1 ${field}`} />
        </div>
      </div>
      {error && <p className="text-xs text-critical">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {submitting ? <Spinner className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
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

  const filtered = guias.filter(g =>
    (catFilter === 'todas' || categoriaDe(g.taxName) === catFilter) &&
    (statusFilter === 'todas' || g.status === statusFilter),
  );

  const pendentes = guias.filter(g => g.status === 'OPEN');
  const vencidas  = guias.filter(g => g.status === 'OVERDUE');
  const pagas     = guias.filter(g => g.status === 'PAID');

  const totalAberto  = [...pendentes, ...vencidas].reduce((s, g) => s + g.amount, 0);
  const totalVencido = vencidas.reduce((s, g) => s + g.amount, 0);
  const totalPago    = pagas.reduce((s, g) => s + g.amount, 0);

  async function refetch() {
    const res = await fetch('/api/guias');
    if (res.ok) setGuias(await res.json());
  }

  async function markPaid(id: string) {
    setGuias(prev => prev.map(g => g.id === id ? { ...g, status: 'PAID' as GuiaStatus } : g));
    await marcarGuiaPagaAction(id);
  }

  const cats: { key: CatFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'DAS', label: 'DAS' },
    { key: 'DARF', label: 'DARF' },
    { key: 'ISS', label: 'ISS' },
    { key: 'PARCELAMENTO', label: 'Parcelamentos' },
    { key: 'FGTS', label: 'FGTS' },
    { key: 'DIVERSA', label: 'Diversas' },
  ];

  const statuses: { key: StatusFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'OPEN', label: 'Pendentes' },
    { key: 'OVERDUE', label: 'Em atraso' },
    { key: 'PAID', label: 'Pagas' },
  ];

  const [mainTab, setMainTab] = useState<'guias' | 'timeline' | 'certidoes'>('guias');

  return (
    <div className="space-y-5">
      {/* Selector de Abas Principais */}
      <div className="flex gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setMainTab('guias')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            mainTab === 'guias' ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:text-ink'
          }`}
        >
          📄 Guias & Impostos
        </button>
        <button
          type="button"
          onClick={() => setMainTab('timeline')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            mainTab === 'timeline' ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:text-ink'
          }`}
        >
          📅 Linha do Tempo & Alertas
        </button>
        <button
          type="button"
          onClick={() => setMainTab('certidoes')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            mainTab === 'certidoes' ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:text-ink'
          }`}
        >
          🛡️ Certidões Negativas (CNDs)
        </button>
      </div>

      {mainTab === 'timeline' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="rounded-2xl border border-line bg-surface-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              <CalendarBlank className="h-5 w-5 text-brand-500" />
              Linha do Tempo das Obrigações do Mês
            </h2>
            <p className="text-xs text-ink-soft">
              Acompanhe o cronograma exato de vencimentos e obrigações fiscais para evitar multas de mora.
            </p>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <div className="rounded-xl border border-line bg-black/5 dark:bg-white/5 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Dia 07 do Mês</span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500">Concluído</span>
                  </div>
                  <p className="text-sm font-semibold text-ink">Pagamento de FGTS & Pro-labore</p>
                  <p className="text-xs text-ink-soft">Recolhimento do FGTS dos funcionários e retenção do pro-labore dos sócios.</p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-warn ring-4 ring-warn/20" />
                <div className="rounded-xl border border-line bg-black/5 dark:bg-white/5 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-warn">Dia 20 do Mês (Próximo Vencimento)</span>
                    <span className="rounded-full bg-warn/10 px-2.5 py-0.5 text-[10px] font-bold text-warn">Aguardando Pagamento</span>
                  </div>
                  <p className="text-sm font-semibold text-ink">Guia Unificada do Simples Nacional (DAS)</p>
                  <p className="text-xs text-ink-soft">Imposto mensal sobre o faturamento do mês anterior. Confira a alíquota efetiva no Termômetro Tributário.</p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-500/20" />
                <div className="rounded-xl border border-line bg-black/5 dark:bg-white/5 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-500">Dia 30 do Mês</span>
                    <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-500">Agendado</span>
                  </div>
                  <p className="text-sm font-semibold text-ink">Fechamento Contábil & Envio de Extratos</p>
                  <p className="text-xs text-ink-soft">Consolidação automática das notas fiscais emitidas e despesas para a contabilidade.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'certidoes' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="rounded-2xl border border-line bg-surface-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-ink">Certidões Negativas de Débito (CNDs)</h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  A consulta automática de CNDs ainda não está integrada ao sistema. Emita direto nos portais oficiais abaixo.
                </p>
              </div>
              <span className="rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">
                ⚠️ Consulta manual
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-xl border border-line p-4 space-y-2 bg-black/5 dark:bg-white/5">
                <span className="text-xs font-semibold text-ink-soft">Federal / Receita</span>
                <p className="text-sm font-bold text-ink">CND Receita Federal & PGFN</p>
                <p className="text-xs text-ink-soft">Emissão conjunta pelo e-CAC ou portal Regularize (PGFN), com o CNPJ da empresa.</p>
              </div>

              <div className="rounded-xl border border-line p-4 space-y-2 bg-black/5 dark:bg-white/5">
                <span className="text-xs font-semibold text-ink-soft">Municipal / ISS</span>
                <p className="text-sm font-bold text-ink">CND Tributos Municipais</p>
                <p className="text-xs text-ink-soft">Emitida no portal da prefeitura do município onde a empresa está registrada — varia por cidade.</p>
              </div>

              <div className="rounded-xl border border-line p-4 space-y-2 bg-black/5 dark:bg-white/5">
                <span className="text-xs font-semibold text-ink-soft">Trabalhista / Caixa</span>
                <p className="text-sm font-bold text-ink">CRF / CND do FGTS</p>
                <p className="text-xs text-ink-soft">Emitida pelo Conectividade Social da Caixa, com o CNPJ da empresa.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'guias' && (
        <>
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-flat rounded-card p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-ink-soft">Total em aberto</p>
            <CurrencyDollar className="h-4 w-4 text-warn" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-warn">{BRL.format(totalAberto)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{pendentes.length + vencidas.length} guia(s)</p>
        </div>
        <div className={`rounded-card p-5 ${vencidas.length > 0 ? 'card-flat border border-critical/30' : 'card-flat'}`}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-ink-soft">Em atraso</p>
            <Warning className={`h-4 w-4 ${vencidas.length > 0 ? 'text-critical' : 'text-ink-soft'}`} />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${vencidas.length > 0 ? 'text-critical' : ''}`}>{BRL.format(totalVencido)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{vencidas.length} guia(s) vencida(s)</p>
        </div>
        <div className="card-flat rounded-card p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-ink-soft">Total pago</p>
            <CheckCircle className="h-4 w-4 text-ok" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-ok">{BRL.format(totalPago)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{pagas.length} guia(s)</p>
        </div>
      </div>

      {/* Filters + action */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {cats.map(c => (
            <button key={c.key} type="button" onClick={() => setCatFilter(c.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${catFilter === c.key ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
              {c.label} {c.key !== 'todas' ? `(${guias.filter(g => categoriaDe(g.taxName) === c.key).length})` : `(${guias.length})`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Funnel className="h-3.5 w-3.5 text-ink-soft" />
            {statuses.map(s => (
              <button key={s.key} type="button" onClick={() => setStatusFilter(s.key)}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === s.key ? 'bg-surface-card text-ink shadow-sm dark:bg-white dark:text-ink' : 'text-ink-soft hover:text-ink'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowForm(v => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Registrar guia
          </button>
        </div>
      </div>

      {showForm && <NovaGuiaForm onClose={() => setShowForm(false)} onAdded={refetch} />}

      {/* CNPJ MEI para emissão de DAS */}
      {!showCnpjConfig ? (
        <button type="button" onClick={() => { setShowCnpjConfig(true); setCnpjInput(cnpjMei); }}
          className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors">
          <Faders className="h-3.5 w-3.5" />
          {cnpjMei ? `CNPJ MEI: ${cnpjMei}` : 'Configurar CNPJ MEI para emissão de DAS'}
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-hover p-3">
          <Faders className="h-4 w-4 shrink-0 text-ink-soft" />
          <input
            value={cnpjInput}
            onChange={e => setCnpjInput(e.target.value.replace(/\D/g, '').slice(0, 14))}
            placeholder="CNPJ (14 dígitos, sem pontuação)"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft"
          />
          <button type="button"
            onClick={() => { setCnpjMei(cnpjInput.replace(/\D/g, '')); setShowCnpjConfig(false); }}
            className="rounded-xl bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600">
            Salvar
          </button>
          <button type="button" onClick={() => setShowCnpjConfig(false)}
            className="rounded-xl p-1 text-ink-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Guide list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <Receipt className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhuma guia encontrada com este filtro.</p>
        </div>
      ) : (
        <div className="card-flat rounded-card divide-y divide-line">
          {filtered.map(g => {
            const categoria = categoriaDe(g.taxName);
            const cat = CAT_CONFIG[categoria];
            const st = STATUS_CONFIG[g.status];
            const StatusIcon = st.icon;
            const isExp = expanded === g.id;
            const competencia = fmtCompetencia(g.referenceMonth);
            return (
              <div key={g.id}>
                <button type="button" onClick={() => setExpanded(isExp ? null : g.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-card border border-line dark:hover:bg-white/5">
                  <span className={`shrink-0 rounded-xl px-2 py-0.5 text-[10px] font-bold ${cat.cls}`}>{cat.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.taxName}</p>
                    <p className="text-xs text-ink-soft">Competência: {competencia}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold">{BRL.format(g.amount)}</p>
                    <p className={`text-xs ${vencClass(g.dueDate, g.status)}`}>
                      <CalendarBlank className="mr-0.5 inline h-3 w-3" />
                      {g.status === 'PAID' ? 'Paga' : `Vence ${fmtDate(g.dueDate)}`}
                    </p>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${st.cls}`}>
                    <StatusIcon className="h-3 w-3" />{st.label}
                  </span>
                  {isExp ? <CaretUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <CaretDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>

                {isExp && (
                  <div className="mx-4 mb-3 space-y-3 rounded-xl bg-surface-card border border-line p-4 dark:bg-white/5">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className={lbl}>Valor</p><p className="font-semibold">{BRL.format(g.amount)}</p></div>
                      <div><p className={lbl}>Vencimento</p><p className={`font-medium ${vencClass(g.dueDate, g.status)}`}>{fmtDate(g.dueDate)}</p></div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {g.pixCode && <CopyBtn text={g.pixCode} />}
                        {g.fileUrl && (
                          <a href={g.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-ink/10">
                            <DownloadSimple className="h-3.5 w-3.5" /> Baixar guia
                          </a>
                        )}
                        {g.status !== 'PAID' && (
                          <button type="button" onClick={() => markPaid(g.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok hover:bg-ok/20">
                            <CheckCircle className="h-3.5 w-3.5" /> Marcar como paga
                          </button>
                        )}
                      </div>
                      {categoria === 'DAS' && (
                        cnpjMei
                          ? <EmitirDasBtn competencia={competencia} cnpj={cnpjMei} />
                          : <p className="text-xs text-ink-soft">
                              Configure o CNPJ MEI acima para emitir o DAS direto aqui.
                            </p>
                      )}
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
