'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  ExternalLink,
  RotateCw,
  Clock,
  XCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Check,
  X,
  FilePenLine,
  FileSignature,
  Folder,
  Link2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { DocusealBuilder } from '@docuseal/react';
import dynamic from 'next/dynamic';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';
import { type ContractRow, type RepasseRow, createContractAction } from './actions';
import { STATUS_LABEL, STATUS_CLASS } from './contract-status';

// @react-pdf/renderer é pesado — só carrega quando o wizard é aberto.
const UnifiedContractWizard = dynamic(() => import('./UnifiedContractWizard').then(m => m.UnifiedContractWizard), { ssr: false });

// ── Helpers ──────────────────────────────────────────────────────────────────

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const TABS = [
  { key: 'entrada', label: 'Contratos de Entrada (Clientes)', icon: ArrowUpRight },
  { key: 'saida', label: 'Contratos de Saída (Fornecedores)', icon: ArrowDownRight },
  { key: 'mutuo', label: 'Mútuos (Societário)', icon: Sparkles },
  { key: 'repasses', label: 'Repasses (Integração SaaS)', icon: Wallet },
  { key: 'criar', label: 'Criar & Assinar Contrato (PDF/Wizard)', icon: FilePenLine },
  { key: 'docuseal', label: 'Construtor DocuSeal', icon: FileSignature },
];

