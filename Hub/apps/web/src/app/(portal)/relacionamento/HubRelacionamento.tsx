'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SegmentedTabs, alertaDaAba } from '@/components/ui/SegmentedTabs';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import {
  Users,
  FileSignature,
  Scan,
  LayoutGrid,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  ExternalLink,
  RotateCw,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Upload,
  Send,
  Copy,
  Check,
  FilePenLine,
  Calendar,
  DollarSign,
  FileText,
  Shield,
  ClipboardList,
  Target,
  Sparkles,
} from 'lucide-react';
import { CustomerForm } from '../meu-negocio/clientes/CustomerForm';
import { Card } from '@/components/ui/Card';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';
import { formatDocument, normalizeDocument } from '@hexxa/core/document-br';
import {
  createRelContractAction,
  deleteRelContractAction,
  createTarefaAction,
  updateTarefaStatusAction,
  deleteTarefaAction,
  type TarefaRow,
  type TarefaStatus,
  type TarefaPrioridade,
} from './actions';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Customer = {
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
  fim: string | null;
  valor: number | null;
  observacoes: string | null;
  status: ContratoStatus;
};

type Tarefa = TarefaRow;

// ── Shared helpers ─────────────────────────────────────────────────────────────

const field =
  'block w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none transition-all focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime';
