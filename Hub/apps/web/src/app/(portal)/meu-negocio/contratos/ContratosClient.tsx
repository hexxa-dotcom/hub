'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
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
import dynamic from 'next/dynamic';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';
import { type ContractRow, type RepasseRow, createContractAction } from './actions';
import { STATUS_LABEL, STATUS_CLASS } from './contract-status';

// @react-pdf/renderer é pesado — só carrega quando o wizard é aberto.
const UnifiedContractWizard = dynamic(() => import('./UnifiedContractWizard').then(m => m.UnifiedContractWizard), { ssr: false });
const DocusealBuilder = dynamic(() => import('@docuseal/react').then((m) => m.DocusealBuilder), { ssr: false });

// ── Helpers ──────────────────────────────────────────────────────────────────

const field =
  'w-full rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-caption font-bold text-ink-soft uppercase tracking-wider';

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
    <div className="space-y-8">
      {/* 🟢 BARRA DE ABAS PADRÃO */}
      <div className="flex overflow-x-auto no-scrollbar py-1">
        <SegmentedTabs
          tabs={TABS.map(t => ({
            id: t.key,
            label: t.label,
            icon: t.icon,
          }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          layoutId="contratosTabIndicator"
        />
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
            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-5 card-finish">
              <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">
                {activeTab === 'entrada' ? 'Receita Contratual Prevista' : 'Total Pago a Fornecedores'}
              </p>
              <p className={`mt-2 font-serif tabular font-bold text-2xl sm:text-3xl ${activeTab === 'entrada' ? 'text-status-success' : 'text-status-danger'}`}>
                {BRL.format(activeTab === 'entrada' ? totalEntradaMensal : totalSaidaMensal)}/mês
              </p>
              <p className="mt-0.5 text-footnote text-ink-soft">
                {activeTab === 'entrada' ? entradas.length : saidas.length} contrato(s) registrado(s)
              </p>
            </div>

            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-5 card-finish">
              <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Contratos Ativos</p>
              <p className="mt-2 font-serif tabular font-bold text-2xl sm:text-3xl text-ink">
                {(activeTab === 'entrada' ? entradas : saidas).filter(c => c.status === 'ATIVO').length}
              </p>
              <p className="mt-0.5 text-footnote text-ink-soft">Gerando lançamentos recorrentes</p>
            </div>

            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-5 card-finish">
              <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">
                {activeTab === 'entrada' ? 'Faturamento com Nota Emitida' : activeTab === 'saida' ? 'Provisão de Saída Comprometida' : 'Mútuos Faturados (Risco DDL)'}
              </p>
              <p className="mt-2 font-serif tabular font-bold text-2xl sm:text-3xl text-hexxa-green dark:text-hexxa-lime">
                {BRL.format(
                  (activeTab === 'entrada' ? entradas : activeTab === 'saida' ? saidas : mutuos)
                    .filter(c => c.lastNfseEmitted)
                    .reduce((sum, c) => sum + c.value, 0)
                )}
              </p>
              <p className="mt-0.5 text-footnote text-ink-soft">Status fiscal atualizado</p>
            </div>
          </div>

          {/* Botão de Adicionar Contrato */}
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-base text-ink">
              {activeTab === 'entrada' ? 'Contratos de Serviços Prestados (Clientes)' : activeTab === 'saida' ? 'Contratos de Serviços Contratados (Fornecedores)' : 'Contratos de Mútuo Financeiro (Societário)'}
            </h2>
            <button
              type="button"
              onClick={() => setShowNewContractForm(v => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" /> Novo Contrato de {activeTab === 'entrada' ? 'Entrada' : activeTab === 'saida' ? 'Saída' : 'Mútuo'}
            </button>
          </div>

          {/* Formulário de Inclusão de Contrato */}
          {showNewContractForm && (
            <form onSubmit={handleCreateContract} className="rounded-3xl bg-surface-card shadow-(--elev-2) border border-black/5 dark:border-white/5 p-6 sm:p-8 space-y-4 card-finish animate-in fade-in">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                <h3 className="font-serif font-bold text-base text-ink">
                  Novo Contrato de {activeTab === 'entrada' ? 'Entrada (Serviço Prestado)' : activeTab === 'saida' ? 'Saída (Prestador/Fornecedor)' : 'Mútuo (Empréstimo)'}
                </h3>
                <button type="button" onClick={() => setShowNewContractForm(false)} className="rounded-full p-1 text-ink-soft hover:bg-black/5 dark:hover:bg-white/5">
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
                    <input type="checkbox" id="autoEmitNfse" name="autoEmitNfse" className="h-4 w-4 rounded border-black/10 dark:border-white/10 text-hexxa-green focus:ring-hexxa-lime" />
                    <label htmlFor="autoEmitNfse" className="text-xs font-bold text-ink cursor-pointer">
                      Emitir Nota Fiscal (NFSe) automaticamente no dia do vencimento
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingContract} className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60">
                  {savingContract ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingContract ? 'Salvando...' : 'Salvar Contrato e Gerar Lançamentos'}
                </button>
                <button type="button" onClick={() => setShowNewContractForm(false)} className="rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-5 py-2.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1)">
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
                className="group rounded-3xl bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) border border-black/5 dark:border-white/5 p-6 space-y-3 hover:-translate-y-0.5 transition-all card-finish"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="truncate font-serif font-bold text-base text-ink">{c.title}</h3>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASS[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="text-footnote text-ink-soft mt-1 truncate">
                      {activeTab === 'entrada' ? 'Cliente:' : 'Fornecedor:'} <strong className="text-ink">{c.partyName}</strong>
                    </p>
                    {c.status === 'RECUSADO' && c.refusalReason && (
                      <p className="text-caption text-status-danger mt-1">Motivo da recusa: {c.refusalReason}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft group-hover:translate-x-1 group-hover:text-ink transition-all mt-1" />
                </div>

                <div className="flex items-end justify-between">
                  <p className="font-serif tabular font-bold text-xl text-ink">{BRL.format(c.value)}<span className="text-xs font-sans font-normal text-ink-soft">/mês</span></p>
                  <p className="text-caption text-ink-soft">vence dia {c.dueDay}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                  {c.linkedOnPlatform && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) px-2.5 py-0.5 text-[10px] font-bold">
                      <Link2 className="h-3 w-3" /> Sincronizado
                    </span>
                  )}
                  {c.lastNfseEmitted ? (
                    <span className="rounded-full bg-status-success/15 px-2.5 py-0.5 text-[10px] font-bold text-status-success">
                      Faturado — NFSe {c.nfseNumber}
                    </span>
                  ) : (
                    <span className="rounded-full bg-status-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-status-warning">
                      Aguardando NFSe
                    </span>
                  )}
                  {c.signingDate ? (
                    <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-[10px] font-bold text-ink-soft">
                      Assinado {c.signingDate}
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-[10px] font-bold text-ink-soft">
                      Não assinado
                    </span>
                  )}
                </div>
              </Link>
            ))}

            {(activeTab === 'entrada' ? entradas : activeTab === 'saida' ? saidas : mutuos).length === 0 && (
              <p className="sm:col-span-2 text-sm text-ink-soft py-12 text-center">Nenhum contrato de {activeTab === 'entrada' ? 'entrada' : activeTab === 'saida' ? 'saída' : 'mútuo'} cadastrado ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* 💰 ABA REPASSES (INTEGRAÇÃO SAAS) */}
      {activeTab === 'repasses' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-5 card-finish">
              <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Total a Pagar Este Mês</p>
              <p className="mt-2 font-serif tabular font-bold text-2xl sm:text-3xl text-status-danger">
                {BRL.format(repasses.reduce((sum, r) => sum + r.valorMesPendente + r.valorExtraMesPendente, 0))}
              </p>
              <p className="mt-0.5 text-footnote text-ink-soft">Pendente, integração + extras</p>
            </div>
            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-5 card-finish">
              <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Faturado Via Integração Este Mês</p>
              <p className="mt-2 font-serif tabular font-bold text-2xl sm:text-3xl text-ink">
                {BRL.format(repasses.reduce((sum, r) => sum + r.valorMesTotal, 0))}
              </p>
              <p className="mt-0.5 text-footnote text-ink-soft">Pago + pendente, soma de todos os prestadores</p>
            </div>
            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-5 card-finish">
              <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Prestadores Vinculados</p>
              <p className="mt-2 font-serif tabular font-bold text-2xl sm:text-3xl text-ink">
                {repasses.filter((r) => r.status === 'ATIVO').length}
              </p>
              <p className="mt-0.5 text-footnote text-ink-soft">Com contrato ativo e repasse configurado</p>
            </div>
          </div>

          <h2 className="font-serif font-bold text-base text-ink">Valor a Pagar por Prestador</h2>

          <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 card-finish overflow-hidden">
            {repasses.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-soft">
                Nenhum contrato vinculado a repasse automático ainda. Crie um contrato de Prestação de Serviço com direção "Minha empresa contrata" e marque "Vincular a repasse automático" no wizard.
              </p>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {repasses.map((r) => (
                  <Link
                    key={r.contractId}
                    href={`/meu-negocio/contratos/${r.contractId}` as Route}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-ink">{r.partyName}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        {r.paymentFrequency !== 'MENSAL' && (
                          <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-[10px] font-bold text-ink-soft">
                            {r.paymentFrequency === 'QUINZENAL' ? 'Quinzenal' : 'Semanal'}
                          </span>
                        )}
                        {r.valorExtraMesPendente > 0 && (
                          <span className="rounded-full bg-status-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-status-warning">
                            + {BRL.format(r.valorExtraMesPendente)} extra
                          </span>
                        )}
                      </div>
                      <p className="text-footnote text-ink-soft mt-0.5">
                        ID na integração: <span className="font-mono text-ink">{r.externalProviderId}</span> · Repasse {r.repassePercent}%
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.paymentFrequency === 'QUINZENAL' ? (
                        <>
                          <p className="text-caption text-ink-soft">1ª quinz. <span className="font-serif tabular font-bold text-ink">{BRL.format(r.valorQuinzena1Pendente)}</span></p>
                          <p className="text-caption text-ink-soft">2ª quinz. <span className="font-serif tabular font-bold text-ink">{BRL.format(r.valorQuinzena2Pendente)}</span></p>
                        </>
                      ) : r.paymentFrequency === 'SEMANAL' ? (
                        <>
                          <p className="text-caption text-ink-soft">Sem. 1 <span className="font-serif tabular font-bold text-ink">{BRL.format(r.valorSemana1Pendente)}</span></p>
                          <p className="text-caption text-ink-soft">Sem. 2 <span className="font-serif tabular font-bold text-ink">{BRL.format(r.valorSemana2Pendente)}</span></p>
                          <p className="text-caption text-ink-soft">Sem. 3 <span className="font-serif tabular font-bold text-ink">{BRL.format(r.valorSemana3Pendente)}</span></p>
                          <p className="text-caption text-ink-soft">Sem. 4 <span className="font-serif tabular font-bold text-ink">{BRL.format(r.valorSemana4Pendente)}</span></p>
                        </>
                      ) : (
                        <>
                          <p className="font-serif tabular font-bold text-lg text-ink">{BRL.format(r.valorMesPendente)}</p>
                          <p className="text-caption text-ink-soft">pendente este mês</p>
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
            <form onSubmit={handleUploadSignature} className="rounded-3xl bg-surface-card shadow-(--elev-2) border border-black/5 dark:border-white/5 p-6 sm:p-8 space-y-4 card-finish">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                <h2 className="font-serif font-bold text-base text-ink">Enviar Documento Avulso para Assinatura Eletrônica</h2>
                <button
                  type="button"
                  onClick={() => setWizardMode('generate')}
                  className="text-xs font-bold text-hexxa-green dark:text-hexxa-lime hover:underline"
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
                        <button type="button" onClick={() => setSigners(sg => sg.filter((_, idx) => idx !== i))} className="rounded-full p-2 text-ink-soft hover:bg-status-danger/10 hover:text-status-danger transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSigners(sg => [...sg, { name: '', email: '', role: '' }])}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-hexxa-green dark:text-hexxa-lime hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Adicionar Signatário
                </button>
              </div>

              {formError && (
                <p className="flex items-center gap-2 rounded-2xl bg-status-danger/10 border border-status-danger/20 p-3 text-xs font-bold text-status-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {formError}
                </p>
              )}
              {formSuccess && (
                <p className="flex items-center gap-2 rounded-2xl bg-status-success/10 border border-status-success/20 p-3 text-xs font-bold text-status-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Contrato enviado via DocuSeal! Os signatários receberão o link por e-mail.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {submitting ? 'Enviando...' : 'Enviar para Assinatura Eletrônica'}
              </button>
            </form>
          )}

          {/* Lista de assinaturas enviadas (status via DocuSeal) */}
          {docs.length > 0 && (
            <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-6 sm:p-8 space-y-4 card-finish">
              <h3 className="font-serif font-bold text-base text-ink">Documentos Enviados para Assinatura</h3>
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {docs.map(d => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                    <div>
                      <p className="text-sm font-bold text-ink">{d.title ?? 'Documento sem título'}</p>
                      <p className="text-footnote text-ink-soft">{d.signerName ?? d.signerEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        d.status === 'SIGNED' ? 'bg-status-success/15 text-status-success'
                        : d.status === 'REFUSED' || d.status === 'EXPIRED' ? 'bg-status-danger/15 text-status-danger'
                        : 'bg-status-warning/15 text-status-warning'
                      }`}>
                        {d.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRefreshStatus(d.id)}
                        disabled={refreshingId === d.id}
                        className="rounded-full p-2 text-ink-soft hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
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
        <section className="rounded-3xl bg-surface-card shadow-(--elev-2) border border-black/5 dark:border-white/5 p-6 sm:p-8 animate-in fade-in space-y-4 card-finish">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
            <div>
              <h2 className="font-serif font-bold text-base text-ink">Construtor Interativo DocuSeal</h2>
              <p className="text-footnote text-ink-soft mt-0.5">Monte modelos de contratos customizados com campos arrastáveis</p>
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
            <div className="text-sm text-ink-soft py-12 text-center animate-pulse">
              Carregando construtor seguro DocuSeal...
            </div>
          )}
        </section>
      )}

    </div>
  );
}