export function ContratosClient({
  initialDocs,
  initialContracts,
  companyType,
  hasProperties,
  initialRepasses,
}: {
  initialDocs: SignatureRequestSummary[];
  initialContracts: ContractRow[];
  companyType: 'SERVICE' | 'HOLDING';
  hasProperties: boolean;
  initialRepasses: RepasseRow[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('entrada');
  const [contracts, setContracts] = useState<ContractRow[]>(initialContracts);
  const [repasses, setRepasses] = useState<RepasseRow[]>(initialRepasses);
  const [docs, setDocs] = useState<SignatureRequestSummary[]>(initialDocs);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [wizardMode, setWizardMode] = useState<'upload' | 'generate'>('generate');
  const [savingContract, setSavingContract] = useState(false);

  useEffect(() => setContracts(initialContracts), [initialContracts]);
  useEffect(() => setRepasses(initialRepasses), [initialRepasses]);

  // DocuSeal Token
  const [docusealToken, setDocusealToken] = useState<string | null>(null);

  // Modais
  const [showNewContractForm, setShowNewContractForm] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Form de Assinatura
  const [name, setName] = useState('');
  const [signers, setSigners] = useState<SignerInput[]>([{ name: '', email: '', role: '' }]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  async function refetchDocs() {
    try {
      const res = await fetch('/api/contratos');
      if (res.ok) setDocs(await res.json());
    } catch {
      // silencioso — a lista só é usada para exibir status recente
    }
  }

  async function handleRefreshStatus(id: string) {
    setRefreshingId(id);
    try {
      await fetch(`/api/contratos/reenviar/${id}`, { method: 'POST' });
      await refetchDocs();
    } finally {
      setRefreshingId(null);
    }
  }

  useEffect(() => {
    fetch('/api/docuseal/token', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.token) setDocusealToken(data.token);
      });
  }, []);

  function flashMessage(msg: string) {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 6000);
  }

  // Contratos Filtrados
  const entradas = contracts.filter(c => c.type === 'ENTRADA');
  const saidas = contracts.filter(c => c.type === 'SAIDA');
  const mutuos = contracts.filter(c => c.type === 'MUTUO_ATIVO' || c.type === 'MUTUO_PASSIVO');

  const totalEntradaMensal = entradas.filter(c => c.status === 'ATIVO').reduce((sum, c) => sum + c.value, 0);
  const totalSaidaMensal = saidas.filter(c => c.status === 'ATIVO').reduce((sum, c) => sum + c.value, 0);
  const totalMutuoMensal = mutuos.filter(c => c.status === 'ATIVO').reduce((sum, c) => sum + c.value, 0);

  // Ações de Contrato
  async function handleCreateContract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    let type: any = 'ENTRADA';
    if (activeTab === 'saida') type = 'SAIDA';
    if (activeTab === 'mutuo') type = fd.get('mutuoType'); // 'MUTUO_ATIVO' ou 'MUTUO_PASSIVO'

    const valor = Number(String(fd.get('value')).replace(',', '.'));
    const dueDay = Number(fd.get('dueDay'));
    const title = String(fd.get('title'));
    const partyName = String(fd.get('partyName'));
    const partyCnpj = String(fd.get('partyCnpj') ?? '');

    setSavingContract(true);
    try {
      const result = await createContractAction({
        type,
        title,
        partyName,
        partyCnpj,
        value: valor,
        dueDay,
        startDate: String(fd.get('startDate')),
        endDate: String(fd.get('endDate')),
        signingDate: String(fd.get('signingDate') ?? ''),
        autoEmitNfse: fd.get('autoEmitNfse') === 'on',
      });
      flashMessage(result.message);
      setShowNewContractForm(false);
      router.refresh();
    } finally {
      setSavingContract(false);
    }
  }

  async function handleUploadSignature(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setFormError('Selecione um arquivo PDF.'); return; }
    const valid = signers.filter(s => s.email.trim());
    if (!valid.length) { setFormError('Adicione ao menos um signatário com e-mail.'); return; }

    setSubmitting(true);
    setFormError(null);

    const form = new FormData();
    form.append('name', name);
    form.append('signers', JSON.stringify(valid));
    form.append('file', file);

    try {
      const res = await fetch('/api/contratos/criar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Erro ao enviar contrato.'); return; }
      await refetchDocs();
      setName('');
      setSigners([{ name: '', email: '', role: '' }]);
      setFile(null);
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 5000);
    } catch {
      setFormError('Falha na conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 🟢 BARRA DE ABAS PADRÃO */}
      <div className="flex flex-wrap gap-2 border-b border-black/5 dark:border-white/10 pb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all ${
              activeTab === t.key
                ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
                : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {actionMessage}
        </div>
      )}

      {/* 📥 / 📤 CONTRATOS DE ENTRADA OU SAÍDA */}
      {(activeTab === 'entrada' || activeTab === 'saida' || activeTab === 'mutuo') && (
        <div className="space-y-6 animate-in fade-in">
          {/* Cards KPI */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
                {activeTab === 'entrada' ? 'Receita Contratual Prevista' : 'Total Pago a Fornecedores'}
              </p>
              <p className={`mt-2 font-serif font-bold text-2xl sm:text-3xl ${activeTab === 'entrada' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {BRL.format(activeTab === 'entrada' ? totalEntradaMensal : totalSaidaMensal)}/mês
              </p>
              <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                {activeTab === 'entrada' ? entradas.length : saidas.length} contrato(s) registrado(s)
              </p>
            </div>

            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Contratos Ativos</p>
              <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3]">
                {(activeTab === 'entrada' ? entradas : saidas).filter(c => c.status === 'ATIVO').length}
              </p>
              <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">Gerando lançamentos recorrentes</p>
            </div>

            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
                {activeTab === 'entrada' ? 'Faturamento com Nota Emitida' : activeTab === 'saida' ? 'Provisão de Saída Comprometida' : 'Mútuos Faturados (Risco DDL)'}
              </p>
              <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-[#2F4A3C] dark:text-[#DFFFAE]">
                {BRL.format(
                  (activeTab === 'entrada' ? entradas : activeTab === 'saida' ? saidas : mutuos)
                    .filter(c => c.lastNfseEmitted)
                    .reduce((sum, c) => sum + c.value, 0)
                )}
              </p>
              <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">Status fiscal atualizado</p>
            </div>
          </div>

          {/* Botão de Adicionar Contrato */}
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
              {activeTab === 'entrada' ? 'Contratos de Serviços Prestados (Clientes)' : activeTab === 'saida' ? 'Contratos de Serviços Contratados (Fornecedores)' : 'Contratos de Mútuo Financeiro (Societário)'}
            </h2>
            <button
              type="button"
              onClick={() => setShowNewContractForm(v => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
            >
              <Plus className="h-4 w-4" /> Novo Contrato de {activeTab === 'entrada' ? 'Entrada' : activeTab === 'saida' ? 'Saída' : 'Mútuo'}
            </button>
          </div>

          {/* Formulário de Inclusão de Contrato */}
          {showNewContractForm && (
            <form onSubmit={handleCreateContract} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
                <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                  Novo Contrato de {activeTab === 'entrada' ? 'Entrada (Serviço Prestado)' : activeTab === 'saida' ? 'Saída (Prestador/Fornecedor)' : 'Mútuo (Empréstimo)'}
                </h3>
                <button type="button" onClick={() => setShowNewContractForm(false)} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {activeTab === 'mutuo' && (
                <div className="mb-4">
                  <label className={lbl}>Natureza do Mútuo *</label>
                  <select name="mutuoType" required className={`mt-1.5 ${field}`}>
                    <option value="MUTUO_ATIVO">Mútuo Ativo (A Empresa empresta ao Sócio)</option>
                    <option value="MUTUO_PASSIVO">Mútuo Passivo (O Sócio empresta à Empresa)</option>
                  </select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={lbl}>Título / Descrição do Contrato *</label>
                  <input name="title" required placeholder="Ex.: Prestação de Serviços de TI, Contrato de Consultoria..." className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>{activeTab === 'entrada' ? 'Nome do Cliente *' : activeTab === 'saida' ? 'Nome do Fornecedor / Terceirizado *' : 'Nome do Sócio / Contraparte *'}</label>
                  <input name="partyName" required placeholder="Razão social ou Nome completo" className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>CNPJ da Contraparte (opcional)</label>
                  <input name="partyCnpj" placeholder="00.000.000/0000-00" className={`mt-1.5 ${field}`} />
                  <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                    Se a contraparte também for cliente Hexxa, os lançamentos sincronizam automaticamente.
                  </p>
                </div>

                <div>
                  <label className={lbl}>Valor Mensal (R$) *</label>
                  <input name="value" required type="number" step="0.01" min="1" placeholder="0,00" className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>Dia de Vencimento no Mês *</label>
                  <input name="dueDay" required type="number" min="1" max="31" defaultValue="10" className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>Data de Início *</label>
                  <input name="startDate" required type="date" defaultValue={new Date().toISOString().split('T')[0]} className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>Data de Vencimento/Renovação *</label>
                  <input name="endDate" required type="date" defaultValue={new Date(Date.now() + 365*86400000).toISOString().split('T')[0]} className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>Data de Assinatura (opcional)</label>
                  <input name="signingDate" type="date" className={`mt-1.5 ${field}`} />
                  <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Deixe em branco se ainda não foi assinado — dá pra registrar depois.</p>
                </div>

                {activeTab === 'entrada' && (
                  <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                    <input type="checkbox" id="autoEmitNfse" name="autoEmitNfse" className="h-4 w-4 rounded text-[#2F4A3C] focus:ring-[#DFFFAE]" />
                    <label htmlFor="autoEmitNfse" className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] cursor-pointer">
                      Emitir Nota Fiscal (NFSe) automaticamente no dia do vencimento
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingContract} className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60">
                  {savingContract ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingContract ? 'Salvando...' : 'Salvar Contrato e Gerar Lançamentos'}
                </button>
                <button type="button" onClick={() => setShowNewContractForm(false)} className="rounded-full border border-black/10 dark:border-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista de Contratos — visual, cada card leva pro detalhe do vínculo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(activeTab === 'entrada' ? entradas : activeTab === 'saida' ? saidas : mutuos).map(c => (
              <Link
                key={c.id}
                href={`/meu-negocio/contratos/${c.id}` as Route}
                className="group rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 space-y-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[#1E3328]/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="truncate font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{c.title}</h3>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASS[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1 truncate">
                      {activeTab === 'entrada' ? 'Cliente:' : 'Fornecedor:'} <strong>{c.partyName}</strong>
                    </p>
                    {c.status === 'RECUSADO' && c.refusalReason && (
                      <p className="text-[11px] text-red-700 dark:text-red-400 mt-1">Motivo da recusa: {c.refusalReason}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C] group-hover:translate-x-1 group-hover:text-[#231F20] dark:group-hover:text-[#FEFDF3] transition-all mt-1" />
                </div>

                <div className="flex items-end justify-between">
                  <p className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(c.value)}<span className="text-xs font-sans font-normal text-[#6E6A61] dark:text-[#A8A49C]">/mês</span></p>
                  <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">vence dia {c.dueDay}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-black/5 dark:border-white/10">
                  {c.linkedOnPlatform && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1E3328] text-[#DFFFAE] px-2.5 py-0.5 text-[10px] font-bold">
                      <Link2 className="h-3 w-3" /> Sincronizado
                    </span>
                  )}
                  {c.lastNfseEmitted ? (
                    <span className="rounded-full bg-[#EFFFD6] px-2.5 py-0.5 text-[10px] font-bold text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
                      Faturado — NFSe {c.nfseNumber}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Aguardando NFSe
                    </span>
                  )}
                  {c.signingDate ? (
                    <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">
                      Assinado {c.signingDate}
                    </span>
                  ) : (
                    <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">
                      Não assinado
                    </span>
                  )}
                </div>
              </Link>
            ))}

            {(activeTab === 'entrada' ? entradas : activeTab === 'saida' ? saidas : mutuos).length === 0 && (
              <p className="sm:col-span-2 text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12 text-center">Nenhum contrato de {activeTab === 'entrada' ? 'entrada' : activeTab === 'saida' ? 'saída' : 'mútuo'} cadastrado ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* 💰 ABA REPASSES (INTEGRAÇÃO SAAS) */}
      {activeTab === 'repasses' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Total a Pagar Este Mês</p>
              <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-red-700 dark:text-red-400">
                {BRL.format(repasses.reduce((sum, r) => sum + r.valorMesPendente + r.valorExtraMesPendente, 0))}
              </p>
              <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">Pendente, integração + extras</p>
            </div>
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Faturado Via Integração Este Mês</p>
              <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3]">
                {BRL.format(repasses.reduce((sum, r) => sum + r.valorMesTotal, 0))}
              </p>
              <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">Pago + pendente, soma de todos os prestadores</p>
            </div>
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Prestadores Vinculados</p>
              <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3]">
                {repasses.filter((r) => r.status === 'ATIVO').length}
              </p>
              <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">Com contrato ativo e repasse configurado</p>
            </div>
          </div>

          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Valor a Pagar por Prestador</h2>

          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-sm overflow-hidden">
            {repasses.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
                Nenhum contrato vinculado a repasse automático ainda. Crie um contrato de Prestação de Serviço com direção "Minha empresa contrata" e marque "Vincular a repasse automático" no wizard.
              </p>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {repasses.map((r) => (
                  <Link
                    key={r.contractId}
                    href={`/meu-negocio/contratos/${r.contractId}` as Route}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{r.partyName}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        {r.paymentFrequency !== 'MENSAL' && (
                          <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">
                            {r.paymentFrequency === 'QUINZENAL' ? 'Quinzenal' : 'Semanal'}
                          </span>
                        )}
                        {r.valorExtraMesPendente > 0 && (
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            + {BRL.format(r.valorExtraMesPendente)} extra
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
                        ID na integração: <span className="font-mono">{r.externalProviderId}</span> · Repasse {r.repassePercent}%
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.paymentFrequency === 'QUINZENAL' ? (
                        <>
                          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">1ª quinz. <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(r.valorQuinzena1Pendente)}</span></p>
                          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">2ª quinz. <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(r.valorQuinzena2Pendente)}</span></p>
                        </>
                      ) : r.paymentFrequency === 'SEMANAL' ? (
                        <>
                          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sem. 1 <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(r.valorSemana1Pendente)}</span></p>
                          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sem. 2 <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(r.valorSemana2Pendente)}</span></p>
                          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sem. 3 <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(r.valorSemana3Pendente)}</span></p>
                          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sem. 4 <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(r.valorSemana4Pendente)}</span></p>
                        </>
                      ) : (
                        <>
                          <p className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(r.valorMesPendente)}</p>
                          <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">pendente este mês</p>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✍️ ABA CRIAR & ASSINAR CONTRATO (PDF + AUTENTIQUE + WIZARD) */}
      {activeTab === 'criar' && (
        <div className="space-y-6 animate-in fade-in">
          {wizardMode === 'generate' ? (
            <UnifiedContractWizard
              companyType={companyType}
              hasProperties={hasProperties}
              onCancel={() => setWizardMode('upload')}
              onDone={(message) => {
                flashMessage(message);
                setWizardMode('upload');
                router.refresh();
              }}
            />
          ) : (
            <form onSubmit={handleUploadSignature} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
                <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Enviar Documento Avulso para Assinatura Eletrônica</h2>
                <button
                  type="button"
                  onClick={() => setWizardMode('generate')}
                  className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline"
                >
                  ← Voltar pro Gerador Automático de Contrato
                </button>
              </div>

              <div>
                <label className={lbl}>Nome do Documento *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Ex.: Contrato de Prestação de Serviços — Cliente X"
                  className={`mt-1.5 ${field}`}
                />
              </div>

              <div>
                <label className={lbl}>Arquivo PDF (máx. 5MB)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className={`mt-1.5 ${field}`}
                />
              </div>

              <div>
                <label className={lbl}>Signatários do Contrato</label>
                <div className="mt-1.5 space-y-2">
                  {signers.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nome do signatário"
                        value={s.name}
                        onChange={e => setSigners(sg => sg.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                        className={`flex-1 ${field}`}
                      />
                      <input
                        type="email"
                        placeholder={`email${i + 1}@empresa.com`}
                        value={s.email}
                        onChange={e => setSigners(sg => sg.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                        className={`flex-1 ${field}`}
                      />
                      {signers.length > 1 && (
                        <button type="button" onClick={() => setSigners(sg => sg.filter((_, idx) => idx !== i))} className="rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSigners(sg => [...sg, { name: '', email: '', role: '' }])}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Adicionar Signatário
                </button>
              </div>

              {formError && (
                <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-800 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {formError}
                </p>
              )}
              {formSuccess && (
                <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Contrato enviado via DocuSeal! Os signatários receberão o link por e-mail.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {submitting ? 'Enviando...' : 'Enviar para Assinatura Eletrônica'}
              </button>
            </form>
          )}

          {/* Lista de assinaturas enviadas (status via DocuSeal) */}
          {docs.length > 0 && (
            <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Documentos Enviados para Assinatura</h3>
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {docs.map(d => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                    <div>
                      <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{d.title ?? 'Documento sem título'}</p>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{d.signerName ?? d.signerEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        d.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : d.status === 'REFUSED' || d.status === 'EXPIRED' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {d.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRefreshStatus(d.id)}
                        disabled={refreshingId === d.id}
                        className="rounded-full p-2 text-[#6E6A61] hover:bg-black/5 disabled:opacity-50"
                        title="Atualizar status"
                      >
                        <RotateCw className={`h-4 w-4 ${refreshingId === d.id ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✒️ ABA CONSTRUTOR DOCUSEAL */}
      {activeTab === 'docuseal' && (
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 animate-in fade-in space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
            <div>
              <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Construtor Interativo DocuSeal</h2>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Monte modelos de contratos customizados com campos arrastáveis</p>
            </div>
          </div>

          {docusealToken ? (
            <DocusealBuilder
              token={docusealToken}
              onSave={(e: any) => {
                alert('Modelo de contrato salvo com sucesso!');
              }}
            />
          ) : (
            <div className="text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12 text-center animate-pulse">
              Carregando construtor seguro DocuSeal...
            </div>
          )}
        </section>
      )}

    </div>
  );
}

