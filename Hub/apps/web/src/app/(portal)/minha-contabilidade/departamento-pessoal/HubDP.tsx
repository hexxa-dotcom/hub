'use client';

import { useState } from 'react';
import { Users, Wallet, CalendarBlank, SquaresFour, CheckCircle, Warning, XCircle, MagnifyingGlass, CaretDown, CaretUp } from '@phosphor-icons/react';

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

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ColabStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ativo:     { label: 'Ativo',     cls: 'bg-ok/10 text-ok',          icon: CheckCircle },
  ferias:    { label: 'Férias',    cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400', icon: CalendarBlank },
  afastado:  { label: 'Afastado', cls: 'bg-warn/10 text-warn',       icon: Warning },
  desligado: { label: 'Desligado',cls: 'bg-ink/10 text-ink-soft',    icon: XCircle },
};

const VINCULO_CLS: Record<VinculoTipo, string> = {
  CLT:        'bg-ok/10 text-ok',
  PJ:         'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  Sócio:      'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Estagiário: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const lbl = 'text-xs font-medium text-ink-soft';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
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

// ── Visão Geral ────────────────────────────────────────────────────────────────

function VisaoGeral({
  colaboradores, onTab,
}: {
  colaboradores: Colaborador[];
  onTab: (t: TabKey) => void;
}) {
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  const emFerias = colaboradores.filter(c => c.status === 'ferias');
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
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-card border border-line px-3 py-2 dark:bg-white/5">
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
        </div>

        {/* Folha */}
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
        </div>
      </div>
    </div>
  );
}

// ── Colaboradores Tab ─────────────────────────────────────────────────────────

function ColaboradoresTab({ colaboradores }: { colaboradores: Colaborador[] }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = colaboradores.filter(c => {
    const q = search.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q) || c.departamento.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, cargo ou departamento…"
            className="w-full rounded-xl border border-line bg-surface-card py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
        </div>
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
                    <p className="truncate text-xs text-ink-soft">{c.cargo} · {c.departamento}</p>
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


// ── Main ──────────────────────────────────────────────────────────────────────

type TabKey = 'geral' | 'colaboradores';

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'geral',          label: 'Visão Geral',    icon: SquaresFour },
  { key: 'colaboradores',  label: 'Colaboradores',  icon: Users },
];

export function HubDP() {
  const [tab, setTab] = useState<TabKey>('geral');
  const [colaboradores] = useState<Colaborador[]>(seedColaboradores);

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

      {tab === 'geral'         && <VisaoGeral colaboradores={colaboradores} onTab={setTab} />}
      {tab === 'colaboradores' && <ColaboradoresTab colaboradores={colaboradores} />}
    </div>
  );
}
