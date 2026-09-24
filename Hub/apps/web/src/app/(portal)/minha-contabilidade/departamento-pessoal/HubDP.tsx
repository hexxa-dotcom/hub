'use client';

import { useState } from 'react';
import Link from 'next/link';
import { custoDoColaborador } from '@hexxa/core/folha';
import { useRouter } from 'next/navigation';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
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
import { Card } from '@/components/ui/Card';
import type { EmployeeRow, VacationRow } from './actions';
import {
  saveEmployeeAction,
  setEmployeeStatusAction,
  deleteEmployeeAction,
  addVacationPeriodAction,
  deleteVacationPeriodAction,
} from './actions';

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EmployeeRow['status'], { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ACTIVE:      { label: 'Ativo',     cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
  ON_VACATION: { label: 'Férias',    cls: 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)', icon: Calendar },
  TERMINATED:  { label: 'Desligado', cls: 'bg-black/5 text-ink-soft dark:bg-white/10 border border-black/5 dark:border-white/10',   icon: XCircle },
};

const VINCULOS = ['CLT', 'PJ', 'Socio', 'Estagiario'] as const;
const VINCULO_CLS: Record<string, string> = {
  CLT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  PJ: 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)',
  Socio: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20',
  Estagiario: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const lbl = 'text-xs font-bold text-ink-soft tracking-wide uppercase';
const field =
  'w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function initials(nome: string) {
  return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = ['bg-hexxa-forest', 'bg-[#2F4A3C]', 'bg-[#4B6354]', 'bg-[#3D5A80]', 'bg-[#5C6B73]'];
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
      <GradeDeResumo colunas={3}>
        <CardResumo
          destaque
          rotulo="Colaboradores ativos"
          valor={ativos.length}
          nota={`${colaboradores.length} no quadro total`}
          onClick={() => onTab('colaboradores')}
        />
        <CardResumo rotulo="Folha mensal estimada" valor={BRL.format(totalFolha)} nota="Dos colaboradores em atividade" onClick={() => onTab('custo')} />
        <CardResumo
          rotulo="Em férias"
          valor={emFerias.length}
          tom={emFerias.length > 0 ? 'alerta' : 'padrao'}
          nota="Neste momento"
          onClick={() => onTab('ferias')}
        />
      </GradeDeResumo>

      {colaboradores.length === 0 ? (
        <Card level={1} className="border-dashed p-12 text-center card-finish">
          <p className="font-serif font-bold text-base text-ink">Nenhum colaborador cadastrado ainda.</p>
          <button
            type="button"
            onClick={() => onTab('colaboradores')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 px-5 py-2 text-xs font-bold shadow-(--elev-1) transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Cadastrar o Primeiro Colaborador
          </button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card level={1} className="p-6 space-y-4 card-finish">
            <div className="flex items-center justify-between">
              <h2 className="rotulo text-ink-soft">Equipe Atual</h2>
              <button type="button" onClick={() => onTab('colaboradores')} className="text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline">
                Ver todos →
              </button>
            </div>
            <div className="space-y-2">
              {colaboradores.filter(c => c.status !== 'TERMINATED').slice(0, 5).map(c => {
                const st = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-3.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-hexxa-lime shadow-(--elev-inset) ${avatarColor(c.nome)}`}>
                      {initials(c.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{c.nome}</p>
                      <p className="truncate text-xs text-ink-soft">{c.cargo ?? '—'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card level={1} className="p-6 space-y-4 card-finish">
            <div className="flex items-center justify-between">
              <h2 className="rotulo text-ink-soft">Composição da Folha</h2>
            </div>
            <div className="space-y-2">
              {ativos.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-3.5">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${VINCULO_CLS[c.vinculo]}`}>{c.vinculo}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{c.nome}</p>
                  <span className="shrink-0 text-sm font-serif tabular font-bold text-ink">{BRL.format(c.salario)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-hexxa-forest text-hexxa-lime border border-white/5 px-5 py-3 shadow-(--elev-inset)">
              <span className="rotulo text-hexxa-lime/80">Total da Folha</span>
              <span className="font-serif tabular font-bold text-lg text-hexxa-lime">{BRL.format(totalFolha)}</span>
            </div>
            <p className="text-[11px] text-ink-soft">
              Apenas vínculos CLT e Pró-labore entram no cálculo do Fator R (Simples Nacional).
            </p>
          </Card>
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
      <div className="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/10 bg-surface-card p-6 sm:p-8 shadow-(--elev-3) card-finish space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="rotulo text-ink-soft">
            {colaborador ? 'Editar Colaborador' : 'Novo Colaborador'}
          </h2>
          <button type="button" onClick={onClose} className="tap-target pressable focusable rounded-full p-1.5 text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
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
                  <p className="rotulo text-hexxa-forest dark:text-hexxa-lime">
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
                  <div className="col-span-2 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-3 text-[11px] text-ink-soft">
                    Para reajustar valor, renovar ou cancelar o contrato deste PJ, acesse{' '}
                    <a href="/meu-negocio/contratos" className="font-bold text-hexxa-forest hover:underline dark:text-hexxa-lime">
                      Contratos
                    </a>.
                  </div>
                ) : (
                  <div className="col-span-2 rounded-2xl bg-hexxa-forest text-hexxa-lime border border-white/5 p-3 text-[11px] shadow-(--elev-inset)">
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
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 py-2.5 text-xs font-bold shadow-(--elev-1) transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar Colaborador'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-5 py-2.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-colors"
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
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, cargo ou departamento…"
            className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) py-2.5 pl-10 pr-4 text-xs sm:text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
          />
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, editId: null })}
          className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold shadow-(--elev-1) transition-all"
        >
          <Plus className="h-4 w-4" /> Novo Colaborador
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum colaborador encontrado com este filtro.</p>
        </div>
      ) : (
        <Card level={1} className="divide-y divide-black/5 dark:divide-white/10 overflow-hidden card-finish">
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
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold text-hexxa-lime shadow-(--elev-inset) ${avatarColor(c.nome)}`}>
                    {initials(c.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{c.nome}</p>
                    <p className="truncate text-xs text-ink-soft">{c.cargo ?? '—'}{c.departamento ? ` · ${c.departamento}` : ''}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-serif tabular font-bold text-ink">{BRL.format(c.salario)}</p>
                    <span className={`text-[10px] font-bold ${VINCULO_CLS[c.vinculo]} rounded-full px-2 py-0.5`}>{c.vinculo}</span>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${st.cls}`}>
                    <StatusIcon className="h-3 w-3" />
                    {st.label}
                  </span>
                  {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>
                {isExp && (
                  <div className="mx-5 mb-4 space-y-4 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-5">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className={lbl}>{c.vinculo === 'PJ' ? 'Início da Vigência' : 'Admissão'}</p><p className="font-bold text-ink">{fmtDate(c.admissao)}</p></div>
                      <div><p className={lbl}>{c.vinculo === 'PJ' ? 'Valor Mensal' : 'Remuneração'}</p><p className="font-serif tabular font-bold text-ink">{BRL.format(c.salario)}</p></div>
                      {c.email && <div><p className={lbl}>E-mail</p><p className="truncate text-xs text-ink-soft">{c.email}</p></div>}
                      {c.vinculo === 'PJ' && c.cnpj && <div><p className={lbl}>CNPJ</p><p className="text-xs text-ink-soft">{c.cnpj}</p></div>}
                      {c.vinculo === 'PJ' && c.vigenciaFim && <div><p className={lbl}>Fim da Vigência</p><p className="font-medium text-ink">{fmtDate(c.vigenciaFim)}</p></div>}
                      {c.vinculo === 'PJ' && c.vencimentoDia && <div><p className={lbl}>Vencimento</p><p className="font-medium text-ink">Todo dia {c.vencimentoDia}</p></div>}
                      {c.vinculo === 'PJ' && c.businessContractId && (
                        <div className="sm:col-span-3">
                          <a href={`/meu-negocio/contratos/${c.businessContractId}`} className="text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline">
                            Ver vínculo de pagamento →
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-black/5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setModal({ open: true, editId: c.id })}
                        className="rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
                      >
                        Editar
                      </button>
                      {c.status !== 'ON_VACATION' && (
                        <button
                          type="button"
                          onClick={() => handleStatus(c.id, 'ON_VACATION')}
                          disabled={busyId === c.id}
                          className="rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) px-4 py-1.5 text-xs font-bold disabled:opacity-50"
                        >
                          Marcar Férias
                        </button>
                      )}
                      {c.status !== 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleStatus(c.id, 'ACTIVE')}
                          disabled={busyId === c.id}
                          className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-4 py-1.5 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                        >
                          Reativar
                        </button>
                      )}
                      {c.status !== 'TERMINATED' && (
                        <button
                          type="button"
                          onClick={() => handleStatus(c.id, 'TERMINATED')}
                          disabled={busyId === c.id}
                          className="rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 px-4 py-1.5 text-xs font-bold hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        >
                          Desligar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={busyId === c.id}
                        className="ml-auto inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                      >
                        {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
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
      <Card level={1} className="p-6 sm:p-8 space-y-4 card-finish">
        <h2 className="rotulo text-ink-soft">Registrar Período de Férias</h2>
        <form onSubmit={submit} className="space-y-4">
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
              className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold shadow-(--elev-1) transition-all disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> {saving ? 'Salvando...' : 'Registrar Férias'}
            </button>
            <p className="text-[11px] text-ink-soft">
              O colaborador é marcado como &quot;Em férias&quot; automaticamente.
            </p>
          </div>
        </form>
      </Card>

      <Card level={1} className="divide-y divide-black/5 dark:divide-white/10 overflow-hidden card-finish">
        {ferias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-ink-soft">
            <Calendar className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum período de férias agendado no momento.</p>
          </div>
        ) : (
          ferias.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-4">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold text-hexxa-lime shadow-(--elev-inset) ${avatarColor(f.employeeName)}`}>
                {initials(f.employeeName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{f.employeeName}</p>
                <p className="text-xs text-ink-soft">{fmtDate(f.startDate)} até {fmtDate(f.endDate)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(f.id)}
                disabled={busyId === f.id}
                className="rounded-full p-2 text-ink-soft hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 transition-colors"
              >
                {busyId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ── Custo da equipe ───────────────────────────────────────────────────────────
// A folha oficial (eSocial, holerite, guias) é da contabilidade — o holerite
// chega pela Central e fica em Documentos. Aqui, o que o empresário precisa
// para planejar: quanto cada pessoa custa por mês, com FGTS e provisões.

function CustoTab({ colaboradores }: { colaboradores: EmployeeRow[] }) {
  const clt = colaboradores.filter((c) => c.status !== 'TERMINATED' && (c.vinculo === 'CLT' || c.vinculo === 'Estagiario'));
  const pj = colaboradores.filter((c) => c.status !== 'TERMINATED' && c.vinculo === 'PJ');
  const linhas = clt.map((c) => ({ c, custo: custoDoColaborador(c.salario) }));
  const total = linhas.reduce((s, l) => s + l.custo.custoMensal, 0);
  const salarios = linhas.reduce((s, l) => s + l.custo.salario, 0);
  const pjTotal = pj.reduce((s, c) => s + c.salario, 0);

  return (
    <div className="space-y-10">
      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo="Custo mensal da equipe CLT" valor={BRL.format(total)} nota={`${BRL.format(salarios)} em salários + FGTS e provisões`} />
        <CardResumo rotulo="Prestadores PJ" valor={BRL.format(pjTotal)} nota={`${pj.length} ${pj.length === 1 ? 'contrato' : 'contratos'} por mês`} />
        <CardResumo rotulo="Custo total com pessoas" valor={BRL.format(total + pjTotal)} nota="Por mês, sem o pró-labore" />
      </GradeDeResumo>

      <section className="space-y-3">
        <p className="rotulo text-ink-soft">CLT e estágio — quanto cada um custa por mês</p>
        {linhas.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-8 text-sm text-ink-soft dark:border-white/10">Nenhum colaborador CLT ou estagiário ativo.</p>
        ) : (
          <div className="overflow-x-auto rounded-[28px] border border-black/5 dark:border-white/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-5 py-3 font-medium">Colaborador</th>
                  <th className="px-3 py-3 text-right font-medium">Salário</th>
                  <th className="px-3 py-3 text-right font-medium">Líquido</th>
                  <th className="px-3 py-3 text-right font-medium">FGTS</th>
                  <th className="px-3 py-3 text-right font-medium">Férias + 13º</th>
                  <th className="px-5 py-3 text-right font-medium">Custo/mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {linhas.map(({ c, custo }) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-ink">{c.nome}</p>
                      <p className="text-xs text-ink-soft">{c.cargo ?? c.vinculo}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular text-ink">{BRL.format(custo.salario)}</td>
                    <td className="px-3 py-3 text-right tabular text-ink-soft" title={`INSS ${BRL.format(custo.inssRetido)} · IRRF ${BRL.format(custo.irrfRetido)}`}>{BRL.format(custo.liquido)}</td>
                    <td className="px-3 py-3 text-right tabular text-ink-soft">{BRL.format(custo.fgts + custo.fgtsProvisoes)}</td>
                    <td className="px-3 py-3 text-right tabular text-ink-soft">{BRL.format(custo.provisaoFerias + custo.provisao13)}</td>
                    <td className="px-5 py-3 text-right font-serif font-bold tabular text-ink">{BRL.format(custo.custoMensal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs leading-relaxed text-ink-soft">
          Estimativa pelas tabelas de 2026 (INSS, IRRF com isenção até R$ 5.000, FGTS de 8%) para empresas do Simples — a contribuição patronal já
          está no DAS. Férias + 13º é o que guardar por mês para pagá-los. O salário líquido entra no financeiro como previsão todo dia 1º; a folha
          oficial e o holerite vêm da contabilidade, pela Central, e ficam em{' '}
          <Link href="/minha-contabilidade/arquivos" className="font-semibold text-ink underline-offset-4 hover:underline">
            Documentos
          </Link>
          .
        </p>
      </section>

      {pj.length > 0 && (
        <section className="space-y-3">
          <p className="rotulo text-ink-soft">Prestadores PJ</p>
          <ul className="divide-y divide-black/5 rounded-[28px] border border-black/5 dark:divide-white/10 dark:border-white/10">
            {pj.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{c.nome}</p>
                  <p className="text-xs text-ink-soft">{c.cargo ?? 'Prestador PJ'}{c.vigenciaFim ? ` · contrato até ${fmtDate(c.vigenciaFim)}` : ''}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(c.salario)}</p>
                  {c.businessContractId ? (
                    <Link href={`/meu-negocio/contratos/${c.businessContractId}` as never} className="text-xs font-semibold text-ink-soft hover:text-ink">
                      Ver contrato
                    </Link>
                  ) : (
                    <Link href="/meu-negocio/contratos" className="text-xs font-semibold text-ink-soft hover:text-ink">
                      Fazer contrato PJ
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type TabKey = 'geral' | 'colaboradores' | 'ferias' | 'custo';

const TABS: { id: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'geral',          label: 'Visão Geral',        icon: LayoutGrid },
  { id: 'colaboradores',  label: 'Colaboradores',      icon: Users },
  { id: 'ferias',         label: 'Férias',             icon: Calendar },
  { id: 'custo',          label: 'Custo da equipe',    icon: Receipt },
];

export function HubDP({
  initialColaboradores,
  initialFerias,
}: {
  initialColaboradores: EmployeeRow[];
  initialFerias: VacationRow[];
}) {
  const [tab, setTab] = useState<TabKey>('geral');

  return (
    <div className="space-y-8">
      <div className="flex overflow-x-auto no-scrollbar py-1">
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
      {tab === 'custo'         && <CustoTab colaboradores={initialColaboradores} />}
    </div>
  );
}

