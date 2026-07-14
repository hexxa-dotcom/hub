'use client';

import { useState } from 'react';
import {
  Receipt, Copy, Check, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Plus, X, Download, CalendarDays,
  DollarSign, Filter, Loader2, ExternalLink, Settings2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type GuiaCategoria = 'das' | 'darf' | 'iss' | 'parcelamento' | 'fgts' | 'diversa';
type GuiaStatus = 'pendente' | 'paga' | 'vencida';

type Guia = {
  id: string;
  categoria: GuiaCategoria;
  descricao: string;
  competencia: string;
  vencimento: string; // YYYY-MM-DD
  valor: number;
  status: GuiaStatus;
  codigoPix: string | null;
  pagoEm: string | null;
};

// ── Config ────────────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<GuiaCategoria, { label: string; cls: string }> = {
  das:          { label: 'DAS',          cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400' },
  darf:         { label: 'DARF',         cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  iss:          { label: 'ISS',          cls: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  parcelamento: { label: 'Parcelamento', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  fgts:         { label: 'FGTS',         cls: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  diversa:      { label: 'Diversa',      cls: 'bg-ink/10 text-ink-soft' },
};

const STATUS_CONFIG: Record<GuiaStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  pendente: { label: 'Pendente', cls: 'bg-warn/10 text-warn',          icon: Clock },
  paga:     { label: 'Paga',     cls: 'bg-ok/10 text-ok',              icon: CheckCircle2 },
  vencida:  { label: 'Em atraso', cls: 'bg-critical/10 text-critical', icon: AlertTriangle },
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function vencClass(iso: string, status: GuiaStatus) {
  if (status === 'paga') return 'text-ink-soft';
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'text-critical font-medium';
  if (days <= 5) return 'text-warn font-medium';
  return 'text-ink-soft';
}

// ── Seed ─────────────────────────────────────────────────────────────────────

function seedGuias(): Guia[] {
  const yr = new Date().getFullYear();
  const PIX1 = '00020126580014BR.GOV.BCB.PIX0136b4e2c581-3a12-4f9d-8b7e-12ab34cd5678520400005303986540';
  const PIX2 = '00020126360014BR.GOV.BCB.PIX0114+5511999990000520400005303986540';
  const PIX3 = '00020126580014BR.GOV.BCB.PIX0136a3f15d90-2b44-4e1c-9c0d-ef12ab34cd56520400005303986540';

  return [
    // DAS
    { id: 'g1',  categoria: 'das', descricao: 'DAS Simples Nacional', competencia: '03/2026', vencimento: `${yr}-04-22`, valor: 1100.00, status: 'vencida',  codigoPix: PIX1, pagoEm: null },
    { id: 'g2',  categoria: 'das', descricao: 'DAS Simples Nacional', competencia: '04/2026', vencimento: `${yr}-05-21`, valor: 1234.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-05-19` },
    { id: 'g3',  categoria: 'das', descricao: 'DAS Simples Nacional', competencia: '05/2026', vencimento: `${yr}-06-20`, valor: 1456.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-06-18` },
    { id: 'g4',  categoria: 'das', descricao: 'DAS Simples Nacional', competencia: '06/2026', vencimento: `${yr}-07-21`, valor: 1678.00, status: 'pendente', codigoPix: PIX2, pagoEm: null },
    // DARF
    { id: 'g5',  categoria: 'darf', descricao: 'DARF — CSLL 1º Trimestre', competencia: '1T/2026', vencimento: `${yr}-04-30`, valor: 445.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-04-28` },
    { id: 'g6',  categoria: 'darf', descricao: 'DARF — IRPJ 1º Trimestre', competencia: '1T/2026', vencimento: `${yr}-04-30`, valor: 567.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-04-28` },
    { id: 'g7',  categoria: 'darf', descricao: 'DARF — COFINS Retido',      competencia: '05/2026', vencimento: `${yr}-06-20`, valor: 189.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-06-17` },
    // ISS
    { id: 'g8',  categoria: 'iss', descricao: 'ISS Municipal', competencia: '04/2026', vencimento: `${yr}-05-10`, valor: 234.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-05-08` },
    { id: 'g9',  categoria: 'iss', descricao: 'ISS Municipal', competencia: '05/2026', vencimento: `${yr}-06-10`, valor: 256.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-06-09` },
    { id: 'g10', categoria: 'iss', descricao: 'ISS Municipal', competencia: '06/2026', vencimento: `${yr}-07-10`, valor: 267.00, status: 'pendente', codigoPix: PIX2, pagoEm: null },
    // Parcelamentos
    { id: 'g11', categoria: 'parcelamento', descricao: 'Parcelamento PGFN — 1/24', competencia: '04/2026', vencimento: `${yr}-04-25`, valor: 432.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-04-23` },
    { id: 'g12', categoria: 'parcelamento', descricao: 'Parcelamento PGFN — 2/24', competencia: '05/2026', vencimento: `${yr}-05-23`, valor: 432.00, status: 'paga',     codigoPix: null, pagoEm: `${yr}-05-21` },
    { id: 'g13', categoria: 'parcelamento', descricao: 'Parcelamento PGFN — 3/24', competencia: '06/2026', vencimento: `${yr}-06-25`, valor: 432.00, status: 'vencida',  codigoPix: PIX3, pagoEm: null },
    { id: 'g14', categoria: 'parcelamento', descricao: 'Parcelamento PGFN — 4/24', competencia: '07/2026', vencimento: `${yr}-07-25`, valor: 432.00, status: 'pendente', codigoPix: null, pagoEm: null },
    // FGTS
    { id: 'g15', categoria: 'fgts', descricao: 'FGTS — Competência 05/2026', competencia: '05/2026', vencimento: `${yr}-07-07`, valor: 560.00, status: 'pendente', codigoPix: PIX1, pagoEm: null },
  ];
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
              <ExternalLink className="h-3.5 w-3.5" /> Abrir no PGMEI
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
              <ExternalLink className="h-3.5 w-3.5" /> Emitir no portal do governo
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
        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Emitindo…</>
        : <><Download className="h-3.5 w-3.5" /> Emitir DAS</>}
    </button>
  );
}

// ── Nova Guia Form ────────────────────────────────────────────────────────────

const field = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

function NovaGuiaForm({ onClose, onAdded }: { onClose: () => void; onAdded: (g: Guia) => void }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const vencimento = String(fd.get('vencimento') ?? '');
    const nova: Guia = {
      id: crypto.randomUUID(),
      categoria: (fd.get('categoria') as GuiaCategoria) ?? 'diversa',
      descricao: String(fd.get('descricao') ?? '').trim(),
      competencia: String(fd.get('competencia') ?? '').trim(),
      vencimento,
      valor: Number(String(fd.get('valor') ?? '0').replace(',', '.')),
      status: new Date(vencimento) < new Date() ? 'vencida' : 'pendente',
      codigoPix: String(fd.get('pix') ?? '').trim() || null,
      pagoEm: null,
    };
    onAdded(nova);
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
            <option value="das">DAS — Simples Nacional</option>
            <option value="darf">DARF — Federal</option>
            <option value="iss">ISS — Municipal</option>
            <option value="parcelamento">Parcelamento</option>
            <option value="fgts">FGTS</option>
            <option value="diversa">Guia Diversa</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Competência</label>
          <input name="competencia" required placeholder="MM/AAAA ou 1T/2026" className={`mt-1 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição</label>
          <input name="descricao" required placeholder="Ex.: DAS Simples Nacional — junho/2026" className={`mt-1 ${field}`} />
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
          <input name="pix" placeholder="Cole o código copia-e-cola do Pix" className={`mt-1 ${field}`} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Registrar
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      </div>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type CatFilter = GuiaCategoria | 'todas';
type StatusFilter = GuiaStatus | 'todas';

export function HubGuias() {
  const [guias, setGuias] = useState<Guia[]>(seedGuias);
  const [catFilter, setCatFilter] = useState<CatFilter>('todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cnpjMei, setCnpjMei] = useState('');
  const [showCnpjConfig, setShowCnpjConfig] = useState(false);
  const [cnpjInput, setCnpjInput] = useState('');

  const filtered = guias.filter(g =>
    (catFilter === 'todas' || g.categoria === catFilter) &&
    (statusFilter === 'todas' || g.status === statusFilter),
  );

  const pendentes = guias.filter(g => g.status === 'pendente');
  const vencidas  = guias.filter(g => g.status === 'vencida');
  const pagas     = guias.filter(g => g.status === 'paga');

  const totalAberto  = [...pendentes, ...vencidas].reduce((s, g) => s + g.valor, 0);
  const totalVencido = vencidas.reduce((s, g) => s + g.valor, 0);
  const totalPago    = pagas.reduce((s, g) => s + g.valor, 0);

  function markPaid(id: string) {
    setGuias(prev => prev.map(g => g.id === id
      ? { ...g, status: 'paga', pagoEm: new Date().toISOString().slice(0, 10) }
      : g,
    ));
  }

  const cats: { key: CatFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'das', label: 'DAS' },
    { key: 'darf', label: 'DARF' },
    { key: 'iss', label: 'ISS' },
    { key: 'parcelamento', label: 'Parcelamentos' },
    { key: 'fgts', label: 'FGTS' },
    { key: 'diversa', label: 'Diversas' },
  ];

  const statuses: { key: StatusFilter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'pendente', label: 'Pendentes' },
    { key: 'vencida', label: 'Em atraso' },
    { key: 'paga', label: 'Pagas' },
  ];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-flat rounded-card p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-ink-soft">Total em aberto</p>
            <DollarSign className="h-4 w-4 text-warn" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-warn">{BRL.format(totalAberto)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{pendentes.length + vencidas.length} guia(s)</p>
        </div>
        <div className={`rounded-card p-5 ${vencidas.length > 0 ? 'card-flat border border-critical/30' : 'card-flat'}`}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-ink-soft">Em atraso</p>
            <AlertTriangle className={`h-4 w-4 ${vencidas.length > 0 ? 'text-critical' : 'text-ink-soft'}`} />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${vencidas.length > 0 ? 'text-critical' : ''}`}>{BRL.format(totalVencido)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{vencidas.length} guia(s) vencida(s)</p>
        </div>
        <div className="card-flat rounded-card p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-ink-soft">Total pago</p>
            <CheckCircle2 className="h-4 w-4 text-ok" />
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
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${catFilter === c.key ? 'bg-brand-500 text-white' : 'bg-black/[0.07] text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
              {c.label} {c.key !== 'todas' ? `(${guias.filter(g => g.categoria === c.key).length})` : `(${guias.length})`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-ink-soft" />
            {statuses.map(s => (
              <button key={s.key} type="button" onClick={() => setStatusFilter(s.key)}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === s.key ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'text-ink-soft hover:text-ink'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowForm(v => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Registrar guia
          </button>
        </div>
      </div>

      {showForm && <NovaGuiaForm onClose={() => setShowForm(false)} onAdded={g => setGuias(prev => [g, ...prev])} />}

      {/* CNPJ MEI para emissão de DAS */}
      {!showCnpjConfig ? (
        <button type="button" onClick={() => { setShowCnpjConfig(true); setCnpjInput(cnpjMei); }}
          className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors">
          <Settings2 className="h-3.5 w-3.5" />
          {cnpjMei ? `CNPJ MEI: ${cnpjMei}` : 'Configurar CNPJ MEI para emissão de DAS'}
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-hover p-3">
          <Settings2 className="h-4 w-4 shrink-0 text-ink-soft" />
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
            const cat = CAT_CONFIG[g.categoria];
            const st = STATUS_CONFIG[g.status];
            const StatusIcon = st.icon;
            const isExp = expanded === g.id;
            return (
              <div key={g.id}>
                <button type="button" onClick={() => setExpanded(isExp ? null : g.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-black/3 dark:hover:bg-white/5">
                  <span className={`shrink-0 rounded-xl px-2 py-0.5 text-[10px] font-bold ${cat.cls}`}>{cat.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.descricao}</p>
                    <p className="text-xs text-ink-soft">Competência: {g.competencia}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold">{BRL.format(g.valor)}</p>
                    <p className={`text-xs ${vencClass(g.vencimento, g.status)}`}>
                      <CalendarDays className="mr-0.5 inline h-3 w-3" />
                      {g.status === 'paga' && g.pagoEm ? `Pago em ${fmtDate(g.pagoEm)}` : `Vence ${fmtDate(g.vencimento)}`}
                    </p>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${st.cls}`}>
                    <StatusIcon className="h-3 w-3" />{st.label}
                  </span>
                  {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>

                {isExp && (
                  <div className="mx-4 mb-3 space-y-3 rounded-xl bg-black/[0.07] p-4 dark:bg-white/5">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className={lbl}>Valor</p><p className="font-semibold">{BRL.format(g.valor)}</p></div>
                      <div><p className={lbl}>Vencimento</p><p className={`font-medium ${vencClass(g.vencimento, g.status)}`}>{fmtDate(g.vencimento)}</p></div>
                      {g.pagoEm && <div><p className={lbl}>Pago em</p><p className="font-medium text-ok">{fmtDate(g.pagoEm)}</p></div>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {g.codigoPix && <CopyBtn text={g.codigoPix} />}
                        {g.categoria !== 'das' && (
                          <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-ink/10">
                            <Download className="h-3.5 w-3.5" /> Baixar guia
                          </button>
                        )}
                        {g.status !== 'paga' && (
                          <button type="button" onClick={() => markPaid(g.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok hover:bg-ok/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como paga
                          </button>
                        )}
                      </div>
                      {g.categoria === 'das' && (
                        cnpjMei
                          ? <EmitirDasBtn competencia={g.competencia} cnpj={cnpjMei} />
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
    </div>
  );
}
