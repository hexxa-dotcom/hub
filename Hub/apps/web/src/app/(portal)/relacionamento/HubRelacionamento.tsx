'use client';

import { useState, useRef, useActionState } from 'react';
import Link from 'next/link';
import { Users, Signature, Scan, SquaresFour, Plus, MagnifyingGlass, Phone, EnvelopeSimple, MapPin, Buildings, Spinner, CheckCircle, WarningCircle, X, Trash, ArrowSquareOut, ArrowsClockwise, Clock, XCircle, CaretDown, CaretUp, UserPlus, UploadSimple, PaperPlaneRight, Copy, Check, PencilSimpleLine, CalendarBlank, CurrencyDollar, FileText, Warning, Shield, ClipboardText, Target } from '@phosphor-icons/react';
import EmailViewer from '@/components/crm/EmailViewer';
import EmailComposer from '@/components/crm/EmailComposer';
import { addCustomerAction, type CustomerState } from '../meu-negocio/clientes/actions';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';
import { ContratosClient } from '../meu-negocio/contratos/ContratosClient';
import type { CnpjData } from '@/app/api/cnpj/[cnpj]/route';

// ── Types ─────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  type: string | null;
  address: string | null;
};

type ContratoStatus = 'ativo' | 'renovar' | 'expirado' | 'rascunho';

type Contrato = {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  tipo: string;
  inicio: string;
  fim: string;
  valor: number | null;
  observacoes: string | null;
  status: ContratoStatus;
};

type TarefaStatus = 'pendente' | 'em_andamento' | 'concluida';
type TarefaPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  clienteNome: string | null;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  prazo: string | null;
  criadaEm: string;
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

const field = 'block w-full rounded-xl border border-line bg-surface px-4 py-2 text-sm text-ink outline-none transition-shadow focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20';
const lbl = 'text-xs font-medium text-ink-soft';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-brand-500', 'bg-ok/80', 'bg-warn/80', 'bg-critical/80',
  'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-orange-500',
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function computeStatus(inicio: string, fim: string): ContratoStatus {
  const now = new Date();
  const end = new Date(fim);
  const start = new Date(inicio);
  if (end < now) return 'expirado';
  if (start > now) return 'rascunho';
  const days = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) return 'renovar';
  return 'ativo';
}

const STATUS_CONFIG: Record<ContratoStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ativo:    { label: 'Ativo',          cls: 'bg-ok/10 text-ok',          icon: CheckCircle },
  renovar:  { label: 'Renovar em breve', cls: 'bg-warn/10 text-warn',    icon: Warning },
  expirado: { label: 'Expirado',       cls: 'bg-critical/10 text-critical', icon: XCircle },
  rascunho: { label: 'Futuro',         cls: 'bg-ink/10 text-ink-soft',   icon: Clock },
};

const TIPOS_CONTRATO = [
  'Prestação de Serviços',
  'Contrato de Assessoria',
  'Locação',
  'Parceria Comercial',
  'Licença de Software',
  'Contrato de Trabalho',
  'Outro',
];

const TAREFA_STATUS_CONFIG: Record<TarefaStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  pendente:     { label: 'Pendente',     cls: 'bg-ink/10 text-ink-soft',                              icon: Clock },
  em_andamento: { label: 'Em andamento', cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',  icon: Target },
  concluida:    { label: 'Concluída',    cls: 'bg-ok/10 text-ok',                                     icon: CheckCircle },
};

