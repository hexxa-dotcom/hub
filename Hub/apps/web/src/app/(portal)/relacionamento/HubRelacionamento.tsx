'use client';

import { useState, useRef, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
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
import EmailViewer from '@/components/crm/EmailViewer';
import EmailComposer from '@/components/crm/EmailComposer';
import { addCustomerAction, type CustomerState } from '../meu-negocio/clientes/actions';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';
import type { CnpjData } from '@/app/api/cnpj/[cnpj]/route';
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
  'block w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none transition-all focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] tracking-wide uppercase';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-[#1E3328]', 'bg-[#2F4A3C]', 'bg-[#4B6354]', 'bg-[#3D5A80]',
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
  ativo:    { label: 'Ativo',          cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
  renovar:  { label: 'Renovar em breve', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',    icon: AlertTriangle },
  expirado: { label: 'Expirado',       cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', icon: XCircle },
  rascunho: { label: 'Futuro',         cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]',   icon: Clock },
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
  pendente:     { label: 'Pendente',     cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]',          icon: Clock },
  em_andamento: { label: 'Em andamento', cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]',     icon: Target },
  concluida:    { label: 'Concluída',    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
};

const PRIORIDADE_CONFIG: Record<TarefaPrioridade, { label: string; cls: string }> = {
  baixa:   { label: 'Baixa',   cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]' },
  normal:  { label: 'Normal',  cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]' },
  alta:    { label: 'Alta',    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  urgente: { label: 'Urgente', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};

function prazoInfo(prazo: string | null): { text: string; cls: string } {
  if (!prazo) return { text: 'Sem prazo', cls: 'text-[#6E6A61] dark:text-[#A8A49C]' };
  const days = Math.ceil((new Date(prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `Atrasado ${Math.abs(days)}d`, cls: 'text-red-600 font-bold' };
  if (days === 0) return { text: 'Hoje', cls: 'text-amber-600 font-bold' };
  if (days === 1) return { text: 'Amanhã', cls: 'text-amber-600 font-bold' };
  return { text: new Date(prazo).toLocaleDateString('pt-BR'), cls: 'text-[#6E6A61] dark:text-[#A8A49C]' };
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
        <button
          type="button"
          onClick={() => onTab('clientes')}
          className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-left transition-all hover:bg-[#F4EFE4] dark:hover:bg-[#1A201C] shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Clientes</p>
            <div className="p-2 rounded-xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3]">{customers.length}</p>
          <p className="mt-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">Ver todos →</p>
        </button>

        <Link
          href="/meu-negocio/contratos"
          className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-left transition-all hover:bg-[#F4EFE4] dark:hover:bg-[#1A201C] shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Contratos Ativos</p>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-serif font-bold text-2xl sm:text-3xl text-emerald-700 dark:text-emerald-400">{ativos}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{expirados} expirado{expirados !== 1 ? 's' : ''}</p>
        </Link>

        <Link
          href="/meu-negocio/contratos"
          className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-left transition-all hover:bg-[#F4EFE4] dark:hover:bg-[#1A201C] shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Renovar em Breve</p>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className={`mt-3 font-serif font-bold text-2xl sm:text-3xl ${renovar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>{renovar}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">nos próximos 30 dias</p>
        </Link>

        <button
          type="button"
          onClick={() => onTab('assinatura')}
          className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-left transition-all hover:bg-[#F4EFE4] dark:hover:bg-[#1A201C] shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Aguardando Assinatura</p>
            <div className="p-2 rounded-xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <FilePenLine className="h-4 w-4" />
            </div>
          </div>
          <p className={`mt-3 font-serif font-bold text-2xl sm:text-3xl ${pendingAssin > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>{pendingAssin}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{contracts.length} documento{contracts.length !== 1 ? 's' : ''}</p>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clientes recentes */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Clientes Recentes</h2>
            <button type="button" onClick={() => onTab('clientes')} className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">Ver todos →</button>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {recent.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-[#DFFFAE] ${avatarColor(c.name)}`}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{c.name}</p>
                    <p className="truncate text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.document ?? c.email ?? '—'}</p>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.type === 'PF' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]'}`}>
                    {c.type ?? 'PJ'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => onTab('clientes')}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
          >
            <Plus className="h-4 w-4" /> Novo Cliente
          </button>
        </div>

        {/* Contratos com vencimento próximo */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Contratos — Visão Rápida</h2>
            <Link href="/meu-negocio/contratos" className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">Gerenciar →</Link>
          </div>
          {contratos.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhum contrato registrado.</p>
          ) : (
            <div className="space-y-2">
              {contratos.slice(0, 5).map(c => {
                const cfg = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                    <FileText className="h-4 w-4 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{c.clienteNome}</p>
                      <p className="truncate text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.tipo} · até {fmtFim(c.fim)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link
            href="/meu-negocio/contratos"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all"
          >
            <Plus className="h-4 w-4" /> Novo Contrato
          </Link>
        </div>
      </div>

      {/* Tarefas em aberto */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Tarefas em Aberto</h2>
          <button type="button" onClick={() => onTab('tarefas')} className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">Ver todas →</button>
        </div>
        {tarefas.filter(t => t.status !== 'concluida').length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhuma tarefa pendente no momento.</p>
        ) : (
          <div className="space-y-2">
            {tarefas.filter(t => t.status !== 'concluida').slice(0, 4).map(t => {
              const pri = PRIORIDADE_CONFIG[t.prioridade];
              const pz = prazoInfo(t.prazo);
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pri.cls}`}>{pri.label}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{t.titulo}</p>
                  {t.clienteNome && <p className="hidden truncate text-xs text-[#6E6A61] dark:text-[#A8A49C] sm:block">{t.clienteNome}</p>}
                  <span className={`shrink-0 text-xs font-medium ${pz.cls}`}>{pz.text}</span>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => onTab('tarefas')}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all"
        >
          <Plus className="h-4 w-4" /> Nova Tarefa
        </button>
      </div>

      {/* Quick action — CNPJ */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md flex flex-wrap items-center gap-4 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <Scan className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Consulta de CNPJ na Receita Federal</h3>
            <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">Valide a situação cadastral, optante pelo Simples e CNAE de qualquer cliente ou fornecedor.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onTab('cnpj')}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
        >
          <Scan className="h-4 w-4" /> Consultar CNPJ Agora
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
      onAdded({
        id: crypto.randomUUID(),
        name: String(fd.get('nome') ?? ''),
        document: String(fd.get('documento') ?? '') || null,
        email: String(fd.get('email') ?? '') || null,
        phone: String(fd.get('telefone') ?? '') || null,
        type: String(fd.get('tipo') ?? 'PJ'),
        address: null,
      });
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
    <form action={action} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Novo Cliente</p>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>Tipo de Pessoa</label>
          <select name="tipo" defaultValue="PJ" className={`mt-1.5 ${field}`}>
            <option value="PJ">Pessoa Jurídica (CNPJ)</option>
            <option value="PF">Pessoa Física (CPF)</option>
          </select>
        </div>
        <div>
          <label className={lbl}>CNPJ / CPF</label>
          <div className="relative mt-1.5">
            <input
              name="documento"
              required
              placeholder="00.000.000/0001-00"
              onInput={e => {
                const el = e.currentTarget;
                el.value = formatCnpj(el.value);
                if (el.value.replace(/\D/g,'').length === 14) lookupCnpj(el.value);
                else setLookupStatus('idle');
              }}
              className={`${field} pr-10`}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
              {lookupStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-[#6E6A61]" />}
              {lookupStatus === 'found' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {(lookupStatus === 'not_found' || lookupStatus === 'error') && <AlertTriangle className="h-4 w-4 text-amber-600" />}
            </span>
          </div>
          {lookupStatus === 'found' && <p className="mt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">✓ Dados preenchidos via Receita Federal</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Razão Social / Nome Completo</label>
          <input ref={nomeRef} name="nome" required placeholder="Nome completo ou razão social" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>E-mail</label>
          <input ref={emailRef} name="email" type="email" placeholder="contato@empresa.com" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Telefone / WhatsApp</label>
          <input ref={telefoneRef} name="telefone" placeholder="(11) 98765-4321" className={`mt-1.5 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Endereço</label>
          <input ref={enderecoRef} name="endereco" placeholder="Rua, número, complemento, bairro" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>CEP</label>
          <input ref={cepRef} name="cep" placeholder="00000-000" className={`mt-1.5 ${field}`} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={lbl}>Cidade</label>
            <input ref={cidadeRef} name="cidade" placeholder="São Paulo" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className={lbl}>UF</label>
            <select ref={ufRef} name="uf" className={`mt-1.5 ${field}`}>
              <option value="">—</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
      </div>
      {state.message && !state.ok && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-800 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{state.message}
        </p>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cadastrar Cliente
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E6A61] dark:text-[#A8A49C]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, documento, e-mail…"
            className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]"
          />
        </div>
        <div className="flex gap-1.5">
          {(['todos','PJ','PF'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                filter === f
                  ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
                  : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
              }`}
            >
              {f === 'todos' ? `Todos (${clientes.length})` : f === 'PJ' ? `PJ (${clientes.filter(c=>c.type==='PJ').length})` : `PF (${clientes.filter(c=>c.type==='PF').length})`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
        >
          <Plus className="h-4 w-4" /> Novo Cliente
        </button>
      </div>

      {showForm && <AddClienteForm onClose={() => setShowForm(false)} onAdded={c => setClientes(prev => [c, ...prev])} />}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm">{search ? 'Nenhum cliente encontrado com este filtro.' : 'Nenhum cliente cadastrado ainda.'}</p>
          {!search && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1E3328] px-5 py-2 text-xs font-bold text-[#DFFFAE]"
            >
              <Plus className="h-4 w-4" /> Adicionar Primeiro Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => (
            <div key={c.id} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 transition-all hover:shadow-md space-y-3">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-bold text-[#DFFFAE] ${avatarColor(c.name)}`}>
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{c.name}</p>
                    <span className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.type === 'PF' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]'}`}>
                      {c.type ?? 'PJ'}
                    </span>
                  </div>
                  {c.document && <p className="mt-0.5 font-mono text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.document}</p>}
                </div>
              </div>
              <div className="space-y-1 pt-1 border-t border-black/5 dark:border-white/10 text-xs">
                {c.email && <p className="flex items-center gap-1.5 truncate text-[#6E6A61] dark:text-[#A8A49C]"><Mail className="h-3.5 w-3.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />{c.email}</p>}
                {c.phone && <p className="flex items-center gap-1.5 text-[#6E6A61] dark:text-[#A8A49C]"><Phone className="h-3.5 w-3.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />{c.phone}</p>}
                {c.address && <p className="flex items-center gap-1.5 truncate text-[#6E6A61] dark:text-[#A8A49C]"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />{c.address}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assinatura Digital Tab (DocuSeal) ─────────────────────────────────────────

const SIGNATURE_STATUS_PT: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  SENT: { label: 'Aguardando assinatura', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  SIGNED: { label: 'Assinado', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  REFUSED: { label: 'Recusado', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  EXPIRED: { label: 'Expirado', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
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
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Assinatura Eletrônica &amp; Digital</h3>
            <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">
              Envie contratos e documentos para coleta de assinaturas digitais com validade jurídica e trilha de auditoria completa.
            </p>
          </div>
        </div>
      </div>

      {missingApiKey && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>A chave de API de assinatura (DOCUSEAL_API_KEY) não está configurada no servidor. Configure a chave para habilitar o envio.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Enviados', val: docs.length, cls: 'text-[#231F20] dark:text-[#FEFDF3]' },
          { label: 'Aguardando', val: pending, cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Concluídos', val: concluded, cls: 'text-emerald-700 dark:text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">{c.label}</p>
            <p className={`mt-2 font-serif font-bold text-2xl sm:text-3xl ${c.cls}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Novo Documento para Assinatura</h2>
        <div>
          <label className={lbl}>Nome do Documento</label>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex.: Contrato de Prestação de Serviços — Cliente X" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Arquivo PDF (máximo 5MB)</label>
          <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 px-4 py-4 transition-all hover:border-[#2F4A3C] hover:bg-[#FEFDF3] dark:hover:bg-[#121614]">
            <Upload className="h-5 w-5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            <span className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">{file ? <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{file.name} ({(file.size/1024).toFixed(0)} KB)</span> : 'Clique para selecionar o arquivo PDF'}</span>
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
                  <button type="button" onClick={() => setSigners(sg => sg.filter((_,idx) => idx!==i))} className="rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSigners(sg => [...sg, {name:'',email:'',role:''}])} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
            <UserPlus className="h-3.5 w-3.5" /> Adicionar Outro Signatário
          </button>
        </div>
        {formError && <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-800 dark:text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" />{formError}</p>}
        {formSuccess && <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" />Documento enviado com sucesso para assinatura.</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Enviando…' : 'Enviar para Assinatura'}
        </button>
      </form>

      {/* Lista de documentos */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Documentos Enviados</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 disabled:opacity-40"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
        {docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhum documento enviado ainda.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {docs.map(doc => {
              const statusInfo = SIGNATURE_STATUS_PT[doc.status] ?? { label: doc.status, cls: 'bg-black/5 text-[#6E6A61]' };
              return (
                <div key={doc.id} className="flex items-center gap-3 py-3.5">
                  <FileSignature className="h-5 w-5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{doc.title ?? 'Documento sem título'}</p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{doc.signerName ?? doc.signerEmail} · {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${statusInfo.cls}`}>{statusInfo.label}</span>
                  <button
                    type="button"
                    disabled={resending===doc.id}
                    onClick={() => handleRefreshStatus(doc.id)}
                    className="rounded-full p-2 text-[#6E6A61] hover:bg-black/5 disabled:opacity-50"
                    title="Atualizar status"
                  >
                    {resending===doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <RotateCw className="h-4 w-4"/>}
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
      <span className="min-w-[140px] text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">{label}</span>
      <span className="flex items-center text-right text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{value}<CopyBtn text={value} /></span>
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
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <label className={lbl}>Número do CNPJ</label>
        <div className="mt-2 flex flex-col sm:flex-row gap-3">
          <input
            value={cnpj}
            onChange={e => setCnpj(formatCnpj(e.target.value))}
            placeholder="00.000.000/0001-00"
            maxLength={18}
            onKeyDown={e => e.key==='Enter' && handleSearch()}
            className="flex-1 rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Consultando…' : 'Consultar CNPJ'}
          </button>
        </div>
        {error && <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" />{error}</p>}
      </div>

      {result && (
        <div className="space-y-6 animate-in fade-in">
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-6 w-6 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                  <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#231F20] dark:text-[#FEFDF3]">{result.company?.name}</h2>
                </div>
                {result.alias && <p className="mt-1 text-sm font-medium text-[#6E6A61] dark:text-[#A8A49C]">{result.alias}</p>}
                <p className="mt-1 font-mono text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{formatCnpj(result.taxId)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${result.status?.text==='ATIVA'?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300':'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
                  {result.status?.text==='ATIVA'?<CheckCircle2 className="h-3.5 w-3.5"/>:<AlertTriangle className="h-3.5 w-3.5"/>}{result.status?.text ?? '—'}
                </span>
                {result.simples?.optant && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] px-3 py-1 text-xs font-bold text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
                    <CheckCircle2 className="h-3.5 w-3.5"/>Simples Nacional
                  </span>
                )}
                {result.head && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-white/10 border border-black/5 px-3 py-1 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">
                    Matriz
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]"><Building2 className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]"/>Identificação</h3>
              <CnpjRow label="Razão Social" value={result.company?.name} />
              <CnpjRow label="Nome Fantasia" value={result.alias} />
              <CnpjRow label="CNPJ" value={formatCnpj(result.taxId)} />
              <CnpjRow label="Data de Abertura" value={result.founded ?? null} />
              <CnpjRow label="Capital Social" value={result.company?.equity != null ? `R$ ${result.company.equity.toLocaleString('pt-BR',{minimumFractionDigits:2})}` : null} />
              {result.simples && <CnpjRow label="Regime Tributário" value={result.simples.optant ? `Optante Simples Nacional desde ${result.simples.since ?? '?'}` : 'Não optante'} />}
            </section>
            <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]"><Mail className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]"/>Contato &amp; Atividade</h3>
              {result.emails?.map((em,i) => <CnpjRow key={i} label="E-mail" value={em.address} />)}
              {result.phones?.map((ph,i) => <CnpjRow key={i} label="Telefone" value={`(${ph.area}) ${ph.number}`} />)}
              {result.mainActivity && (
                <CnpjRow label="CNAE Principal" value={`${result.mainActivity.id} — ${result.mainActivity.text}`} />
              )}
            </section>
            <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm md:col-span-2">
              <h3 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]"><MapPin className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]"/>Endereço Fiscal</h3>
              <CnpjRow label="Logradouro" value={addr} />
              <CnpjRow label="CEP" value={result.address?.zip ? String(result.address.zip).replace(/(\d{5})(\d{3})/,'$1-$2') : null} />
              <CnpjRow label="Município / UF" value={result.address ? `${result.address.city} / ${result.address.state}` : null} />
            </section>
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
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nova Tarefa</p>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5"><X className="h-4 w-4" /></button>
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
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar Tarefa
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
          ['Pendentes', 'pendente', 'text-[#231F20] dark:text-[#FEFDF3]'],
          ['Em Andamento', 'em_andamento', 'text-[#2F4A3C] dark:text-[#DFFFAE]'],
          ['Concluídas', 'concluida', 'text-emerald-700 dark:text-emerald-400'],
        ] as const).map(([label, key, cls]) => (
          <div key={key} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">{label}</p>
            <p className={`mt-2 font-serif font-bold text-2xl sm:text-3xl ${cls}`}>{counts[key]}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {([['todas', 'Todas'], ['pendente', 'Pendentes'], ['em_andamento', 'Em Andamento'], ['concluida', 'Concluídas']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                filter === key
                  ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
                  : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
              }`}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
        >
          <Plus className="h-4 w-4" /> Nova Tarefa
        </button>
      </div>

      {showForm && <TarefaForm customers={customers} onClose={() => setShowForm(false)} onAdded={onChanged} />}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
          <ClipboardList className="h-10 w-10 opacity-30" />
          <p className="text-sm">{filter === 'todas' ? 'Nenhuma tarefa cadastrada ainda.' : 'Nenhuma tarefa neste filtro.'}</p>
          {filter === 'todas' && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1E3328] px-5 py-2 text-xs font-bold text-[#DFFFAE]"
            >
              <Plus className="h-4 w-4" /> Criar Primeira Tarefa
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10 overflow-hidden shadow-sm">
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
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${cfg.cls}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] ${t.status === 'concluida' ? 'line-through opacity-60' : ''}`}>{t.titulo}</p>
                    <p className="truncate text-xs text-[#6E6A61] dark:text-[#A8A49C]">{t.clienteNome ?? 'Sem cliente vinculado'}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pri.cls}`}>{pri.label}</span>
                    <span className={`text-xs ${pz.cls}`}>{pz.text}</span>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${cfg.cls}`}>{cfg.label}</span>
                  {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-[#6E6A61]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#6E6A61]" />}
                </button>
                {isExp && (
                  <div className="mx-5 mb-4 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-5 space-y-4">
                    {t.descricao && <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">{t.descricao}</p>}
                    <div className="flex flex-wrap gap-1.5 sm:hidden">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pri.cls}`}>{pri.label}</span>
                      <span className={`text-xs ${pz.cls}`}>{pz.text}</span>
                    </div>
                    <div>
                      <p className={`${lbl} mb-2`}>Alterar Status</p>
                      <div className="flex flex-wrap gap-2">
                        {(['pendente', 'em_andamento', 'concluida'] as TarefaStatus[]).map(s => {
                          const c = TAREFA_STATUS_CONFIG[s];
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => changeStatus(t.id, s)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                                t.status === s
                                  ? `${c.cls} ring-2 ring-current/30`
                                  : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
                              }`}
                            >
                              <c.icon className="h-3.5 w-3.5" />{c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-black/5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => remove(t.id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover Tarefa
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
    <div className="space-y-6">
      <div className="flex">
        <SegmentedTabs
          tabs={TABS}
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

