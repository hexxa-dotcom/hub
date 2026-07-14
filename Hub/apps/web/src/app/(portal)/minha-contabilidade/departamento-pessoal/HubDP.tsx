'use client';

import { useState } from 'react';
import {
  Users, UserPlus, Wallet, CalendarDays, LayoutGrid, Plus, X,
  CheckCircle2, Clock, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Search, Loader2, Send, Briefcase, Building2, ClipboardList,
  ArrowUpRight, Info,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type VinculoTipo = 'CLT' | 'PJ' | 'Sócio' | 'Estagiário';
type ColabStatus = 'ativo' | 'ferias' | 'afastado' | 'desligado';

type Colaborador = {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  salario: number;
  vinculo: VinculoTipo;
  status: ColabStatus;
  admissao: string; // YYYY-MM-DD
  email: string | null;
};

type Ferias = {
  id: string;
  colaboradorId: string;
  inicio: string; // YYYY-MM-DD
  fim: string;
  dias: number;
};

type FolhaProcessada = {
  id: string;
  mes: string; // YYYY-MM
  total: number;
  colaboradores: number;
  processadoEm: string;
};

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ColabStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ativo:     { label: 'Ativo',     cls: 'bg-ok/10 text-ok',          icon: CheckCircle2 },
  ferias:    { label: 'Férias',    cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400', icon: CalendarDays },
  afastado:  { label: 'Afastado', cls: 'bg-warn/10 text-warn',       icon: AlertTriangle },
  desligado: { label: 'Desligado',cls: 'bg-ink/10 text-ink-soft',    icon: XCircle },
};

const VINCULO_CLS: Record<VinculoTipo, string> = {
  CLT:        'bg-ok/10 text-ok',
  PJ:         'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  Sócio:      'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Estagiário: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

const DEPARTAMENTOS = ['Administrativo', 'Comercial', 'Financeiro', 'Jurídico', 'Marketing', 'Operações', 'RH', 'Tecnologia'];

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const field = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function mesLabel(ym: string) {
  return new Date(ym + '-02').toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

function initials(nome: string) {
  return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = ['bg-brand-500', 'bg-ok/80', 'bg-warn/80', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500'];
function avatarColor(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Seed ──────────────────────────────────────────────────────────────────────

function seedColaboradores(): Colaborador[] {
  return [
    { id: 'c1', nome: 'Ana Rodrigues',    cargo: 'Gerente Financeiro',        departamento: 'Financeiro',     salario: 8500,  vinculo: 'CLT',        status: 'ativo',    admissao: '2022-03-01', email: 'ana.rodrigues@empresa.com' },
    { id: 'c2', nome: 'Carlos Mendes',    cargo: 'Desenvolvedor Sênior',      departamento: 'Tecnologia',     salario: 7200,  vinculo: 'CLT',        status: 'ativo',    admissao: '2021-07-15', email: 'carlos.mendes@empresa.com' },
    { id: 'c3', nome: 'Beatriz Santos',   cargo: 'Assistente Administrativo', departamento: 'Administrativo', salario: 3500,  vinculo: 'CLT',        status: 'ferias',   admissao: '2023-01-10', email: 'beatriz.santos@empresa.com' },
    { id: 'c4', nome: 'Diego Ferreira',   cargo: 'Designer UX',               departamento: 'Marketing',      salario: 5000,  vinculo: 'PJ',         status: 'ativo',    admissao: '2023-06-01', email: 'diego@diegoferreira.com' },
    { id: 'c5', nome: 'Fernanda Lima',    cargo: 'Estagiária de Marketing',   departamento: 'Marketing',      salario: 1500,  vinculo: 'Estagiário', status: 'ativo',    admissao: '2025-02-01', email: 'fernanda.lima@empresa.com' },
  ];
}

function seedFerias(): Ferias[] {
  const yr = new Date().getFullYear();
  return [
    { id: 'f1', colaboradorId: 'c3', inicio: `${yr}-06-15`, fim: `${yr}-07-04`, dias: 20 },
  ];
}

function seedFolhas(): FolhaProcessada[] {
  const yr = new Date().getFullYear();
  return [
    { id: 'fp1', mes: `${yr}-05`, total: 25700, colaboradores: 5, processadoEm: `${yr}-05-25` },
    { id: 'fp2', mes: `${yr}-04`, total: 25700, colaboradores: 5, processadoEm: `${yr}-04-25` },
  ];
}

// ── Visão Geral ────────────────────────────────────────────────────────────────

function VisaoGeral({
  colaboradores, ferias, folhas, onTab,
}: {
  colaboradores: Colaborador[];
  ferias: Ferias[];
  folhas: FolhaProcessada[];
  onTab: (t: TabKey) => void;
}) {
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  const emFerias = colaboradores.filter(c => c.status === 'ferias');
  const totalFolha = ativos.reduce((s, c) => s + c.salario, 0);
  const ultimaFolha = folhas[0];

  const today = new Date().toISOString().slice(0, 10);
  const feriasAtivas = ferias.filter(f => f.inicio <= today && f.fim >= today);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button type="button" onClick={() => onTab('colaboradores')} className="card-flat rounded-card p-4 text-left hover:bg-black/3 dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Colaboradores ativos</p>
            <Users className="h-4 w-4 text-brand-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{ativos.length}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{colaboradores.length} total</p>
        </button>

        <button type="button" onClick={() => onTab('folha')} className="card-flat rounded-card p-4 text-left hover:bg-black/3 dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Folha estimada</p>
            <Wallet className="h-4 w-4 text-ok" />
          </div>
          <p className="mt-2 text-xl font-semibold text-ok">{BRL.format(totalFolha)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">colaboradores ativos</p>
        </button>

        <button type="button" onClick={() => onTab('ferias')} className="card-flat rounded-card p-4 text-left hover:bg-black/3 dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Em férias</p>
            <CalendarDays className="h-4 w-4 text-brand-500" />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${emFerias.length > 0 ? 'text-brand-600 dark:text-brand-400' : ''}`}>{emFerias.length}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{feriasAtivas.length} período(s) ativo(s)</p>
        </button>

        <button type="button" onClick={() => onTab('folha')} className="card-flat rounded-card p-4 text-left hover:bg-black/3 dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Última folha processada</p>
            <ClipboardList className="h-4 w-4 text-ink-soft" />
          </div>
          {ultimaFolha ? (
            <>
              <p className="mt-2 text-sm font-semibold capitalize">{mesLabel(ultimaFolha.mes)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{BRL.format(ultimaFolha.total)}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Nenhuma ainda</p>
          )}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Equipe */}
        <div className="card-flat rounded-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Equipe atual</h2>
            <button type="button" onClick={() => onTab('colaboradores')} className="text-xs text-brand-500 hover:underline">Ver todos</button>
          </div>
          <div className="space-y-2">
            {colaboradores.filter(c => c.status !== 'desligado').slice(0, 5).map(c => {
              const st = STATUS_CONFIG[c.status];
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-black/3 px-3 py-2 dark:bg-white/5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${avatarColor(c.nome)}`}>
                    {initials(c.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="truncate text-xs text-ink-soft">{c.cargo}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => onTab('colaboradores')} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <UserPlus className="h-4 w-4" /> Novo colaborador
          </button>
        </div>

        {/* Folha */}
        <div className="card-flat rounded-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Composição da folha</h2>
            <button type="button" onClick={() => onTab('folha')} className="text-xs text-brand-500 hover:underline">Processar</button>
          </div>
          <div className="space-y-2">
            {ativos.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-black/3 px-3 py-2 dark:bg-white/5">
                <span className={`shrink-0 rounded-xl px-1.5 py-0.5 text-[10px] font-bold ${VINCULO_CLS[c.vinculo]}`}>{c.vinculo}</span>
                <p className="min-w-0 flex-1 truncate text-sm">{c.nome}</p>
                <span className="shrink-0 text-sm font-semibold">{BRL.format(c.salario)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-500/10 px-4 py-2.5">
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Total da folha</span>
            <span className="text-base font-bold text-brand-700 dark:text-brand-300">{BRL.format(totalFolha)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Colaboradores Tab ─────────────────────────────────────────────────────────

function ColaboradorForm({ onClose, onAdded }: { onClose: () => void; onAdded: (c: Colaborador) => void }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onAdded({
      id: crypto.randomUUID(),
      nome: String(fd.get('nome') ?? '').trim(),
      cargo: String(fd.get('cargo') ?? '').trim(),
      departamento: String(fd.get('departamento') ?? ''),
      salario: parseFloat(String(fd.get('salario') ?? '0').replace(',', '.')) || 0,
      vinculo: (fd.get('vinculo') as VinculoTipo) ?? 'CLT',
      status: 'ativo',
      admissao: String(fd.get('admissao') ?? new Date().toISOString().slice(0, 10)),
      email: String(fd.get('email') ?? '').trim() || null,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Novo colaborador</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Nome completo</label>
          <input name="nome" required placeholder="Nome do colaborador" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Cargo</label>
          <input name="cargo" required placeholder="Ex.: Analista Financeiro" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Departamento</label>
          <select name="departamento" className={`mt-1 ${field}`}>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Vínculo</label>
          <select name="vinculo" className={`mt-1 ${field}`}>
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
            <option value="Sócio">Sócio</option>
            <option value="Estagiário">Estagiário</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Salário / Remuneração (R$)</label>
          <input name="salario" inputMode="decimal" required placeholder="0,00" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Data de admissão</label>
          <input name="admissao" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>E-mail</label>
          <input name="email" type="email" placeholder="email@empresa.com" className={`mt-1 ${field}`} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Admitir
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      </div>
    </form>
  );
}

function ColaboradoresTab({
  colaboradores, onUpdate,
}: { colaboradores: Colaborador[]; onUpdate: (fn: (prev: Colaborador[]) => Colaborador[]) => void }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ColabStatus | 'todos'>('todos');

  const filtered = colaboradores.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q || c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q) || c.departamento.toLowerCase().includes(q);
    return matchQ && (filterStatus === 'todos' || c.status === filterStatus);
  });

  function changeStatus(id: string, status: ColabStatus) {
    onUpdate(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    setExpanded(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, cargo ou departamento…"
            className="w-full rounded-xl border border-line bg-surface-card py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['todos', 'ativo', 'ferias', 'afastado', 'desligado'] as const).map(s => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${filterStatus === s ? 'bg-brand-500 text-white' : 'bg-black/[0.07] text-ink-soft hover:bg-black/10 dark:bg-white/5'}`}>
              {s === 'todos' ? `Todos (${colaboradores.length})` : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <UserPlus className="h-4 w-4" /> Admitir
        </button>
      </div>

      {showForm && <ColaboradorForm onClose={() => setShowForm(false)} onAdded={c => onUpdate(prev => [c, ...prev])} />}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <Users className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum colaborador encontrado.</p>
        </div>
      ) : (
        <div className="card-flat rounded-card divide-y divide-line">
          {filtered.map(c => {
            const st = STATUS_CONFIG[c.status];
            const StatusIcon = st.icon;
            const isExp = expanded === c.id;
            return (
              <div key={c.id}>
                <button type="button" onClick={() => setExpanded(isExp ? null : c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-black/3 dark:hover:bg-white/5">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white ${avatarColor(c.nome)}`}>
                    {initials(c.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.nome}</p>
                    <p className="truncate text-xs text-ink-soft">{c.cargo} · {c.departamento}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold">{BRL.format(c.salario)}</p>
                    <span className={`text-[10px] font-bold ${VINCULO_CLS[c.vinculo]} rounded-xl px-1.5 py-0.5`}>{c.vinculo}</span>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${st.cls}`}>
                    <StatusIcon className="h-3 w-3" />{st.label}
                  </span>
                  {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>
                {isExp && (
                  <div className="mx-4 mb-3 space-y-3 rounded-xl bg-black/[0.07] p-4 dark:bg-white/5">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className={lbl}>Admissão</p><p className="font-medium">{fmtDate(c.admissao)}</p></div>
                      <div><p className={lbl}>Remuneração</p><p className="font-semibold">{BRL.format(c.salario)}</p></div>
                      {c.email && <div><p className={lbl}>E-mail</p><p className="truncate text-ink-soft">{c.email}</p></div>}
                    </div>
                    <div>
                      <p className={`${lbl} mb-1.5`}>Alterar status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['ativo', 'ferias', 'afastado', 'desligado'] as ColabStatus[]).map(s => {
                          const cfg = STATUS_CONFIG[s];
                          return (
                            <button key={s} type="button" onClick={() => changeStatus(c.id, s)}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${c.status === s ? `${cfg.cls} ring-1 ring-current/30` : 'bg-black/[0.07] text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
                              <cfg.icon className="h-3.5 w-3.5" />{cfg.label}
                            </button>
                          );
                        })}
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
  );
}

// ── Folha do Mês ──────────────────────────────────────────────────────────────

type FolhaItemResult = { nome: string; ok: boolean; error?: string };

function FolhaTab({
  colaboradores, folhas, onFolhaAdded,
}: {
  colaboradores: Colaborador[];
  folhas: FolhaProcessada[];
  onFolhaAdded: (f: FolhaProcessada) => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(currentMonth);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<FolhaItemResult[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const ativos = colaboradores.filter(c => c.status === 'ativo');
  const totalFolha = ativos.reduce((s, c) => s + c.salario, 0);
  const jaProcessada = folhas.some(f => f.mes === mes);

  async function processarFolha() {
    if (ativos.length === 0) return;
    setProcessing(true);
    setResults(null);

    // Último dia do mês selecionado
    const parts = mes.split('-');
    const lastDay = new Date(Number(parts[0]), Number(parts[1]), 0).toISOString().slice(0, 10);
    const label = mesLabel(mes);

    const itemResults: FolhaItemResult[] = [];

    for (const c of ativos) {
      try {
        const res = await fetch('/api/financeiro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: `Salário — ${c.nome} (${label})`,
            valor: c.salario,
            vencimento: lastDay,
            tipo: 'PAGAR',
            categoria: 'Salários',
            observacao: `${c.vinculo} · ${c.cargo} · Folha ${label}`,
          }),
        });
        itemResults.push({ nome: c.nome, ok: res.ok, error: res.ok ? undefined : 'Erro ao criar lançamento' });
      } catch {
        itemResults.push({ nome: c.nome, ok: false, error: 'Falha na conexão' });
      }
    }

    setResults(itemResults);
    const allOk = itemResults.every(r => r.ok);
    if (allOk) {
      onFolhaAdded({
        id: crypto.randomUUID(),
        mes,
        total: totalFolha,
        colaboradores: ativos.length,
        processadoEm: new Date().toISOString().slice(0, 10),
      });
    }
    setProcessing(false);
  }

  return (
    <div className="space-y-4">
      {/* Seletor de mês */}
      <div className="card-flat rounded-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-48">
            <label className={lbl}>Mês de referência</label>
            <input type="month" value={mes} onChange={e => { setMes(e.target.value); setResults(null); }} className={`mt-1 ${field}`} />
          </div>
          <div className="flex-1">
            <p className={lbl}>Total da folha</p>
            <p className="mt-1 text-2xl font-semibold text-ok">{BRL.format(totalFolha)}</p>
          </div>
          <div className="flex-1">
            <p className={lbl}>Colaboradores</p>
            <p className="mt-1 text-2xl font-semibold">{ativos.length} ativos</p>
          </div>
        </div>
      </div>

      {/* Banner já processado */}
      {jaProcessada && !results && (
        <div className="flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />
          <div>
            <p className="text-sm font-semibold text-ok">Folha de {mesLabel(mes)} já processada</p>
            <p className="text-xs text-ink-soft">Os lançamentos foram enviados ao Hub Financeiro. Processe novamente apenas se necessário.</p>
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <div className="flex items-start gap-2 rounded-xl border border-line bg-brand-500/5 px-4 py-3 text-xs text-ink-soft">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
        <span>Ao processar a folha, um lançamento <strong>Contas a Pagar</strong> com categoria <strong>Salários</strong> será criado automaticamente no Hub Financeiro para cada colaborador ativo.</span>
      </div>

      {/* Lista de colaboradores */}
      {ativos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-ink-soft">
          <Users className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum colaborador ativo para processar.</p>
        </div>
      ) : (
        <>
          <div className="card-flat rounded-card divide-y divide-line">
            {ativos.map((c, i) => {
              const result = results?.[i];
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white ${avatarColor(c.nome)}`}>
                    {initials(c.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.nome}</p>
                    <p className="truncate text-xs text-ink-soft">{c.cargo} · <span className={`font-medium ${VINCULO_CLS[c.vinculo]} rounded px-1`}>{c.vinculo}</span></p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{BRL.format(c.salario)}</span>
                  {result && (
                    result.ok
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok"><CheckCircle2 className="h-3 w-3" />Lançado</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-critical/10 px-2 py-0.5 text-xs font-medium text-critical"><XCircle className="h-3 w-3" />Erro</span>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between bg-brand-500/5 px-4 py-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-bold text-brand-600 dark:text-brand-400">{BRL.format(totalFolha)}</span>
            </div>
          </div>

          {results ? (
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${results.every(r => r.ok) ? 'border-ok/30 bg-ok/10' : 'border-warn/30 bg-warn/10'}`}>
              {results.every(r => r.ok) ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />}
              <div>
                <p className={`text-sm font-semibold ${results.every(r => r.ok) ? 'text-ok' : 'text-warn'}`}>
                  {results.every(r => r.ok)
                    ? `Folha de ${mesLabel(mes)} lançada no Hub Financeiro!`
                    : `${results.filter(r => !r.ok).length} lançamento(s) com erro`}
                </p>
                <p className="text-xs text-ink-soft">
                  {results.every(r => r.ok)
                    ? `${results.length} lançamento(s) criados em Contas a Pagar · Salários com vencimento no último dia do mês.`
                    : 'Verifique sua conexão e tente novamente.'}
                </p>
                {results.every(r => r.ok) && (
                  <a href="/meu-negocio/hub-financeiro" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline">
                    Ver no Hub Financeiro <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <button type="button" onClick={processarFolha} disabled={processing || ativos.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {processing ? 'Processando…' : `Processar folha de ${mesLabel(mes)}`}
            </button>
          )}
        </>
      )}

      {/* Histórico */}
      {folhas.length > 0 && (
        <div className="card-flat rounded-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Histórico de folhas processadas</h2>
          <div className="divide-y divide-line">
            {folhas.map(f => {
              const isExp = expanded === f.id;
              return (
                <button key={f.id} type="button" onClick={() => setExpanded(isExp ? null : f.id)}
                  className="flex w-full items-center gap-3 py-3 text-left hover:bg-black/3 dark:hover:bg-white/5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                  <div className="min-w-0 flex-1">
                    <p className="capitalize text-sm font-medium">{mesLabel(f.mes)}</p>
                    <p className="text-xs text-ink-soft">Processado em {fmtDate(f.processadoEm)} · {f.colaboradores} colaboradores</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{BRL.format(f.total)}</span>
                  {isExp ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Férias Tab ────────────────────────────────────────────────────────────────

function FeriasTab({ colaboradores, ferias, onUpdate }: {
  colaboradores: Colaborador[];
  ferias: Ferias[];
  onUpdate: (fn: (prev: Ferias[]) => Ferias[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const inicio = String(fd.get('inicio') ?? '');
    const fim = String(fd.get('fim') ?? '');
    const colaboradorId = String(fd.get('colaboradorId') ?? '');
    const dias = Math.ceil((new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000) + 1;
    const colabAtualizado = colaboradorId;

    onUpdate(prev => [...prev, {
      id: crypto.randomUUID(),
      colaboradorId: colabAtualizado,
      inicio,
      fim,
      dias,
    }]);
    setShowForm(false);
  }

  const feriasComNome = ferias.map(f => ({
    ...f,
    colab: colaboradores.find(c => c.id === f.colaboradorId),
  }));

  const ativas = feriasComNome.filter(f => f.inicio <= today && f.fim >= today);
  const futuras = feriasComNome.filter(f => f.inicio > today);
  const historico = feriasComNome.filter(f => f.fim < today);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="card-flat rounded-card px-4 py-3">
            <p className="text-xs text-ink-soft">Em gozo agora</p>
            <p className={`text-xl font-semibold ${ativas.length > 0 ? 'text-brand-600 dark:text-brand-400' : ''}`}>{ativas.length}</p>
          </div>
          <div className="card-flat rounded-card px-4 py-3">
            <p className="text-xs text-ink-soft">Agendadas</p>
            <p className="text-xl font-semibold">{futuras.length}</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Agendar férias
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Agendar férias</p>
            <button type="button" onClick={() => setShowForm(false)} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className={lbl}>Colaborador</label>
              <select name="colaboradorId" required className={`mt-1 ${field}`}>
                <option value="">Selecionar…</option>
                {colaboradores.filter(c => c.status !== 'desligado').map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Início</label>
              <input name="inicio" type="date" required className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={lbl}>Fim</label>
              <input name="fim" type="date" required className={`mt-1 ${field}`} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
              <Plus className="h-4 w-4" /> Agendar
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          </div>
        </form>
      )}

      {[
        { titulo: 'Em gozo', items: ativas, emptyMsg: 'Nenhum colaborador de férias agora.' },
        { titulo: 'Agendadas', items: futuras, emptyMsg: 'Nenhumas férias agendadas.' },
        { titulo: 'Histórico', items: historico, emptyMsg: 'Sem histórico de férias.' },
      ].map(({ titulo, items, emptyMsg }) => (
        <div key={titulo} className="card-flat rounded-card p-5">
          <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>
          {items.length === 0 ? (
            <p className="text-sm text-ink-soft">{emptyMsg}</p>
          ) : (
            <div className="divide-y divide-line">
              {items.map(f => (
                <div key={f.id} className="flex items-center gap-3 py-3">
                  {f.colab && (
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${avatarColor(f.colab.nome)}`}>
                      {initials(f.colab.nome)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.colab?.nome ?? 'Desconhecido'}</p>
                    <p className="text-xs text-ink-soft">{fmtDate(f.inicio)} → {fmtDate(f.fim)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
                    {f.dias} dias
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabKey = 'geral' | 'colaboradores' | 'folha' | 'ferias';

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'geral',          label: 'Visão Geral',    icon: LayoutGrid },
  { key: 'colaboradores',  label: 'Colaboradores',  icon: Users },
  { key: 'folha',          label: 'Folha do Mês',   icon: Wallet },
  { key: 'ferias',         label: 'Férias',         icon: CalendarDays },
];

export function HubDP() {
  const [tab, setTab] = useState<TabKey>('geral');
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(seedColaboradores);
  const [ferias, setFerias] = useState<Ferias[]>(seedFerias);
  const [folhas, setFolhas] = useState<FolhaProcessada[]>(seedFolhas);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-black/3 p-1 dark:bg-white/3">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-surface-card text-brand-600 shadow-sm dark:text-brand-400' : 'text-ink-soft hover:text-ink'
            }`}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'geral'         && <VisaoGeral colaboradores={colaboradores} ferias={ferias} folhas={folhas} onTab={setTab} />}
      {tab === 'colaboradores' && <ColaboradoresTab colaboradores={colaboradores} onUpdate={setColaboradores} />}
      {tab === 'folha'         && <FolhaTab colaboradores={colaboradores} folhas={folhas} onFolhaAdded={f => setFolhas(prev => [f, ...prev])} />}
      {tab === 'ferias'        && <FeriasTab colaboradores={colaboradores} ferias={ferias} onUpdate={setFerias} />}
    </div>
  );
}