const PRIORIDADE_CONFIG: Record<TarefaPrioridade, { label: string; cls: string }> = {
  baixa:   { label: 'Baixa',   cls: 'bg-ink/10 text-ink-soft' },
  normal:  { label: 'Normal',  cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400' },
  alta:    { label: 'Alta',    cls: 'bg-warn/10 text-warn' },
  urgente: { label: 'Urgente', cls: 'bg-critical/10 text-critical' },
};

function prazoInfo(prazo: string | null): { text: string; cls: string } {
  if (!prazo) return { text: 'Sem prazo', cls: 'text-ink-soft' };
  const days = Math.ceil((new Date(prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `Atrasado ${Math.abs(days)}d`, cls: 'text-critical font-medium' };
  if (days === 0) return { text: 'Hoje', cls: 'text-warn font-medium' };
  if (days === 1) return { text: 'Amanhã', cls: 'text-warn' };
  return { text: new Date(prazo).toLocaleDateString('pt-BR'), cls: 'text-ink-soft' };
}

function seedTarefas(): Tarefa[] {
  const add = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  return [
    { id: 't1', titulo: 'Enviar proposta de renovação', descricao: 'Preparar proposta atualizada do contrato de assessoria.', clienteNome: 'Varejo Express ME', status: 'pendente', prioridade: 'alta', prazo: add(5), criadaEm: add(-3) },
    { id: 't2', titulo: 'Reunião de onboarding', descricao: 'Apresentar o portal ao cliente e configurar acesso.', clienteNome: 'Tech Solutions Ltda', status: 'em_andamento', prioridade: 'normal', prazo: add(2), criadaEm: add(-7) },
    { id: 't3', titulo: 'Revisar contrato antes de assinar', descricao: null, clienteNome: null, status: 'pendente', prioridade: 'urgente', prazo: add(1), criadaEm: add(-1) },
    { id: 't4', titulo: 'Cadastrar novo cliente no sistema', descricao: null, clienteNome: 'Alfa Indústria SA', status: 'concluida', prioridade: 'baixa', prazo: null, criadaEm: add(-10) },
    { id: 't5', titulo: 'Atualizar dados cadastrais', descricao: 'Verificar endereço e contatos atualizados.', clienteNome: 'Tech Solutions Ltda', status: 'pendente', prioridade: 'normal', prazo: add(10), criadaEm: add(-2) },
  ];
}


// ── Visão Geral ───────────────────────────────────────────────────────────────

function VisaoGeral({
  customers, contracts, contratos, tarefas, onTab,
}: {
  customers: Customer[];
  contracts: SignatureRequestSummary[];
  contratos: Contrato[];
  tarefas: Tarefa[];
  onTab: (t: TabKey) => void;
}) {
  const ativos = contratos.filter(c => c.status === 'ativo').length;
  const renovar = contratos.filter(c => c.status === 'renovar').length;
  const expirados = contratos.filter(c => c.status === 'expirado').length;
  const pendingAssin = contracts.filter(d => d.status === 'PENDING' || d.status === 'SENT').length;
  const recent = [...customers].slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button type="button" onClick={() => onTab('clientes')} className="card-flat rounded-card p-4 text-left transition-colors hover:bg-surface-card border border-line dark:hover:bg-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Clientes</p>
            <Users className="h-4 w-4 text-brand-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{customers.length}</p>
          <p className="mt-0.5 text-xs text-brand-500">Ver todos →</p>
        </button>

        <Link href="/meu-negocio/contratos" className="card-flat rounded-card p-4 text-left transition-colors hover:bg-surface-card border border-line dark:hover:bg-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Contratos ativos</p>
            <FileText className="h-4 w-4 text-ok" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-ok">{ativos}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{expirados} expirado{expirados !== 1 ? 's' : ''}</p>
        </Link>

        <Link href="/meu-negocio/contratos" className="card-flat rounded-card p-4 text-left transition-colors hover:bg-surface-card border border-line dark:hover:bg-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Renovar em breve</p>
            <Warning className="h-4 w-4 text-warn" />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${renovar > 0 ? 'text-warn' : ''}`}>{renovar}</p>
          <p className="mt-0.5 text-xs text-ink-soft">nos próximos 30 dias</p>
        </Link>

        <button type="button" onClick={() => onTab('assinatura')} className="card-flat rounded-card p-4 text-left transition-colors hover:bg-surface-card border border-line dark:hover:bg-white/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Aguardando assinatura</p>
            <PencilSimpleLine className="h-4 w-4 text-brand-500" />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${pendingAssin > 0 ? 'text-warn' : ''}`}>{pendingAssin}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{contracts.length} doc{contracts.length !== 1 ? 's' : ''} enviado{contracts.length !== 1 ? 's' : ''}</p>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Clientes recentes */}
        <div className="card-flat rounded-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Clientes recentes</h2>
            <button type="button" onClick={() => onTab('clientes')} className="text-xs text-brand-500 hover:underline">Ver todos</button>
          </div>
          {recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {recent.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-card border border-line px-3 py-2 dark:bg-white/5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${avatarColor(c.name)}`}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-ink-soft">{c.document ?? c.email ?? '—'}</p>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.type === 'PF' ? 'bg-ok/10 text-ok' : 'bg-brand-500/10 text-brand-500'}`}>
                    {c.type ?? 'PJ'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => onTab('clientes')} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
        </div>

        {/* Contratos com vencimento próximo */}
        <div className="card-flat rounded-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Contratos — visão rápida</h2>
            <Link href="/meu-negocio/contratos" className="text-xs text-brand-500 hover:underline">Gerenciar</Link>
          </div>
          {contratos.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">Nenhum contrato registrado.</p>
          ) : (
            <div className="space-y-2">
              {contratos.slice(0, 5).map(c => {
                const cfg = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-card border border-line px-3 py-2 dark:bg-white/5">
                    <FileText className="h-4 w-4 shrink-0 text-brand-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.clienteNome}</p>
                      <p className="truncate text-xs text-ink-soft">{c.tipo} · até {new Date(c.fim).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/meu-negocio/contratos" className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
            <Plus className="h-4 w-4" /> Novo contrato
          </Link>
        </div>
      </div>

      {/* Tarefas em aberto */}
      <div className="card-flat rounded-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tarefas em aberto</h2>
          <button type="button" onClick={() => onTab('tarefas')} className="text-xs text-brand-500 hover:underline">Ver todas</button>
        </div>
        {tarefas.filter(t => t.status !== 'concluida').length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">Nenhuma tarefa pendente.</p>
        ) : (
          <div className="space-y-2">
            {tarefas.filter(t => t.status !== 'concluida').slice(0, 4).map(t => {
              const pri = PRIORIDADE_CONFIG[t.prioridade];
              const pz = prazoInfo(t.prazo);
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-surface-card border border-line px-3 py-2 dark:bg-white/5">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pri.cls}`}>{pri.label}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{t.titulo}</p>
                  {t.clienteNome && <p className="hidden truncate text-xs text-ink-soft sm:block">{t.clienteNome}</p>}
                  <span className={`shrink-0 text-xs ${pz.cls}`}>{pz.text}</span>
                </div>
              );
            })}
          </div>
        )}
        <button type="button" onClick={() => onTab('tarefas')} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      {/* Quick action — CNPJ */}
      <div className="card-flat rounded-card flex flex-wrap items-center gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
            <Scan className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Consulta de CNPJ</p>
            <p className="text-xs text-ink-soft">Consulte dados da Receita Federal antes de cadastrar um cliente.</p>
          </div>
        </div>
        <button type="button" onClick={() => onTab('cnpj')} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-brand-400/40 px-4 py-2 text-sm font-medium text-brand-500 hover:bg-brand-500/10">
          <Scan className="h-4 w-4" /> Consultar CNPJ
        </button>
      </div>
    </div>
  );
}

// ── Add Customer Form ─────────────────────────────────────────────────────────

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

function AddClienteForm({ onClose, onAdded }: { onClose: () => void; onAdded: (c: Customer) => void }) {
  const initial: CustomerState = { ok: false, message: '' };
  const [state, action, pending] = useActionState(async (prev: CustomerState, fd: FormData) => {
    const res = await addCustomerAction(prev, fd);
    if (res.ok) {
      onAdded({ id: crypto.randomUUID(), name: String(fd.get('nome') ?? ''), document: String(fd.get('documento') ?? '') || null, email: String(fd.get('email') ?? '') || null, phone: String(fd.get('telefone') ?? '') || null, type: String(fd.get('tipo') ?? 'PJ'), address: null });
      onClose();
    }
    return res;
  }, initial);

  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefoneRef = useRef<HTMLInputElement>(null);
  const enderecoRef = useRef<HTMLInputElement>(null);
  const cepRef = useRef<HTMLInputElement>(null);
  const cidadeRef = useRef<HTMLInputElement>(null);
  const ufRef = useRef<HTMLSelectElement>(null);

  function formatCnpj(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  }

  async function lookupCnpj(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setLookupStatus('loading');
    try {
      const res = await fetch(`/api/cnpj/${digits}`);
      if (!res.ok) { setLookupStatus('not_found'); return; }
      const data: CnpjData = await res.json();
      if (nomeRef.current) nomeRef.current.value = data.razaoSocial;
      if (emailRef.current) emailRef.current.value = data.email ?? '';
      if (telefoneRef.current) telefoneRef.current.value = data.telefone ?? '';
      if (enderecoRef.current) enderecoRef.current.value = data.endereco ?? '';
      if (cepRef.current) cepRef.current.value = data.cep ?? '';
      if (cidadeRef.current) cidadeRef.current.value = data.municipio ?? '';
      if (ufRef.current && data.uf) ufRef.current.value = data.uf;
      setLookupStatus('found');
    } catch { setLookupStatus('error'); }
  }

  return (
    <form action={action} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Novo cliente</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>Tipo</label>
          <select name="tipo" defaultValue="PJ" className={`mt-1 ${field}`}>
            <option value="PJ">Pessoa Jurídica (CNPJ)</option>
            <option value="PF">Pessoa Física (CPF)</option>
          </select>
        </div>
        <div>
          <label className={lbl}>CNPJ / CPF</label>
          <div className="relative mt-1">
            <input name="documento" required placeholder="00.000.000/0001-00"
              onInput={e => { const el = e.currentTarget; el.value = formatCnpj(el.value); if (el.value.replace(/\D/g,'').length === 14) lookupCnpj(el.value); else setLookupStatus('idle'); }}
              className={`${field} pr-9`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {lookupStatus === 'loading' && <Spinner className="h-4 w-4 animate-spin text-ink-soft" />}
              {lookupStatus === 'found' && <CheckCircle className="h-4 w-4 text-ok" />}
              {(lookupStatus === 'not_found' || lookupStatus === 'error') && <WarningCircle className="h-4 w-4 text-warn" />}
            </span>
          </div>
          {lookupStatus === 'found' && <p className="mt-1 text-[11px] text-ok">✓ Dados da Receita Federal preenchidos</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Razão Social / Nome</label>
          <input ref={nomeRef} name="nome" required placeholder="Nome completo ou razão social" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>E-mail</label>
          <input ref={emailRef} name="email" type="email" placeholder="email@empresa.com" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Telefone</label>
          <input ref={telefoneRef} name="telefone" placeholder="(11) 98765-4321" className={`mt-1 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Endereço</label>
          <input ref={enderecoRef} name="endereco" placeholder="Rua, número, bairro" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>CEP</label>
          <input ref={cepRef} name="cep" placeholder="00000-000" className={`mt-1 ${field}`} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={lbl}>Cidade</label>
            <input ref={cidadeRef} name="cidade" placeholder="São Paulo" className={`mt-1 ${field}`} />
          </div>
          <div>
            <label className={lbl}>UF</label>
            <select ref={ufRef} name="uf" className={`mt-1 ${field}`}>
              <option value="">—</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
      </div>
      {state.message && !state.ok && (
        <p className="flex items-center gap-2 rounded-xl bg-critical/10 px-3 py-2 text-xs text-critical">
          <WarningCircle className="h-3.5 w-3.5 shrink-0" />{state.message}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {pending ? <Spinner className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cadastrar
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      </div>
    </form>
  );
}

// ── Clientes Tab ──────────────────────────────────────────────────────────────

function ClientesTab({ initial }: { initial: Customer[] }) {
  const [clientes, setClientes] = useState(initial);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'PJ' | 'PF'>('todos');

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.document ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q);
    return matchSearch && (filter === 'todos' || c.type === filter);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, documento, e-mail…"
            className="w-full rounded-xl border border-line bg-surface-card py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
        </div>
        <div className="flex gap-1">
          {(['todos','PJ','PF'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
              {f === 'todos' ? `Todos (${clientes.length})` : f === 'PJ' ? `PJ (${clientes.filter(c=>c.type==='PJ').length})` : `PF (${clientes.filter(c=>c.type==='PF').length})`}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </div>

      {showForm && <AddClienteForm onClose={() => setShowForm(false)} onAdded={c => setClientes(prev => [c, ...prev])} />}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <Users className="h-10 w-10 opacity-20" />
          <p className="text-sm">{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
          {!search && <button type="button" onClick={() => setShowForm(true)} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Adicionar primeiro cliente</button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => (
            <div key={c.id} className="card-flat rounded-card p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white ${avatarColor(c.name)}`}>{initials(c.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-sm font-semibold leading-tight">{c.name}</p>
                    <span className={`ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c.type === 'PF' ? 'bg-ok/10 text-ok' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'}`}>{c.type ?? 'PJ'}</span>
                  </div>
                  {c.document && <p className="mt-0.5 font-mono text-xs text-ink-soft">{c.document}</p>}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {c.email && <p className="flex items-center gap-1.5 truncate text-xs text-ink-soft"><EnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-brand-400" />{c.email}</p>}
                {c.phone && <p className="flex items-center gap-1.5 text-xs text-ink-soft"><Phone className="h-3.5 w-3.5 shrink-0 text-brand-400" />{c.phone}</p>}
                {c.address && <p className="flex items-center gap-1.5 truncate text-xs text-ink-soft"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand-400" />{c.address}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmailTab({ companyId, customers }: { companyId: string; customers: Customer[] }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [showConfig, setShowConfig] = useState(false);
  const [replyingEmail, setReplyingEmail] = useState<any>(null);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-4">
      {/* Top Banner / Actions */}
      <div className="card-flat rounded-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
            <EnvelopeSimple className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Gerenciamento de E-mails CRM</h2>
            <p className="text-xs text-ink-soft">Envie e receba e-mails vinculados diretamente aos seus clientes.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowConfig(v => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-surface-card border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-black/5"
        >
          ⚙️ Configurar Provedor (IMAP/SMTP)
        </button>
      </div>

      {showConfig && <EmailConfigForm companyId={companyId} onClose={() => setShowConfig(false)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Seletor de Cliente */}
        <div className="card-flat rounded-card p-4 space-y-3 lg:col-span-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Selecione o Cliente</h3>
          {customers.length === 0 ? (
            <p className="text-sm text-ink-soft py-4 text-center">Nenhum cliente disponível.</p>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomerId(c.id); setReplyingEmail(null); }}
                  className={`w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between ${
                    selectedCustomerId === c.id 
                      ? 'bg-brand-500 text-white font-medium shadow-sm' 
                      : 'bg-surface-card border border-line text-ink hover:bg-black/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{c.name}</p>
                    <p className={`truncate text-xs ${selectedCustomerId === c.id ? 'text-white/80' : 'text-ink-soft'}`}>
                      {c.email || 'Sem e-mail'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Área de E-mail do Cliente */}
        <div className="card-flat rounded-card p-5 lg:col-span-2 space-y-4">
          {selectedCustomer ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h3 className="text-base font-semibold text-ink">{selectedCustomer.name}</h3>
                  <p className="text-xs text-ink-soft">{selectedCustomer.email || 'Aviso: Cliente não possui e-mail cadastrado.'}</p>
                </div>
                {!replyingEmail && (
                  <button 
                    onClick={() => setReplyingEmail({ subject: '' })}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600"
                  >
                    <PaperPlaneRight weight="fill" />
                    Escrever E-mail
                  </button>
                )}
              </div>

              {replyingEmail ? (
                <EmailComposer 
                  companyId={companyId} 
                  customerId={selectedCustomer.id} 
                  defaultSubject={replyingEmail.subject} 
                  onSent={() => setReplyingEmail(null)} 
                  onCancel={() => setReplyingEmail(null)} 
                />
              ) : (
                <EmailViewer 
                  companyId={companyId} 
                  customerId={selectedCustomer.id} 
                  onReply={(msg) => setReplyingEmail(msg)} 
                />
              )}
            </>
          ) : (
            <div className="py-16 text-center text-sm text-ink-soft">
              Selecione um cliente ao lado para ver o histórico de e-mails.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Contratos Tab (gestão) ────────────────────────────────────────────────────


function EmailConfigForm({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setStatus('Conectando e testando credenciais...');
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/emails/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          emailAddress: fd.get('emailAddress'),
          password: fd.get('password'),
          imapHost: fd.get('imapHost'),
          imapPort: fd.get('imapPort'),
          smtpHost: fd.get('smtpHost'),
          smtpPort: fd.get('smtpPort')
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Conta conectada com sucesso!');
        setTimeout(onClose, 2000);
      } else {
        setStatus('Erro: ' + (data.error || data.details || 'Falha ao conectar'));
      }
    } catch (err) {
      setStatus('Erro de conexão com o servidor');
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Configurar E-mail (IMAP/SMTP)</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-xs text-ink-soft">Conecte sua conta de e-mail profissional para enviar e receber mensagens direto no CRM da Hexx.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>E-mail Completo</label>
          <input name="emailAddress" type="email" required placeholder="voce@suaempresa.com.br" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Senha (ou Senha de App)</label>
          <input name="password" type="password" required placeholder="••••••••" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Servidor IMAP (Entrada)</label>
          <div className="flex gap-2">
            <input name="imapHost" required placeholder="imap.mail.com" className={`mt-1 flex-1 ${field}`} />
            <input name="imapPort" defaultValue="993" className={`mt-1 w-20 ${field}`} />
          </div>
        </div>
        <div>
          <label className={lbl}>Servidor SMTP (Saída)</label>
          <div className="flex gap-2">
            <input name="smtpHost" required placeholder="smtp.mail.com" className={`mt-1 flex-1 ${field}`} />
            <input name="smtpPort" defaultValue="465" className={`mt-1 w-20 ${field}`} />
          </div>
        </div>
      </div>
      {status && <p className={`text-xs ${status.includes('Erro') ? 'text-critical' : 'text-ok'}`}>{status}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          Salvar e Conectar
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      </div>
    </form>
  );
}

function ContratoForm({ customers, onClose, onAdded }: { customers: Customer[]; onClose: () => void; onAdded: (c: Contrato) => void }) {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const inicio = String(fd.get('inicio') ?? '');
    const fim = String(fd.get('fim') ?? '');
    const novo: Contrato = {
      id: crypto.randomUUID(),
      clienteId: String(fd.get('clienteId') ?? '') || null,
      clienteNome: String(fd.get('clienteNome') ?? '').trim(),
      tipo: String(fd.get('tipo') ?? 'Prestação de Serviços'),
      inicio,
      fim,
      valor: Number(fd.get('valor')) || null,
      observacoes: String(fd.get('observacoes') ?? '').trim() || null,
      status: computeStatus(inicio, fim),
    };
    onAdded(novo);
    onClose();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Novo contrato</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Cliente</label>
          {customers.length > 0 ? (
            <select name="clienteId" className={`mt-1 ${field}`}
              onChange={e => { const sel = customers.find(c => c.id === e.target.value); if (sel) { const input = e.target.form?.querySelector<HTMLInputElement>('[name=clienteNome]'); if (input) input.value = sel.name; } }}>
              <option value="">Selecionar cliente cadastrado…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="">Outro (digitar abaixo)</option>
            </select>
          ) : null}
          <input name="clienteNome" required placeholder="Nome do cliente" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Tipo de contrato</label>
          <select name="tipo" className={`mt-1 ${field}`}>
            {TIPOS_CONTRATO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Valor mensal (R$)</label>
          <input name="valor" type="number" min="0" step="0.01" placeholder="0,00" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Início da vigência</label>
          <input name="inicio" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Fim da vigência</label>
          <input name="fim" type="date" required className={`mt-1 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Observações</label>
          <textarea name="observacoes" rows={2} placeholder="Cláusulas especiais, renovação automática, etc." className={`mt-1 ${field} resize-none`} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          <Plus className="h-4 w-4" /> Cadastrar contrato
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      </div>
    </form>
  );
}

function ContratosTab({ customers, initialBusinessContracts }: { customers: Customer[]; initialBusinessContracts: Contrato[] }) {
  const [contratos, setContratos] = useState<Contrato[]>(initialBusinessContracts);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ContratoStatus | 'todos'>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === 'todos' ? contratos : contratos.filter(c => c.status === filter);
  const counts = { todos: contratos.length, ativo: 0, renovar: 0, expirado: 0, rascunho: 0 };
  contratos.forEach(c => counts[c.status]++);

  const valorTotal = contratos.filter(c => c.status === 'ativo' && c.valor).reduce((s, c) => s + (c.valor ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([['Ativos', 'ativo', 'text-ok'], ['Renovar', 'renovar', 'text-warn'], ['Expirados', 'expirado', 'text-critical'], ['Futuros', 'rascunho', 'text-ink-soft']] as const).map(([label, key, cls]) => (
          <div key={key} className="card-flat rounded-card p-4">
            <p className="text-xs text-ink-soft">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${cls}`}>{counts[key]}</p>
          </div>
        ))}
      </div>

      {valorTotal > 0 && (
        <div className="card-flat rounded-card flex items-center gap-3 px-5 py-3">
          <CurrencyDollar className="h-5 w-5 text-brand-500" />
          <div>
            <p className="text-xs text-ink-soft">Receita mensal recorrente (contratos ativos)</p>
            <p className="text-lg font-semibold">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {([['todos', 'Todos'], ['ativo', 'Ativos'], ['renovar', 'Renovar'], ['expirado', 'Expirados']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${filter === key ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
              {label} ({counts[key as keyof typeof counts]})
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Novo contrato
        </button>
      </div>

      {showForm && <ContratoForm customers={customers} onClose={() => setShowForm(false)} onAdded={c => { setContratos(prev => [c, ...prev]); }} />}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <FileText className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum contrato neste filtro.</p>
        </div>
      ) : (
        <div className="card-flat rounded-card divide-y divide-line">
          {filtered.map(c => {
            const cfg = STATUS_CONFIG[c.status];
            const StatusIcon = cfg.icon;
            const isExp = expanded === c.id;
            const daysLeft = Math.ceil((new Date(c.fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div key={c.id}>
                <button type="button" onClick={() => setExpanded(isExp ? null : c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-card border border-line dark:hover:bg-white/5">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${cfg.cls.split(' ')[0]}`}>
                    <StatusIcon className={`h-4 w-4 ${cfg.cls.split(' ')[1]}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.clienteNome}</p>
                    <p className="truncate text-xs text-ink-soft">{c.tipo} · {new Date(c.inicio).toLocaleDateString('pt-BR')} — {new Date(c.fim).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    {c.valor && <p className="text-sm font-medium">R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</p>}
                    <p className={`text-xs ${daysLeft < 0 ? 'text-critical' : daysLeft <= 30 ? 'text-warn' : 'text-ink-soft'}`}>
                      {daysLeft < 0 ? `Expirou há ${Math.abs(daysLeft)} dias` : `${daysLeft} dias restantes`}
                    </p>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${cfg.cls}`}>{cfg.label}</span>
                  {isExp ? <CaretUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <CaretDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>
                {isExp && (
                  <div className="mx-4 mb-3 rounded-xl bg-surface-card border border-line p-4 dark:bg-white/5 space-y-2">
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className={lbl}>Início</p><p className="font-medium">{new Date(c.inicio).toLocaleDateString('pt-BR')}</p></div>
                      <div><p className={lbl}>Término</p><p className="font-medium">{new Date(c.fim).toLocaleDateString('pt-BR')}</p></div>
                      {c.valor && <div><p className={lbl}>Valor mensal</p><p className="font-medium">R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>}
                    </div>
                    {c.observacoes && (
                      <div>
                        <p className={lbl}>Observações</p>
                        <p className="mt-0.5 text-sm text-ink-soft">{c.observacoes}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => setContratos(prev => prev.filter(x => x.id !== c.id))}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-critical/30 px-3 py-1.5 text-xs text-critical hover:bg-critical/10">
                        <Trash className="h-3.5 w-3.5" /> Remover
                      </button>
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

// ── Assinatura Digital Tab (DocuSeal) ─────────────────────────────────────────

const SIGNATURE_STATUS_PT: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-warn/10 text-warn' },
  SENT: { label: 'Aguardando assinatura', cls: 'bg-warn/10 text-warn' },
  SIGNED: { label: 'Assinado', cls: 'bg-ok/10 text-ok' },
  REFUSED: { label: 'Recusado', cls: 'bg-critical/10 text-critical' },
  EXPIRED: { label: 'Expirado', cls: 'bg-critical/10 text-critical' },
};

function AssinaturaTab({ initial }: { initial: SignatureRequestSummary[] }) {
  const [docs, setDocs] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [signers, setSigners] = useState<SignerInput[]>([{ name: '', email: '', role: '' }]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [missingApiKey, setMissingApiKey] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch('/api/contratos');
      if (r.ok) {
        setMissingApiKey(false);
        setDocs(await r.json());
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setFormError('Selecione um PDF.'); return; }
    const valid = signers.filter(s => s.email.trim());
    if (!valid.length) { setFormError('Adicione ao menos um signatário.'); return; }
    setSubmitting(true); setFormError(null);
    const form = new FormData();
    form.append('name', name); form.append('signers', JSON.stringify(valid)); form.append('file', file);
    try {
      const r = await fetch('/api/contratos/criar', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) {
        if (data.error?.includes('DOCUSEAL_API_KEY')) setMissingApiKey(true);
        setFormError(data.error ?? 'Erro ao criar documento.');
        return;
      }
      await refresh();
      setName(''); setSigners([{ name: '', email: '', role: '' }]); setFile(null); setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 5000);
    } catch { setFormError('Falha na conexão.'); } finally { setSubmitting(false); }
  }

  async function handleRefreshStatus(id: string) {
    setResending(id);
    try {
      await fetch(`/api/contratos/reenviar/${id}`, { method: 'POST' });
      await refresh();
    } finally { setResending(null); }
  }

  const pending = docs.filter(d => d.status === 'PENDING' || d.status === 'SENT').length;
  const concluded = docs.filter(d => d.status === 'SIGNED').length;

  return (
    <div className="space-y-5">
      <div className="card-flat rounded-card p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10">
            <Shield className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Assinatura Digital via DocuSeal</p>
            <p className="text-xs text-ink-soft mt-0.5">Envie qualquer documento PDF para assinatura eletrônica com validade jurídica. Os signatários recebem o link por e-mail.</p>
          </div>
        </div>
      </div>

      {missingApiKey && (
        <div className="card-flat flex items-center gap-3 rounded-xl bg-warn/10 p-4 text-warn">
          <WarningCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Atenção: a chave de API do DocuSeal (DOCUSEAL_API_KEY) ainda não está configurada no servidor. Contrate o plano Pro do DocuSeal e configure a chave para habilitar o envio de assinaturas.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Enviados', val: docs.length, cls: '' }, { label: 'Aguardando', val: pending, cls: 'text-warn' }, { label: 'Concluídos', val: concluded, cls: 'text-ok' }].map(c => (
          <div key={c.label} className="card-flat rounded-card p-4">
            <p className="text-xs text-ink-soft">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${c.cls}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card-flat rounded-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Enviar documento para assinatura</h2>
        <div>
          <label className={lbl}>Nome do documento</label>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex.: Contrato de Prestação de Serviços — João Silva" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Arquivo PDF (máx. 5MB)</label>
          <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line px-4 py-4 transition-colors hover:border-brand-400 hover:bg-brand-500/5">
            <UploadSimple className="h-5 w-5 shrink-0 text-brand-500" />
            <span className="text-sm text-ink-soft">{file ? <span className="font-medium text-ink">{file.name} ({(file.size/1024).toFixed(0)} KB)</span> : 'Clique para selecionar o PDF'}</span>
            <input type="file" accept="application/pdf" className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div>
          <label className={lbl}>Signatários</label>
          <div className="mt-1 space-y-2">
            {signers.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" placeholder="Nome" value={s.name} onChange={e => setSigners(sg => sg.map((x,idx) => idx===i ? {...x,name:e.target.value} : x))} className={`flex-1 ${field}`} />
                <input type="email" placeholder={`email${i+1}@empresa.com`} value={s.email} onChange={e => setSigners(sg => sg.map((x,idx) => idx===i ? {...x,email:e.target.value} : x))} className={`flex-1 ${field}`} />
                {signers.length > 1 && <button type="button" onClick={() => setSigners(sg => sg.filter((_,idx) => idx!==i))} className="text-ink-soft hover:text-critical"><Trash className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSigners(sg => [...sg, {name:'',email:'',role:''}])} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600">
            <UserPlus className="h-3.5 w-3.5" /> Adicionar signatário
          </button>
        </div>
        {formError && <p className="flex items-center gap-2 rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical"><WarningCircle className="h-4 w-4 shrink-0" />{formError}</p>}
        {formSuccess && <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok"><CheckCircle className="h-4 w-4 shrink-0" />Documento enviado! Os signatários receberão o link por e-mail.</p>}
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {submitting ? <Spinner className="h-4 w-4 animate-spin" /> : <PaperPlaneRight className="h-4 w-4" />}
          {submitting ? 'Enviando…' : 'Enviar para assinatura'}
        </button>
      </form>

      {/* Lista de documentos */}
      <div className="card-flat rounded-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Documentos enviados</h2>
          <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40">
            <ArrowsClockwise className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
        {docs.length === 0 ? (
          <p className="mt-4 py-6 text-center text-sm text-ink-soft">Nenhum documento enviado ainda.</p>
        ) : (
          <div className="mt-3 divide-y divide-line">
            {docs.map(doc => {
              const statusInfo = SIGNATURE_STATUS_PT[doc.status] ?? { label: doc.status, cls: 'bg-ink/5 text-ink-soft' };
              return (
                <div key={doc.id} className="flex items-center gap-3 rounded-xl px-2 py-3">
                  <Signature className="h-4 w-4 shrink-0 text-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title ?? 'Documento sem título'}</p>
                    <p className="text-xs text-ink-soft">{doc.signerName ?? doc.signerEmail} · {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                  <button type="button" disabled={resending===doc.id} onClick={() => handleRefreshStatus(doc.id)} className="text-ink-soft hover:text-ink disabled:opacity-50" title="Atualizar status">
                    {resending===doc.id ? <Spinner className="h-4 w-4 animate-spin"/> : <ArrowsClockwise className="h-4 w-4"/>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CNPJ Tab ──────────────────────────────────────────────────────────────────

type CnpjResult = {
  taxId: string; company: { name: string; equity: number };
  alias: string | null; founded: string | null; head: boolean;
  status: { id: number; text: string };
  address: { street: string; number: string; details: string | null; district: string; city: string; state: string; zip: string };
  phones: { area: string; number: string }[];
  emails: { address: string }[];
  mainActivity: { id: string; text: string } | null;
  simples?: { optant: boolean; since: string | null };
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-1.5 rounded p-0.5 text-ink-soft hover:text-ink">
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CnpjRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="min-w-[140px] text-xs text-ink-soft">{label}</span>
      <span className="flex items-center text-right text-sm font-medium">{value}<CopyBtn text={value} /></span>
    </div>
  );
}

function CnpjTab() {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CnpjResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function formatCnpj(v: string) {
    const d = v.replace(/\D/g,'').slice(0,14);
    return d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2');
  }

  async function handleSearch() {
    const digits = cnpj.replace(/\D/g,'');
    if (digits.length !== 14) { setError('Informe um CNPJ com 14 dígitos.'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`/api/cnpj/${digits}?full=true`);
      if (!res.ok) { setError('CNPJ não encontrado na Receita Federal.'); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch { setError('Falha na consulta. Tente novamente.'); } finally { setLoading(false); }
  }

  const addr = result ? [result.address.street, result.address.number, result.address.details, result.address.district, result.address.city, result.address.state].filter(Boolean).join(', ') : null;

  return (
    <div className="space-y-5">
      <div className="card-flat rounded-card p-5">
        <label className={lbl}>CNPJ</label>
        <div className="mt-1.5 flex gap-2">
          <input value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0001-00" maxLength={18} onKeyDown={e => e.key==='Enter' && handleSearch()}
            className="flex-1 rounded-xl border border-line bg-surface-card px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
          <button type="button" onClick={handleSearch} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {loading ? <Spinner className="h-4 w-4 animate-spin" /> : <MagnifyingGlass className="h-4 w-4" />}
            {loading ? 'Consultando…' : 'Consultar'}
          </button>
        </div>
        {error && <p className="mt-2 flex items-center gap-1.5 text-sm text-critical"><WarningCircle className="h-4 w-4" />{error}</p>}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="card-flat rounded-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Buildings className="h-5 w-5 text-brand-500" />
                  <h2 className="text-xl font-semibold">{result.company?.name}</h2>
                </div>
                {result.alias && <p className="mt-0.5 text-sm text-ink-soft">{result.alias}</p>}
                <p className="mt-1 font-mono text-sm text-ink-soft">{formatCnpj(result.taxId)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${result.status?.text==='ATIVA'?'bg-ok/10 text-ok':'bg-critical/10 text-critical'}`}>
                  {result.status?.text==='ATIVA'?<CheckCircle className="h-3 w-3"/>:<WarningCircle className="h-3 w-3"/>}{result.status?.text ?? '—'}
                </span>
                {result.simples?.optant && <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok"><CheckCircle className="h-3 w-3"/>Simples Nacional</span>}
                {result.head && <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok"><CheckCircle className="h-3 w-3"/>Matriz</span>}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="card-flat rounded-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Buildings className="h-4 w-4 text-brand-500"/>Identificação</h3>
              <CnpjRow label="Razão Social" value={result.company?.name} />
              <CnpjRow label="Nome Fantasia" value={result.alias} />
              <CnpjRow label="CNPJ" value={formatCnpj(result.taxId)} />
              <CnpjRow label="Abertura" value={result.founded ?? null} />
              <CnpjRow label="Capital Social" value={result.company?.equity != null ? `R$ ${result.company.equity.toLocaleString('pt-BR',{minimumFractionDigits:2})}` : null} />
              {result.simples && <CnpjRow label="Simples Nacional" value={result.simples.optant ? `Optante desde ${result.simples.since ?? '?'}` : 'Não optante'} />}
            </section>
            <section className="card-flat rounded-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><EnvelopeSimple className="h-4 w-4 text-brand-500"/>Contato</h3>
              {result.emails?.map((em,i) => <CnpjRow key={i} label="E-mail" value={em.address} />)}
              {result.phones?.map((ph,i) => <CnpjRow key={i} label="Telefone" value={`(${ph.area}) ${ph.number}`} />)}
              {result.mainActivity && (
                <>
                  <h3 className="mb-3 mt-4 flex items-center gap-2 text-sm font-semibold"><Buildings className="h-4 w-4 text-brand-500"/>Atividade</h3>
                  <CnpjRow label="CNAE Principal" value={`${result.mainActivity.id} — ${result.mainActivity.text}`} />
                </>
              )}
            </section>
            <section className="card-flat rounded-card p-5 md:col-span-2">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-brand-500"/>Endereço</h3>
              <CnpjRow label="Logradouro" value={addr} />
              <CnpjRow label="CEP" value={result.address?.zip ? String(result.address.zip).replace(/(\d{5})(\d{3})/,'$1-$2') : null} />
              <CnpjRow label="Cidade / UF" value={result.address ? `${result.address.city} / ${result.address.state}` : null} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarefas Tab ───────────────────────────────────────────────────────────────

function TarefaForm({ customers, onClose, onAdded }: { customers: Customer[]; onClose: () => void; onAdded: (t: Tarefa) => void }) {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const clienteNome = String(fd.get('clienteNome') ?? '').trim() || null;
    const novo: Tarefa = {
      id: crypto.randomUUID(),
      titulo: String(fd.get('titulo') ?? '').trim(),
      descricao: String(fd.get('descricao') ?? '').trim() || null,
      clienteNome,
      status: 'pendente',
      prioridade: (fd.get('prioridade') as TarefaPrioridade) ?? 'normal',
      prazo: String(fd.get('prazo') ?? '') || null,
      criadaEm: new Date().toISOString().slice(0, 10),
    };
    onAdded(novo);
    onClose();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Nova tarefa</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Título</label>
          <input name="titulo" required placeholder="Ex.: Enviar proposta de renovação" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Cliente (opcional)</label>
          {customers.length > 0 ? (
            <select name="clienteNome" className={`mt-1 ${field}`}>
              <option value="">Nenhum</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <input name="clienteNome" placeholder="Nome do cliente" className={`mt-1 ${field}`} />
          )}
        </div>
        <div>
          <label className={lbl}>Prioridade</label>
          <select name="prioridade" defaultValue="normal" className={`mt-1 ${field}`}>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Prazo (opcional)</label>
          <input name="prazo" type="date" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Descrição (opcional)</label>
          <textarea name="descricao" rows={2} placeholder="Detalhes da tarefa…" className={`mt-1 ${field} resize-none`} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          <Plus className="h-4 w-4" /> Criar tarefa
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      </div>
    </form>
  );
}

function TarefasTab({ customers, tarefas, onUpdate }: { customers: Customer[]; tarefas: Tarefa[]; onUpdate: (fn: (prev: Tarefa[]) => Tarefa[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<TarefaStatus | 'todas'>('todas');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === 'todas' ? tarefas : tarefas.filter(t => t.status === filter);
  const counts = { todas: tarefas.length, pendente: 0, em_andamento: 0, concluida: 0 } as Record<string, number>;
  tarefas.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1; });

  function changeStatus(id: string, status: TarefaStatus) {
    onUpdate(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }
  function remove(id: string) {
    onUpdate(prev => prev.filter(t => t.id !== id));
    setExpanded(null);
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {([['Pendentes', 'pendente', 'text-ink'], ['Em andamento', 'em_andamento', 'text-brand-600 dark:text-brand-400'], ['Concluídas', 'concluida', 'text-ok']] as const).map(([label, key, cls]) => (
          <div key={key} className="card-flat rounded-card p-4">
            <p className="text-xs text-ink-soft">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${cls}`}>{counts[key]}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {([['todas', 'Todas'], ['pendente', 'Pendentes'], ['em_andamento', 'Em andamento'], ['concluida', 'Concluídas']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${filter === key ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      {showForm && <TarefaForm customers={customers} onClose={() => setShowForm(false)} onAdded={t => { onUpdate(prev => [t, ...prev]); }} />}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <ClipboardText className="h-10 w-10 opacity-20" />
          <p className="text-sm">{filter === 'todas' ? 'Nenhuma tarefa cadastrada ainda.' : 'Nenhuma tarefa neste filtro.'}</p>
          {filter === 'todas' && <button type="button" onClick={() => setShowForm(true)} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Criar primeira tarefa</button>}
        </div>
      ) : (
        <div className="card-flat rounded-card divide-y divide-line">
          {filtered.map(t => {
            const cfg = TAREFA_STATUS_CONFIG[t.status];
            const StatusIcon = cfg.icon;
            const pri = PRIORIDADE_CONFIG[t.prioridade];
            const pz = prazoInfo(t.prazo);
            const isExp = expanded === t.id;
            return (
              <div key={t.id}>
                <button type="button" onClick={() => setExpanded(isExp ? null : t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-card border border-line dark:hover:bg-white/5">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${cfg.cls.split(' ')[0]}`}>
                    <StatusIcon className={`h-4 w-4 ${cfg.cls.split(' ')[1]}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${t.status === 'concluida' ? 'line-through text-ink-soft' : ''}`}>{t.titulo}</p>
                    <p className="truncate text-xs text-ink-soft">{t.clienteNome ?? 'Sem cliente'}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pri.cls}`}>{pri.label}</span>
                    <span className={`text-xs ${pz.cls}`}>{pz.text}</span>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${cfg.cls}`}>{cfg.label}</span>
                  {isExp ? <CaretUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <CaretDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>
                {isExp && (
                  <div className="mx-4 mb-3 rounded-xl bg-surface-card border border-line p-4 dark:bg-white/5 space-y-3">
                    {t.descricao && <p className="text-sm text-ink-soft">{t.descricao}</p>}
                    <div className="flex flex-wrap gap-1.5 sm:hidden">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pri.cls}`}>{pri.label}</span>
                      <span className={`text-xs ${pz.cls}`}>{pz.text}</span>
                    </div>
                    <div>
                      <p className={`${lbl} mb-1.5`}>Alterar status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['pendente', 'em_andamento', 'concluida'] as TarefaStatus[]).map(s => {
                          const c = TAREFA_STATUS_CONFIG[s];
                          return (
                            <button key={s} type="button" onClick={() => changeStatus(t.id, s)}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${t.status === s ? `${c.cls} ring-1 ring-current/30` : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
                              <c.icon className="h-3.5 w-3.5" />{c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button type="button" onClick={() => remove(t.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-critical/30 px-3 py-1.5 text-xs text-critical hover:bg-critical/10">
                      <Trash className="h-3.5 w-3.5" /> Remover
                    </button>
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

type TabKey = 'geral' | 'clientes' | 'tarefas' | 'assinatura' | 'cnpj';

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'geral',      label: 'Visão Geral',      icon: SquaresFour },
  { key: 'clientes',   label: 'Clientes',          icon: Users },
  { key: 'tarefas',    label: 'Tarefas & Funil',   icon: ClipboardText },
  { key: 'assinatura', label: 'Assinatura Digital', icon: PencilSimpleLine },
  { key: 'cnpj',       label: 'Consulta CNPJ',     icon: Scan },
];

export function HubRelacionamento({ companyId, initialCustomers, initialContracts, initialBusinessContracts }: { companyId: string; initialCustomers: Customer[]; initialContracts: SignatureRequestSummary[]; initialBusinessContracts: Contrato[] }) {
  const [tab, setTab] = useState<TabKey>('geral');
  const [contratos] = useState<Contrato[]>(initialBusinessContracts);
  const [tarefas, setTarefas] = useState<Tarefa[]>(seedTarefas);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-card border border-line p-1 dark:bg-white/3">
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

      {tab === 'geral'      && <VisaoGeral customers={initialCustomers} contracts={initialContracts} contratos={contratos} tarefas={tarefas} onTab={setTab} />}
      {tab === 'clientes'   && <ClientesTab initial={initialCustomers} />}
      {tab === 'tarefas'    && <TarefasTab customers={initialCustomers} tarefas={tarefas} onUpdate={setTarefas} />}
      {tab === 'assinatura' && <AssinaturaTab initial={initialContracts} />}
      {tab === 'cnpj'       && <CnpjTab />}
    </div>
  );
}
