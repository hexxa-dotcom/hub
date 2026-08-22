'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Wallet, CalendarBlank, SquaresFour, CheckCircle, Warning, XCircle, MagnifyingGlass, CaretDown, CaretUp, Plus, X, Trash, Spinner } from '@phosphor-icons/react';
import type { EmployeeRow } from './actions';
import { saveEmployeeAction, setEmployeeStatusAction, deleteEmployeeAction } from './actions';

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EmployeeRow['status'], { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ACTIVE:      { label: 'Ativo',     cls: 'bg-ok/10 text-ok',          icon: CheckCircle },
  ON_VACATION: { label: 'Férias',    cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400', icon: CalendarBlank },
  TERMINATED:  { label: 'Desligado', cls: 'bg-ink/10 text-ink-soft',   icon: XCircle },
};

const VINCULOS = ['CLT', 'PJ', 'Socio', 'Estagiario'] as const;
const VINCULO_CLS: Record<string, string> = {
  CLT: 'bg-ok/10 text-ok',
  PJ: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  Socio: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Estagiario: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const lbl = 'text-xs font-medium text-ink-soft';
const field = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
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

// ── Visão Geral ────────────────────────────────────────────────────────────────

function VisaoGeral({ colaboradores, onTab }: { colaboradores: EmployeeRow[]; onTab: (t: TabKey) => void }) {
  const ativos = colaboradores.filter(c => c.status === 'ACTIVE');
  const emFerias = colaboradores.filter(c => c.status === 'ON_VACATION');
  const totalFolha = ativos.reduce((s, c) => s + c.salario, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <button type="button" onClick={() => onTab('colaboradores')} className="card-flat rounded-card p-4 text-left hover:bg-surface-card border border-line dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Colaboradores ativos</p>
            <Users className="h-4 w-4 text-brand-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{ativos.length}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{colaboradores.length} total</p>
        </button>

        <div className="card-flat rounded-card p-4 text-left">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Folha estimada</p>
            <Wallet className="h-4 w-4 text-ok" />
          </div>
          <p className="mt-2 text-xl font-semibold text-ok">{BRL.format(totalFolha)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">colaboradores ativos</p>
        </div>

        <div className="card-flat rounded-card p-4 text-left">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Em férias</p>
            <CalendarBlank className="h-4 w-4 text-brand-500" />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${emFerias.length > 0 ? 'text-brand-600 dark:text-brand-400' : ''}`}>{emFerias.length}</p>
        </div>
      </div>

      {colaboradores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-ink-soft font-medium">Nenhum colaborador cadastrado ainda.</p>
          <button type="button" onClick={() => onTab('colaboradores')} className="mt-3 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Cadastrar o primeiro →
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-flat rounded-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Equipe atual</h2>
              <button type="button" onClick={() => onTab('colaboradores')} className="text-xs text-brand-500 hover:underline">Ver todos</button>
            </div>
            <div className="space-y-2">
              {colaboradores.filter(c => c.status !== 'TERMINATED').slice(0, 5).map(c => {
                const st = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-card border border-line px-3 py-2 dark:bg-white/5">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${avatarColor(c.nome)}`}>
                      {initials(c.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nome}</p>
                      <p className="truncate text-xs text-ink-soft">{c.cargo ?? '—'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-flat rounded-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Composição da folha</h2>
            </div>
            <div className="space-y-2">
              {ativos.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-card border border-line px-3 py-2 dark:bg-white/5">
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
            <p className="mt-2 text-[11px] text-ink-soft">Só CLT e Sócio entram na base do Fator R (PJ e estagiário não contam como folha pro Simples).</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de colaborador ─────────────────────────────────────────────────────

function ModalColaborador({ colaborador, onClose, onSaved }: { colaborador: EmployeeRow | null; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(colaborador?.nome ?? '');
  const [cpf, setCpf] = useState(colaborador?.cpf ?? '');
  const [cargo, setCargo] = useState(colaborador?.cargo ?? '');
  const [departamento, setDepartamento] = useState(colaborador?.departamento ?? '');
  const [salario, setSalario] = useState(String(colaborador?.salario ?? ''));
  const [vinculo, setVinculo] = useState(colaborador?.vinculo ?? 'CLT');
  const [admissao, setAdmissao] = useState(colaborador?.admissao ?? new Date().toISOString().slice(0, 10));
  const [email, setEmail] = useState(colaborador?.email ?? '');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveEmployeeAction({
        id: colaborador?.id,
        nome, cpf, cargo, departamento,
        salario: Number(salario.replace(',', '.')) || 0,
        vinculo, admissao, email,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{colaborador ? 'Editar colaborador' : 'Adicionar colaborador'}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Nome completo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} required className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={lbl}>CPF</label>
              <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={lbl}>Vínculo</label>
              <select value={vinculo} onChange={e => setVinculo(e.target.value)} className={`mt-1 ${field}`}>
                {VINCULOS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Cargo</label>
              <input value={cargo} onChange={e => setCargo(e.target.value)} className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={lbl}>Departamento</label>
              <input value={departamento} onChange={e => setDepartamento(e.target.value)} className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={lbl}>Remuneração (R$)</label>
              <input value={salario} onChange={e => setSalario(e.target.value)} inputMode="decimal" required className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={lbl}>Admissão</label>
              <input type="date" value={admissao} onChange={e => setAdmissao(e.target.value)} className={`mt-1 ${field}`} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`mt-1 ${field}`} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line py-2 text-sm font-medium hover:bg-surface-hover">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Colaboradores Tab ─────────────────────────────────────────────────────────

function ColaboradoresTab({ colaboradores }: { colaboradores: EmployeeRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = colaboradores.filter(c => {
    const q = search.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || (c.cargo ?? '').toLowerCase().includes(q) || (c.departamento ?? '').toLowerCase().includes(q);
  });

  const editingColaborador = modal.editId ? (colaboradores.find(c => c.id === modal.editId) ?? null) : null;

  function handleSaved() {
    setModal({ open: false, editId: null });
    router.refresh();
  }

  async function handleStatus(id: string, status: EmployeeRow['status']) {
    setBusyId(id);
    try {
      await setEmployeeStatusAction(id, status);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteEmployeeAction(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, cargo ou departamento…"
            className="w-full rounded-xl border border-line bg-surface-card py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
        </div>
        <button type="button" onClick={() => setModal({ open: true, editId: null })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

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
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-card border border-line dark:hover:bg-white/5">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white ${avatarColor(c.nome)}`}>
                    {initials(c.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.nome}</p>
                    <p className="truncate text-xs text-ink-soft">{c.cargo ?? '—'}{c.departamento ? ` · ${c.departamento}` : ''}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold">{BRL.format(c.salario)}</p>
                    <span className={`text-[10px] font-bold ${VINCULO_CLS[c.vinculo]} rounded-xl px-1.5 py-0.5`}>{c.vinculo}</span>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${st.cls}`}>
                    <StatusIcon className="h-3 w-3" />{st.label}
                  </span>
                  {isExp ? <CaretUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <CaretDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>
                {isExp && (
                  <div className="mx-4 mb-3 space-y-3 rounded-xl bg-surface-card border border-line p-4 dark:bg-white/5">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className={lbl}>Admissão</p><p className="font-medium">{fmtDate(c.admissao)}</p></div>
                      <div><p className={lbl}>Remuneração</p><p className="font-semibold">{BRL.format(c.salario)}</p></div>
                      {c.email && <div><p className={lbl}>E-mail</p><p className="truncate text-ink-soft">{c.email}</p></div>}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" onClick={() => setModal({ open: true, editId: c.id })}
                        className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10">Editar</button>
                      {c.status !== 'ON_VACATION' && (
                        <button type="button" onClick={() => handleStatus(c.id, 'ON_VACATION')} disabled={busyId === c.id}
                          className="rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400 disabled:opacity-50">Marcar férias</button>
                      )}
                      {c.status !== 'ACTIVE' && (
                        <button type="button" onClick={() => handleStatus(c.id, 'ACTIVE')} disabled={busyId === c.id}
                          className="rounded-xl bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok hover:bg-ok/20 disabled:opacity-50">Reativar</button>
                      )}
                      {c.status !== 'TERMINATED' && (
                        <button type="button" onClick={() => handleStatus(c.id, 'TERMINATED')} disabled={busyId === c.id}
                          className="rounded-xl bg-critical/10 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/20 disabled:opacity-50">Desligar</button>
                      )}
                      <button type="button" onClick={() => handleDelete(c.id)} disabled={busyId === c.id}
                        className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-critical/10 hover:text-critical disabled:opacity-50">
                        {busyId === c.id ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Trash className="h-3.5 w-3.5" />} Remover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal.open && <ModalColaborador colaborador={editingColaborador} onClose={() => setModal({ open: false, editId: null })} onSaved={handleSaved} />}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabKey = 'geral' | 'colaboradores';

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'geral',          label: 'Visão Geral',    icon: SquaresFour },
  { key: 'colaboradores',  label: 'Colaboradores',  icon: Users },
];

export function HubDP({ initialColaboradores }: { initialColaboradores: EmployeeRow[] }) {
  const [tab, setTab] = useState<TabKey>('geral');

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-card border border-line p-1 dark:bg-white/3 max-w-fit">
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

      {tab === 'geral'         && <VisaoGeral colaboradores={initialColaboradores} onTab={setTab} />}
      {tab === 'colaboradores' && <ColaboradoresTab colaboradores={initialColaboradores} />}
    </div>
  );
}