const lbl = 'text-caption font-bold text-ink-soft tracking-wide uppercase';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-hexxa-forest', 'bg-[#2F4A3C]', 'bg-[#4B6354]', 'bg-[#3D5A80]',
  'bg-[#5C6B73]', 'bg-[#6D597A]', 'bg-[#B56576]', 'bg-[#E56B6F]',
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function fmtFim(fim: string | null) {
  return fim ? new Date(fim).toLocaleDateString('pt-BR') : 'sem data definida';
}

const STATUS_CONFIG: Record<ContratoStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  ativo:    { label: 'Ativo',          cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
  renovar:  { label: 'Renovar em breve', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',    icon: AlertTriangle },
  expirado: { label: 'Expirado',       cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20', icon: XCircle },
  rascunho: { label: 'Futuro',         cls: 'bg-surface-card text-ink-soft border border-black/5 dark:border-white/5',   icon: Clock },
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
  pendente:     { label: 'Pendente',     cls: 'bg-surface-card text-ink-soft border border-black/5 dark:border-white/5',          icon: Clock },
  em_andamento: { label: 'Em andamento', cls: 'bg-hexxa-forest text-hexxa-lime border border-hexxa-lime/20',     icon: Target },
  concluida:    { label: 'Concluída',    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
};

const PRIORIDADE_CONFIG: Record<TarefaPrioridade, { label: string; cls: string }> = {
  baixa:   { label: 'Baixa',   cls: 'bg-surface-card text-ink-soft border border-black/5 dark:border-white/5' },
  normal:  { label: 'Normal',  cls: 'bg-hexxa-forest/15 text-hexxa-forest dark:text-hexxa-lime' },
  alta:    { label: 'Alta',    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  urgente: { label: 'Urgente', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

function prazoInfo(prazo: string | null): { text: string; cls: string } {
  if (!prazo) return { text: 'Sem prazo', cls: 'text-ink-soft' };
  const days = Math.ceil((new Date(prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `Atrasado ${Math.abs(days)}d`, cls: 'text-red-600 font-bold' };
  if (days === 0) return { text: 'Hoje', cls: 'text-amber-600 font-bold' };
  if (days === 1) return { text: 'Amanhã', cls: 'text-amber-600 font-bold' };
  return { text: new Date(prazo).toLocaleDateString('pt-BR'), cls: 'text-ink-soft' };
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
      <GradeDeResumo>
        <CardResumo
          destaque
          rotulo="Clientes"
          valor={customers.length}
          nota={`${customers.filter((c) => c.type === 'PJ').length} PJ · ${customers.filter((c) => c.type === 'PF').length} PF`}
          onClick={() => onTab('clientes')}
        />
        <CardResumo
          rotulo="Contratos ativos"
          valor={ativos}
          nota={`${expirados} expirado${expirados !== 1 ? 's' : ''}`}
          href="/meu-negocio/contratos"
        />
        <CardResumo
          rotulo="Renovar em breve"
          valor={renovar}
          tom={renovar > 0 ? 'alerta' : 'padrao'}
          nota="Nos próximos 30 dias"
          href="/meu-negocio/contratos"
        />
        <CardResumo
          rotulo="Aguardando assinatura"
          valor={pendingAssin}
          tom={pendingAssin > 0 ? 'alerta' : 'padrao'}
          nota={`${contracts.length} documento${contracts.length !== 1 ? 's' : ''} no total`}
          onClick={() => onTab('assinatura')}
        />
      </GradeDeResumo>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clientes recentes */}
        <Card level={1} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-base text-ink">Clientes Recentes</h2>
            <button type="button" onClick={() => onTab('clientes')} className="text-xs font-bold text-hexxa-forest hover:underline dark:text-hexxa-lime">Ver todos →</button>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {recent.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-card border border-black/5 dark:border-white/5 shadow-(--elev-1) p-3.5 hover:bg-surface-card-hover transition-colors">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-hexxa-lime ${avatarColor(c.name)}`}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                    <p className="truncate text-xs text-ink-soft">{c.document ?? c.email ?? '—'}</p>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.type === 'PF' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-hexxa-forest/10 text-hexxa-forest dark:text-hexxa-lime border border-hexxa-forest/20'}`}>
                    {c.type ?? 'PJ'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => onTab('clientes')}
            className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
          >
            <Plus className="h-4 w-4" /> Novo Cliente
          </button>
        </Card>

        {/* Contratos com vencimento próximo */}
        <Card level={1} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-base text-ink">Contratos — Visão Rápida</h2>
            <Link href="/meu-negocio/contratos" className="text-xs font-bold text-hexxa-forest hover:underline dark:text-hexxa-lime">Gerenciar →</Link>
          </div>
          {contratos.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Nenhum contrato registrado.</p>
          ) : (
            <div className="space-y-2">
              {contratos.slice(0, 5).map(c => {
                const cfg = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-card border border-black/5 dark:border-white/5 shadow-(--elev-1) p-3.5 hover:bg-surface-card-hover transition-colors">
                    <FileText className="h-4 w-4 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{c.clienteNome}</p>
                      <p className="truncate text-xs text-ink-soft">{c.tipo} · até {fmtFim(c.fim)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link
            href="/meu-negocio/contratos"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-5 py-2.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-colors"
          >
            <Plus className="h-4 w-4" /> Novo Contrato
          </Link>
        </Card>
      </div>

      {/* Tarefas em aberto */}
      <Card level={1} className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-bold text-base text-ink">Tarefas em Aberto</h2>
          <button type="button" onClick={() => onTab('tarefas')} className="text-xs font-bold text-hexxa-forest hover:underline dark:text-hexxa-lime">Ver todas →</button>
        </div>
        {tarefas.filter(t => t.status !== 'concluida').length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">Nenhuma tarefa pendente no momento.</p>
        ) : (
          <div className="space-y-2">
            {tarefas.filter(t => t.status !== 'concluida').slice(0, 4).map(t => {
              const pri = PRIORIDADE_CONFIG[t.prioridade];
              const pz = prazoInfo(t.prazo);
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-surface-card border border-black/5 dark:border-white/5 shadow-(--elev-1) p-3.5 hover:bg-surface-card-hover transition-colors">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pri.cls}`}>{pri.label}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{t.titulo}</p>
                  {t.clienteNome && <p className="hidden truncate text-xs text-ink-soft sm:block">{t.clienteNome}</p>}
                  <span className={`shrink-0 text-xs font-medium ${pz.cls}`}>{pz.text}</span>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => onTab('tarefas')}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-5 py-2.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-colors"
        >
          <Plus className="h-4 w-4" /> Nova Tarefa
        </button>
      </Card>

      {/* Quick action — CNPJ */}
      <Card level={1} className="flex flex-wrap items-center gap-4 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)">
            <Scan className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-ink">Consulta de CNPJ na Receita Federal</h3>
            <p className="text-xs sm:text-sm text-ink-soft">Valide a situação cadastral, optante pelo Simples e CNAE de qualquer cliente ou fornecedor.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onTab('cnpj')}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
        >
          <Scan className="h-4 w-4" /> Consultar CNPJ Agora
        </button>
      </Card>
    </div>
  );
}

// ── Clientes Tab ──────────────────────────────────────────────────────────────

function ClientesTab({ initial }: { initial: Customer[] }) {
  const router = useRouter();
  const [clientes, setClientes] = useState(initial);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'PJ' | 'PF'>('todos');

  // A lista vem do server component (initial); quando o form (que já
  // revalida /relacionamento) salva um cliente, router.refresh() busca de
  // novo e esse effect sincroniza o estado local com o prop atualizado.
  useEffect(() => {
    setClientes(initial);
  }, [initial]);

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.document ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q);
    return matchSearch && (filter === 'todos' || c.type === filter);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, documento, e-mail…"
            className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) py-2.5 pl-10 pr-4 text-xs sm:text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all"
          />
        </div>
        <FiltrosEmTexto
          filtros={[
            { id: 'todos', label: 'Todos', count: clientes.length },
            { id: 'PJ', label: 'PJ', count: clientes.filter(c => c.type === 'PJ').length },
            { id: 'PF', label: 'PF', count: clientes.filter(c => c.type === 'PF').length },
          ]}
          ativo={filter}
          onChange={setFilter}
        />
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
        >
          <Plus className="h-4 w-4" /> Novo Cliente
        </button>
      </div>

      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm">{search ? 'Nenhum cliente encontrado com este filtro.' : 'Nenhum cliente cadastrado ainda.'}</p>
          {!search && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-5 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1)"
            >
              <Plus className="h-4 w-4" /> Adicionar Primeiro Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => (
            <Card key={c.id} level={1} interactive className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold text-hexxa-lime ${avatarColor(c.name)}`}>
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                    <span className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.type === 'PF' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-hexxa-forest/10 text-hexxa-forest dark:text-hexxa-lime border border-hexxa-forest/20'}`}>
                      {c.type ?? 'PJ'}
                    </span>
                  </div>
                  {c.document && <p className="mt-0.5 font-mono text-xs text-ink-soft">{c.document}</p>}
                </div>
              </div>
              <div className="space-y-1 pt-2 border-t border-black/5 dark:border-white/10 text-xs">
                {c.email && <p className="flex items-center gap-1.5 truncate text-ink-soft"><Mail className="h-3.5 w-3.5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />{c.email}</p>}
                {c.phone && <p className="flex items-center gap-1.5 text-ink-soft"><Phone className="h-3.5 w-3.5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />{c.phone}</p>}
                {c.address && <p className="flex items-center gap-1.5 truncate text-ink-soft"><MapPin className="h-3.5 w-3.5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />{c.address}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assinatura Digital Tab (DocuSeal) ─────────────────────────────────────────

const SIGNATURE_STATUS_PT: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
  SENT: { label: 'Aguardando assinatura', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' },
  SIGNED: { label: 'Assinado', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
  REFUSED: { label: 'Recusado', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' },
  EXPIRED: { label: 'Expirado', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' },
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
    <div className="space-y-6">
      <Card level={1} className="p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-ink">Assinatura Eletrônica &amp; Digital</h3>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Envie contratos e documentos para coleta de assinaturas digitais com validade jurídica e trilha de auditoria completa.
            </p>
          </div>
        </div>
      </Card>

      {missingApiKey && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>A chave de API de assinatura (DOCUSEAL_API_KEY) não está configurada no servidor. Configure a chave para habilitar o envio.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Enviados', val: docs.length, cls: 'text-ink' },
          { label: 'Aguardando', val: pending, cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Concluídos', val: concluded, cls: 'text-emerald-600 dark:text-emerald-400' },
        ].map(c => (
          <Card key={c.label} level={1} className="p-5">
            <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">{c.label}</p>
            <p className={`mt-2 font-serif tabular font-bold text-2xl sm:text-3xl ${c.cls}`}>{c.val}</p>
          </Card>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-3xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) p-6 sm:p-8 space-y-4">
        <h2 className="font-serif font-bold text-base text-ink">Novo Documento para Assinatura</h2>
        <div>
          <label className={lbl}>Nome do Documento</label>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex.: Contrato de Prestação de Serviços — Cliente X" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Arquivo PDF (máximo 5MB)</label>
          <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 bg-surface-card shadow-(--elev-inset) px-4 py-4 transition-all hover:border-hexxa-forest">
            <Upload className="h-5 w-5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />
            <span className="text-xs sm:text-sm text-ink-soft">{file ? <span className="font-bold text-ink">{file.name} ({(file.size/1024).toFixed(0)} KB)</span> : 'Clique para selecionar o arquivo PDF'}</span>
            <input type="file" accept="application/pdf" className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div>
          <label className={lbl}>Signatários</label>
          <div className="mt-1.5 space-y-2">
            {signers.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" placeholder="Nome" value={s.name} onChange={e => setSigners(sg => sg.map((x,idx) => idx===i ? {...x,name:e.target.value} : x))} className={`flex-1 ${field}`} />
                <input type="email" placeholder={`email${i+1}@empresa.com`} value={s.email} onChange={e => setSigners(sg => sg.map((x,idx) => idx===i ? {...x,email:e.target.value} : x))} className={`flex-1 ${field}`} />
                {signers.length > 1 && (
                  <button type="button" onClick={() => setSigners(sg => sg.filter((_,idx) => idx!==i))} className="rounded-full p-2 text-ink-soft hover:bg-red-500/10 hover:text-red-600 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSigners(sg => [...sg, {name:'',email:'',role:''}])} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-hexxa-forest hover:underline dark:text-hexxa-lime">
            <UserPlus className="h-3.5 w-3.5" /> Adicionar Outro Signatário
          </button>
        </div>
        {formError && <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-700 dark:text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{formError}</p>}
        {formSuccess && <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4 shrink-0" />Documento enviado com sucesso para assinatura.</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Enviando…' : 'Enviar para Assinatura'}
        </button>
      </form>

      {/* Lista de documentos */}
      <Card level={1} className="p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="font-serif font-bold text-base text-ink">Documentos Enviados</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-colors disabled:opacity-40"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
        {docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">Nenhum documento enviado ainda.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {docs.map(doc => {
              const statusInfo = SIGNATURE_STATUS_PT[doc.status] ?? { label: doc.status, cls: 'bg-surface-card text-ink-soft' };
              return (
                <div key={doc.id} className="flex items-center gap-3 py-3.5 hover:bg-surface-card-hover transition-colors">
                  <FileSignature className="h-5 w-5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{doc.title ?? 'Documento sem título'}</p>
                    <p className="text-xs text-ink-soft">{doc.signerName ?? doc.signerEmail} · {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${statusInfo.cls}`}>{statusInfo.label}</span>
                  <button
                    type="button"
                    disabled={resending===doc.id}
                    onClick={() => handleRefreshStatus(doc.id)}
                    className="rounded-full p-2 text-ink-soft hover:bg-surface-card-hover disabled:opacity-50 transition-colors"
                    title="Atualizar status"
                  >
                    {resending===doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <RotateCw className="h-4 w-4"/>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── CNPJ Tab ──────────────────────────────────────────────────────────────────

type CnpjResult = {
  taxId: string;
  company: { name: string; equity: number };
  alias: string | null;
  founded: string | null;
  head: boolean;
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
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 rounded-full p-1 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10"
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CnpjRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 dark:border-white/10 py-3 last:border-0">
      <span className="min-w-[140px] text-caption font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      <span className="flex items-center text-right text-xs sm:text-sm font-bold text-ink">{value}<CopyBtn text={value} /></span>
    </div>
  );
}

function CnpjTab() {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CnpjResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const doc = normalizeDocument(cnpj);
    if (doc.length !== 14) { setError('Informe um CNPJ com 14 caracteres.'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`/api/cnpj/${doc}?full=true`);
      if (!res.ok) { setError('CNPJ não encontrado na Receita Federal.'); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch { setError('Falha na consulta. Tente novamente.'); } finally { setLoading(false); }
  }

  const addr = result ? [result.address.street, result.address.number, result.address.details, result.address.district, result.address.city, result.address.state].filter(Boolean).join(', ') : null;

  return (
    <div className="space-y-6">
      <Card level={1} className="p-6 sm:p-8">
        <label className={lbl}>Número do CNPJ</label>
        <div className="mt-2 flex flex-col sm:flex-row gap-3">
          <input
            value={cnpj}
            onChange={e => setCnpj(formatDocument(e.target.value))}
            placeholder="00.000.000/0001-00"
            maxLength={18}
            onKeyDown={e => e.key==='Enter' && handleSearch()}
            className="flex-1 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Consultando…' : 'Consultar CNPJ'}
          </button>
        </div>
        {error && <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" />{error}</p>}
      </Card>

      {result && (
        <div className="space-y-6 animate-in fade-in">
          <Card level={1} className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-6 w-6 text-hexxa-forest dark:text-hexxa-lime" />
                  <h2 className="font-serif font-bold text-xl sm:text-2xl text-ink">{result.company?.name}</h2>
                </div>
                {result.alias && <p className="mt-1 text-sm font-medium text-ink-soft">{result.alias}</p>}
                <p className="mt-1 font-mono text-xs font-bold text-hexxa-forest dark:text-hexxa-lime">{formatDocument(result.taxId)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${result.status?.text==='ATIVA'?'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20':'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                  {result.status?.text==='ATIVA'?<CheckCircle2 className="h-3.5 w-3.5"/>:<AlertTriangle className="h-3.5 w-3.5"/>}{result.status?.text ?? '—'}
                </span>
                {result.simples?.optant && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-hexxa-forest/10 text-hexxa-forest dark:text-hexxa-lime border border-hexxa-forest/20 px-3 py-1 text-xs font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5"/>Simples Nacional
                  </span>
                )}
                {result.head && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-card border border-black/5 dark:border-white/5 shadow-(--elev-1) px-3 py-1 text-xs font-bold text-ink-soft">
                    Matriz
                  </span>
                )}
              </div>
            </div>
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card level={1} className="p-6">
              <h3 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-ink"><Building2 className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime"/>Identificação</h3>
              <CnpjRow label="Razão Social" value={result.company?.name} />
              <CnpjRow label="Nome Fantasia" value={result.alias} />
              <CnpjRow label="CNPJ" value={formatDocument(result.taxId)} />
              <CnpjRow label="Data de Abertura" value={result.founded ?? null} />
              <CnpjRow label="Capital Social" value={result.company?.equity != null ? `R$ ${result.company.equity.toLocaleString('pt-BR',{minimumFractionDigits:2})}` : null} />
              {result.simples && <CnpjRow label="Regime Tributário" value={result.simples.optant ? `Optante Simples Nacional desde ${result.simples.since ?? '?'}` : 'Não optante'} />}
            </Card>
            <Card level={1} className="p-6">
              <h3 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-ink"><Mail className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime"/>Contato &amp; Atividade</h3>
              {result.emails?.map((em,i) => <CnpjRow key={i} label="E-mail" value={em.address} />)}
              {result.phones?.map((ph,i) => <CnpjRow key={i} label="Telefone" value={`(${ph.area}) ${ph.number}`} />)}
              {result.mainActivity && (
                <CnpjRow label="CNAE Principal" value={`${result.mainActivity.id} — ${result.mainActivity.text}`} />
              )}
            </Card>
            <Card level={1} className="p-6 md:col-span-2">
              <h3 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-ink"><MapPin className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime"/>Endereço Fiscal</h3>
              <CnpjRow label="Logradouro" value={addr} />
              <CnpjRow label="CEP" value={result.address?.zip ? String(result.address.zip).replace(/(\d{5})(\d{3})/,'$1-$2') : null} />
              <CnpjRow label="Município / UF" value={result.address ? `${result.address.city} / ${result.address.state}` : null} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarefas Tab ───────────────────────────────────────────────────────────────

function TarefaForm({ customers, onClose, onAdded }: { customers: Customer[]; onClose: () => void; onAdded: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const clienteNome = String(fd.get('clienteNome') ?? '').trim() || null;
    await createTarefaAction({
      titulo: String(fd.get('titulo') ?? '').trim(),
      descricao: String(fd.get('descricao') ?? '').trim() || null,
      clienteNome,
      prioridade: (fd.get('prioridade') as TarefaPrioridade) ?? 'normal',
      prazo: String(fd.get('prazo') ?? '') || null,
    });
    setSubmitting(false);
    onAdded();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) p-6 sm:p-8 space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-ink">Nova Tarefa</p>
        <button type="button" onClick={onClose} className="tap-target pressable focusable rounded-full p-1 text-ink-soft hover:bg-black/5 transition-colors"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Título da Tarefa</label>
          <input name="titulo" required placeholder="Ex.: Enviar proposta de renovação contratual" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Cliente Vinculado (opcional)</label>
          {customers.length > 0 ? (
            <select name="clienteNome" className={`mt-1.5 ${field}`}>
              <option value="">Nenhum</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <input name="clienteNome" placeholder="Nome do cliente" className={`mt-1.5 ${field}`} />
          )}
        </div>
        <div>
          <label className={lbl}>Prioridade</label>
          <select name="prioridade" defaultValue="normal" className={`mt-1.5 ${field}`}>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Data Limite (Prazo)</label>
          <input name="prazo" type="date" className={`mt-1.5 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição / Anotações (opcional)</label>
          <textarea name="descricao" rows={2} placeholder="Detalhes ou checklist da tarefa…" className={`mt-1.5 ${field} resize-none`} />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar Tarefa
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
  );
}

function TarefasTab({ customers, tarefas, onChanged }: { customers: Customer[]; tarefas: Tarefa[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<TarefaStatus | 'todas'>('todas');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === 'todas' ? tarefas : tarefas.filter(t => t.status === filter);
  const counts = { todas: tarefas.length, pendente: 0, em_andamento: 0, concluida: 0 } as Record<string, number>;
  tarefas.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1; });

  async function changeStatus(id: string, status: TarefaStatus) {
    await updateTarefaStatusAction(id, status);
    onChanged();
  }
  async function remove(id: string) {
    await deleteTarefaAction(id);
    setExpanded(null);
    onChanged();
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        {([
          ['Pendentes', 'pendente', 'text-ink'],
          ['Em Andamento', 'em_andamento', 'text-hexxa-forest dark:text-hexxa-lime'],
          ['Concluídas', 'concluida', 'text-emerald-600 dark:text-emerald-400'],
        ] as const).map(([label, key, cls]) => (
          <Card key={key} level={1} className="p-5">
            <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">{label}</p>
            <p className={`mt-2 font-serif tabular font-bold text-2xl sm:text-3xl ${cls}`}>{counts[key]}</p>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltrosEmTexto
          filtros={[
            { id: 'todas', label: 'Todas', count: counts.todas ?? 0 },
            { id: 'pendente', label: 'Pendentes', count: counts.pendente ?? 0 },
            { id: 'em_andamento', label: 'Em andamento', count: counts.em_andamento ?? 0 },
            { id: 'concluida', label: 'Concluídas', count: counts.concluida ?? 0 },
          ]}
          ativo={filter}
          onChange={setFilter}
        />
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
        >
          <Plus className="h-4 w-4" /> Nova Tarefa
        </button>
      </div>

      {showForm && <TarefaForm customers={customers} onClose={() => setShowForm(false)} onAdded={onChanged} />}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <ClipboardList className="h-10 w-10 opacity-30" />
          <p className="text-sm">{filter === 'todas' ? 'Nenhuma tarefa cadastrada ainda.' : 'Nenhuma tarefa neste filtro.'}</p>
          {filter === 'todas' && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-5 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1)"
            >
              <Plus className="h-4 w-4" /> Criar Primeira Tarefa
            </button>
          )}
        </div>
      ) : (
        <Card level={1} className="divide-y divide-black/5 dark:divide-white/10 overflow-hidden p-0">
          {filtered.map(t => {
            const cfg = TAREFA_STATUS_CONFIG[t.status];
            const StatusIcon = cfg.icon;
            const pri = PRIORIDADE_CONFIG[t.prioridade];
            const pz = prazoInfo(t.prazo);
            const isExp = expanded === t.id;
            return (
              <div key={t.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExp ? null : t.id)}
                  className="flex w-full items-center gap-3 px-6 py-4 text-left hover:bg-surface-card-hover transition-colors"
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${cfg.cls}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold text-ink ${t.status === 'concluida' ? 'line-through opacity-60' : ''}`}>{t.titulo}</p>
                    <p className="truncate text-xs text-ink-soft">{t.clienteNome ?? 'Sem cliente vinculado'}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pri.cls}`}>{pri.label}</span>
                    <span className={`text-xs ${pz.cls}`}>{pz.text}</span>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${cfg.cls}`}>{cfg.label}</span>
                  {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>
                {isExp && (
                  <div className="mx-6 mb-4 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-5 space-y-4">
                    {t.descricao && <p className="text-xs sm:text-sm text-ink-soft">{t.descricao}</p>}
                    <div className="flex flex-wrap gap-1.5 sm:hidden">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pri.cls}`}>{pri.label}</span>
                      <span className={`text-xs ${pz.cls}`}>{pz.text}</span>
                    </div>
                    <div>
                      <p className={`${lbl} mb-2`}>Alterar Status</p>
                      <SegmentedTabs
                        size="sm"
                        tabs={(['pendente', 'em_andamento', 'concluida'] as TarefaStatus[]).map((st) => ({
                          id: st,
                          label: TAREFA_STATUS_CONFIG[st].label,
                          icon: TAREFA_STATUS_CONFIG[st].icon,
                        }))}
                        activeTab={t.status}
                        onChange={(st) => changeStatus(t.id, st)}
                        layoutId={`tarefaStatus-${t.id}`}
                      />
                    </div>
                    <div className="pt-2 border-t border-black/5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => remove(t.id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover Tarefa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabKey = 'geral' | 'clientes' | 'tarefas' | 'assinatura' | 'cnpj';

const TABS: { id: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'geral',      label: 'Visão Geral',         icon: LayoutGrid },
  { id: 'clientes',   label: 'Clientes',            icon: Users },
  { id: 'tarefas',    label: 'Tarefas & Follow-up', icon: Target },
  { id: 'assinatura', label: 'Assinaturas',         icon: FileSignature },
  { id: 'cnpj',       label: 'Consulta CNPJ',       icon: Scan },
];

export function HubRelacionamento({
  companyId,
  initialCustomers,
  initialContracts,
  initialBusinessContracts,
  initialTarefas,
}: {
  companyId?: string;
  initialCustomers: Customer[];
  initialContracts: SignatureRequestSummary[];
  initialBusinessContracts: Contrato[];
  initialTarefas: Tarefa[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('geral');
  const [contratos] = useState<Contrato[]>(initialBusinessContracts);
  const tarefas = initialTarefas;

  return (
    <div className="space-y-8">
      <div className="flex overflow-x-auto no-scrollbar py-1">
        <SegmentedTabs
          tabs={TABS.map((t) =>
            // Tarefa com prazo vencido e não concluída pede ação: número na aba.
            t.id === 'tarefas'
              ? {
                  ...t,
                  badge: alertaDaAba(
                    tarefas.filter((x) => x.status !== 'concluida' && x.prazo && x.prazo < new Date().toISOString().slice(0, 10)).length,
                  ),
                }
              : t,
          )}
          activeTab={tab}
          onChange={setTab}
          layoutId="relacionamentoTabsIndicator"
        />
      </div>

      {tab === 'geral'      && <VisaoGeral customers={initialCustomers} contracts={initialContracts} contratos={contratos} tarefas={tarefas} onTab={setTab} />}
      {tab === 'clientes'   && <ClientesTab initial={initialCustomers} />}
      {tab === 'tarefas'    && <TarefasTab customers={initialCustomers} tarefas={tarefas} onChanged={() => router.refresh()} />}
      {tab === 'assinatura' && <AssinaturaTab initial={initialContracts} />}
      {tab === 'cnpj'       && <CnpjTab />}
    </div>
  );
}

