'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  Users,
  Wallet,
  Calendar,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Trash2,
  Loader2,
  FileText,
  Receipt,
  Sparkles,
} from 'lucide-react';
import type { EmployeeRow, VacationRow, PayslipRow } from './actions';
import {
  saveEmployeeAction,
  setEmployeeStatusAction,
  deleteEmployeeAction,
  addVacationPeriodAction,
  deleteVacationPeriodAction,
  generatePayslipsAction,
} from './actions';

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EmployeeRow['status'], { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ACTIVE:      { label: 'Ativo',     cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', icon: CheckCircle2 },
  ON_VACATION: { label: 'Férias',    cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]', icon: Calendar },
  TERMINATED:  { label: 'Desligado', cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]',   icon: XCircle },
};

const VINCULOS = ['CLT', 'PJ', 'Socio', 'Estagiario'] as const;
const VINCULO_CLS: Record<string, string> = {
  CLT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  PJ: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]',
  Socio: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  Estagiario: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] tracking-wide uppercase';
const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-colors';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function initials(nome: string) {
  return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = ['bg-[#1E3328]', 'bg-[#2F4A3C]', 'bg-[#4B6354]', 'bg-[#3D5A80]', 'bg-[#5C6B73]'];
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onTab('colaboradores')}
          className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-left hover:bg-[#F4EFE4] dark:hover:bg-[#1A201C] transition-all shadow-sm group"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Colaboradores Ativos</p>
            <div className="p-2 rounded-xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3]">{ativos.length}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{colaboradores.length} no quadro total</p>
        </button>

        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-left shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Folha Mensal Estimada</p>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-emerald-700 dark:text-emerald-400">{BRL.format(totalFolha)}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">colaboradores em atividade</p>
        </div>

        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-left shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Em Férias</p>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <p className={`mt-3 font-serif font-bold text-2xl sm:text-3xl ${emFerias.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>
            {emFerias.length}
          </p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">período de recesso atual</p>
        </div>
      </div>

      {colaboradores.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/15 dark:border-white/15 bg-[#F4EFE4]/40 dark:bg-[#1A201C]/40 p-12 text-center">
          <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nenhum colaborador cadastrado ainda.</p>
          <button
            type="button"
            onClick={() => onTab('colaboradores')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Cadastrar o Primeiro Colaborador
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Equipe Atual</h2>
              <button type="button" onClick={() => onTab('colaboradores')} className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
                Ver todos →
              </button>
            </div>
            <div className="space-y-2">
              {colaboradores.filter(c => c.status !== 'TERMINATED').slice(0, 5).map(c => {
                const st = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-[#DFFFAE] ${avatarColor(c.nome)}`}>
                      {initials(c.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{c.nome}</p>
                      <p className="truncate text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.cargo ?? '—'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Composição da Folha</h2>
            </div>
            <div className="space-y-2">
              {ativos.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${VINCULO_CLS[c.vinculo]}`}>{c.vinculo}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#231F20] dark:text-[#FEFDF3]">{c.nome}</p>
                  <span className="shrink-0 text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(c.salario)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#EFFFD6] dark:bg-[#2F4A3C]/40 border border-[#2F4A3C]/10 px-5 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE]">Total da Folha</span>
              <span className="font-serif font-bold text-lg text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(totalFolha)}</span>
            </div>
            <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
              Apenas vínculos CLT e Pró-labore entram no cálculo do Fator R (Simples Nacional).
            </p>
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
  const [cnpj, setCnpj] = useState(colaborador?.cnpj ?? '');
  const [vigenciaFim, setVigenciaFim] = useState(colaborador?.vigenciaFim ?? '');
  const [vencimentoDia, setVencimentoDia] = useState(String(colaborador?.vencimentoDia ?? '10'));
  const [saving, setSaving] = useState(false);
  const isPJ = vinculo === 'PJ';
  const isEditing = Boolean(colaborador);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveEmployeeAction({
        id: colaborador?.id,
        nome, cpf, cargo, departamento,
        salario: Number(salario.replace(',', '.')) || 0,
        vinculo, admissao, email,
        cnpj: isPJ ? cnpj : undefined,
        vigenciaFim: isPJ ? vigenciaFim : undefined,
        vencimentoDia: isPJ ? Number(vencimentoDia) || undefined : undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">
            {colaborador ? 'Editar Colaborador' : 'Novo Colaborador'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Nome Completo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} required className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className={lbl}>CPF</label>
              <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className={lbl}>Vínculo</label>
              <select value={vinculo} onChange={e => setVinculo(e.target.value)} className={`mt-1.5 ${field}`}>
                {VINCULOS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Cargo</label>
              <input value={cargo} onChange={e => setCargo(e.target.value)} className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className={lbl}>Departamento</label>
              <input value={departamento} onChange={e => setDepartamento(e.target.value)} className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className={lbl}>{isPJ ? 'Valor Mensal (R$)' : 'Remuneração (R$)'}</label>
              <input value={salario} onChange={e => setSalario(e.target.value)} inputMode="decimal" required className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className={lbl}>{isPJ ? 'Início da Vigência' : 'Admissão'}</label>
              <input type="date" value={admissao} onChange={e => setAdmissao(e.target.value)} className={`mt-1.5 ${field}`} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`mt-1.5 ${field}`} />
            </div>

            {isPJ && (
              <>
                <div className="col-span-2 pt-2 border-t border-black/5 dark:border-white/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE]">
                    Contrato de Prestação de Serviços (PJ)
                  </p>
                </div>
                <div>
                  <label className={lbl}>CNPJ</label>
                  <input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className={`mt-1.5 ${field}`} />
                </div>
                <div>
                  <label className={lbl}>Dia do Vencimento</label>
                  <input type="number" min={1} max={28} value={vencimentoDia} onChange={e => setVencimentoDia(e.target.value)} className={`mt-1.5 ${field}`} />
                </div>
                <div>
                  <label className={lbl}>Fim da Vigência</label>
                  <input type="date" value={vigenciaFim} onChange={e => setVigenciaFim(e.target.value)} className={`mt-1.5 ${field}`} />
                </div>
                {isEditing ? (
                  <div className="col-span-2 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                    Para reajustar valor, renovar ou cancelar o contrato deste PJ, acesse{' '}
                    <a href="/meu-negocio/contratos" className="font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
                      Contratos
                    </a>.
                  </div>
                ) : (
                  <div className="col-span-2 rounded-2xl bg-[#EFFFD6] dark:bg-[#2F4A3C]/30 border border-[#2F4A3C]/10 p-3 text-[11px] text-[#2F4A3C] dark:text-[#DFFFAE]">
                    Ao salvar, um contrato de pagamento recorrente é criado automaticamente com esses dados.
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-2.5 text-xs font-bold text-[#DFFFAE] transition-all hover:scale-105 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar Colaborador'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/10 dark:border-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
            >
              Cancelar
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E6A61] dark:text-[#A8A49C]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, cargo ou departamento…"
            className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]"
          />
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, editId: null })}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
        >
          <Plus className="h-4 w-4" /> Novo Colaborador
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum colaborador encontrado com este filtro.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10 overflow-hidden shadow-sm">
          {filtered.map(c => {
            const st = STATUS_CONFIG[c.status];
            const StatusIcon = st.icon;
            const isExp = expanded === c.id;
            return (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExp ? null : c.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold text-[#DFFFAE] ${avatarColor(c.nome)}`}>
                    {initials(c.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{c.nome}</p>
                    <p className="truncate text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.cargo ?? '—'}{c.departamento ? ` · ${c.departamento}` : ''}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(c.salario)}</p>
                    <span className={`text-[10px] font-bold ${VINCULO_CLS[c.vinculo]} rounded-full px-2 py-0.5`}>{c.vinculo}</span>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${st.cls}`}>
                    <StatusIcon className="h-3 w-3" />
                    {st.label}
                  </span>
                  {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-[#6E6A61]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#6E6A61]" />}
                </button>
                {isExp && (
                  <div className="mx-5 mb-4 space-y-4 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-5">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className={lbl}>{c.vinculo === 'PJ' ? 'Início da Vigência' : 'Admissão'}</p><p className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{fmtDate(c.admissao)}</p></div>
                      <div><p className={lbl}>{c.vinculo === 'PJ' ? 'Valor Mensal' : 'Remuneração'}</p><p className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(c.salario)}</p></div>
                      {c.email && <div><p className={lbl}>E-mail</p><p className="truncate text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.email}</p></div>}
                      {c.vinculo === 'PJ' && c.cnpj && <div><p className={lbl}>CNPJ</p><p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.cnpj}</p></div>}
                      {c.vinculo === 'PJ' && c.vigenciaFim && <div><p className={lbl}>Fim da Vigência</p><p className="font-medium">{fmtDate(c.vigenciaFim)}</p></div>}
                      {c.vinculo === 'PJ' && c.vencimentoDia && <div><p className={lbl}>Vencimento</p><p className="font-medium">Todo dia {c.vencimentoDia}</p></div>}
                      {c.vinculo === 'PJ' && c.businessContractId && (
                        <div className="sm:col-span-3">
                          <a href={`/meu-negocio/contratos/${c.businessContractId}`} className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
                            Ver vínculo de pagamento →
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-black/5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setModal({ open: true, editId: c.id })}
                        className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
                      >
                        Editar
                      </button>
                      {c.status !== 'ON_VACATION' && (
                        <button
                          type="button"
                          onClick={() => handleStatus(c.id, 'ON_VACATION')}
                          disabled={busyId === c.id}
                          className="rounded-full bg-[#EFFFD6] px-4 py-1.5 text-xs font-bold text-[#2F4A3C] hover:bg-[#DFFFAE] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] disabled:opacity-50"
                        >
                          Marcar Férias
                        </button>
                      )}
                      {c.status !== 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleStatus(c.id, 'ACTIVE')}
                          disabled={busyId === c.id}
                          className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-4 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 disabled:opacity-50"
                        >
                          Reativar
                        </button>
                      )}
                      {c.status !== 'TERMINATED' && (
                        <button
                          type="button"
                          onClick={() => handleStatus(c.id, 'TERMINATED')}
                          disabled={busyId === c.id}
                          className="rounded-full bg-red-100 dark:bg-red-950 px-4 py-1.5 text-xs font-bold text-red-800 dark:text-red-300 hover:bg-red-200 disabled:opacity-50"
                        >
                          Desligar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={busyId === c.id}
                        className="ml-auto inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remover
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

// ── Férias Tab ────────────────────────────────────────────────────────────────

function FeriasTab({ colaboradores, ferias }: { colaboradores: EmployeeRow[]; ferias: VacationRow[] }) {
  const router = useRouter();
  const elegiveis = colaboradores.filter(c => c.status !== 'TERMINATED');
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !startDate || !endDate) return;
    setSaving(true);
    try {
      await addVacationPeriodAction({ employeeId, startDate, endDate });
      setEmployeeId('');
      setEndDate('');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteVacationPeriodAction(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Registrar Período de Férias</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={lbl}>Colaborador</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required className={`mt-1.5 ${field}`}>
              <option value="">— Selecione o Colaborador —</option>
              {elegiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Data de Início</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className={lbl}>Data de Retorno</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className={`mt-1.5 ${field}`} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> {saving ? 'Salvando...' : 'Registrar Férias'}
          </button>
          <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
            O colaborador é marcado como &quot;Em férias&quot; automaticamente.
          </p>
        </div>
      </form>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10 overflow-hidden shadow-sm">
        {ferias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-[#6E6A61] dark:text-[#A8A49C]">
            <Calendar className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum período de férias agendado no momento.</p>
          </div>
        ) : (
          ferias.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-4">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold text-[#DFFFAE] ${avatarColor(f.employeeName)}`}>
                {initials(f.employeeName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{f.employeeName}</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{fmtDate(f.startDate)} até {fmtDate(f.endDate)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(f.id)}
                disabled={busyId === f.id}
                className="rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 transition-colors"
              >
                {busyId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Folha de Pagamento Tab ───────────────────────────────────────────────────

function FolhaTab({ colaboradores, folhas }: { colaboradores: EmployeeRow[]; folhas: PayslipRow[] }) {
  const router = useRouter();
  const elegiveis = colaboradores.filter(c => c.status === 'ACTIVE' && (c.vinculo === 'CLT' || c.vinculo === 'Estagiario'));
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function gerar() {
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await generatePayslipsAction(mes);
      setFeedback({ ok: res.ok, msg: res.message });
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  const folhasDoMes = folhas.filter(f => f.referenceMonth.slice(0, 7) === mes);
  const totalMes = folhasDoMes.reduce((s, f) => s + f.netAmount, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Gerar Folha do Mês</h2>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          Cria os holerites e lançamentos a pagar para colaboradores CLT e estagiários ativos ({elegiveis.length} elegíveis).
        </p>
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div>
            <label className={lbl}>Mês de Referência</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} className={`mt-1.5 ${field}`} />
          </div>
          <button
            type="button"
            onClick={gerar}
            disabled={generating || elegiveis.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {generating ? 'Gerando...' : 'Gerar Folha do Mês'}
          </button>
        </div>
        {feedback && (
          <p className={`text-xs font-bold ${feedback.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {feedback.msg}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Holerites de {mes}</h2>
          <span className="font-serif font-bold text-base text-emerald-700 dark:text-emerald-400">{BRL.format(totalMes)}</span>
        </div>
        {folhasDoMes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-[#6E6A61] dark:text-[#A8A49C]">
            <FileText className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhuma folha gerada para este mês ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {folhasDoMes.map(f => (
              <div key={f.id} className="flex items-center gap-3 py-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold text-[#DFFFAE] ${avatarColor(f.employeeName)}`}>
                  {initials(f.employeeName)}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{f.employeeName}</p>
                <span className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(f.netAmount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabKey = 'geral' | 'colaboradores' | 'ferias' | 'folha';

const TABS: { id: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'geral',          label: 'Visão Geral',        icon: LayoutGrid },
  { id: 'colaboradores',  label: 'Colaboradores',      icon: Users },
  { id: 'ferias',         label: 'Férias',             icon: Calendar },
  { id: 'folha',          label: 'Folha de Pagamento', icon: Receipt },
];

export function HubDP({
  initialColaboradores,
  initialFerias,
  initialFolhas,
}: {
  initialColaboradores: EmployeeRow[];
  initialFerias: VacationRow[];
  initialFolhas: PayslipRow[];
}) {
  const [tab, setTab] = useState<TabKey>('geral');

  return (
    <div className="space-y-6">
      <div className="flex">
        <SegmentedTabs
          tabs={TABS}
          activeTab={tab}
          onChange={setTab}
          layoutId="dpTabsIndicator"
        />
      </div>

      {tab === 'geral'         && <VisaoGeral colaboradores={initialColaboradores} onTab={setTab} />}
      {tab === 'colaboradores' && <ColaboradoresTab colaboradores={initialColaboradores} />}
      {tab === 'ferias'        && <FeriasTab colaboradores={initialColaboradores} ferias={initialFerias} />}
      {tab === 'folha'         && <FolhaTab colaboradores={initialColaboradores} folhas={initialFolhas} />}
    </div>
  );
}

