'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  QrCode,
  FileText,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  X,
  Percent,
  RotateCcw,
  FilePenLine,
  FileSignature,
  Folder,
  Link2,
  Sparkles,
} from 'lucide-react';
import { DocusealBuilder } from '@docuseal/react';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';
import { ContractWizard } from './ContractWizard';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';
import {
  type ContractRow,
  createContractAction,
  reajustarContratoAction,
  renovarContratoAction,
  cancelarContratoAction,
  marcarNfseEmitidaAction,
} from './actions';

// ── Helpers ──────────────────────────────────────────────────────────────────

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const TABS = [
  { key: 'entrada', label: 'Contratos de Entrada (Clientes)', icon: ArrowUpRight },
  { key: 'saida', label: 'Contratos de Saída (Fornecedores)', icon: ArrowDownRight },
  { key: 'criar', label: 'Criar & Assinar Contrato (PDF/Wizard)', icon: FilePenLine },
  { key: 'docuseal', label: 'Construtor DocuSeal', icon: FileSignature },
];

export function ContratosClient({
  initialDocs,
  initialContracts,
}: {
  initialDocs: SignatureRequestSummary[];
  initialContracts: ContractRow[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('entrada');
  const [contracts, setContracts] = useState<ContractRow[]>(initialContracts);
  const [docs, setDocs] = useState<SignatureRequestSummary[]>(initialDocs);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [wizardMode, setWizardMode] = useState<'upload' | 'generate'>('upload');
  const [savingContract, setSavingContract] = useState(false);

  useEffect(() => setContracts(initialContracts), [initialContracts]);

  // DocuSeal Token
  const [docusealToken, setDocusealToken] = useState<string | null>(null);

  // Modais
  const [showNewContractForm, setShowNewContractForm] = useState(false);
  const [selectedPixModal, setSelectedPixModal] = useState<ContractRow | null>(null);
  const [selectedNfseModal, setSelectedNfseModal] = useState<ContractRow | null>(null);
  const [selectedReajusteModal, setSelectedReajusteModal] = useState<ContractRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Reajuste % / NFSe manual
  const [reajustePct, setReajustePct] = useState('5');
  const [nfseNumeroInput, setNfseNumeroInput] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

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

  const totalEntradaMensal = entradas.filter(c => c.status === 'ATIVO').reduce((sum, c) => sum + c.value, 0);
  const totalSaidaMensal = saidas.filter(c => c.status === 'ATIVO').reduce((sum, c) => sum + c.value, 0);

  // Ações de Contrato
  async function handleCreateContract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type = activeTab === 'saida' ? 'SAIDA' : 'ENTRADA';
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

  async function handleReajustar(contractId: string) {
    const pct = parseFloat(reajustePct) || 0;
    if (pct <= 0) return;
    setActionBusyId(contractId);
    try {
      const result = await reajustarContratoAction(contractId, pct);
      flashMessage(result.message);
      setSelectedReajusteModal(null);
      router.refresh();
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleRenovar(contractId: string) {
    setActionBusyId(contractId);
    try {
      const result = await renovarContratoAction(contractId);
      flashMessage(result.message);
      router.refresh();
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCancelar(contractId: string) {
    setActionBusyId(contractId);
    try {
      const result = await cancelarContratoAction(contractId);
      flashMessage(result.message);
      router.refresh();
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleMarcarNfseEmitida(c: ContractRow) {
    if (!nfseNumeroInput.trim()) return;
    setActionBusyId(c.id);
    try {
      const result = await marcarNfseEmitidaAction(c.id, nfseNumeroInput.trim());
      flashMessage(result.message);
      setSelectedNfseModal(null);
      setNfseNumeroInput('');
      router.refresh();
    } finally {
      setActionBusyId(null);
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
      {(activeTab === 'entrada' || activeTab === 'saida') && (
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
                {activeTab === 'entrada' ? 'Faturamento com Nota Emitida' : 'Provisão de Saída Comprometida'}
              </p>
              <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-[#2F4A3C] dark:text-[#DFFFAE]">
                {BRL.format(
                  (activeTab === 'entrada' ? entradas : saidas)
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
              {activeTab === 'entrada' ? 'Contratos de Serviços Prestados (Clientes)' : 'Contratos de Serviços Contratados (Fornecedores)'}
            </h2>
            <button
              type="button"
              onClick={() => setShowNewContractForm(v => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
            >
              <Plus className="h-4 w-4" /> Novo Contrato de {activeTab === 'entrada' ? 'Entrada' : 'Saída'}
            </button>
          </div>

          {/* Formulário de Inclusão de Contrato */}
          {showNewContractForm && (
            <form onSubmit={handleCreateContract} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
                <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                  Novo Contrato de {activeTab === 'entrada' ? 'Entrada (Serviço Prestado)' : 'Saída (Prestador/Fornecedor)'}
                </h3>
                <button type="button" onClick={() => setShowNewContractForm(false)} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={lbl}>Título / Descrição do Contrato *</label>
                  <input name="title" required placeholder="Ex.: Prestação de Serviços de TI, Contrato de Consultoria..." className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>{activeTab === 'entrada' ? 'Nome do Cliente *' : 'Nome do Fornecedor / Terceirizado *'}</label>
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

          {/* Lista de Contratos */}
          <div className="space-y-4">
            {(activeTab === 'entrada' ? entradas : saidas).map(c => (
              <div key={c.id} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{c.title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        c.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}>
                        {c.status}
                      </span>
                      {c.linkedOnPlatform && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] px-2.5 py-0.5 text-[10px] font-bold text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
                          <Link2 className="h-3 w-3" /> Sincronizado na Hexxa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">
                      {activeTab === 'entrada' ? 'Cliente:' : 'Fornecedor:'} <strong>{c.partyName}</strong> · Vencimento todo dia {c.dueDay}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(c.value)}/mês</p>
                    <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Vigência: {c.startDate} a {c.endDate}</p>
                  </div>
                </div>

                {/* Status de Provisão / NFSe */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.lastNfseEmitted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] px-3 py-1 text-xs font-bold text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
                        🟢 Faturado — NFSe Nº {c.nfseNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                        🔵 Provisão de Caixa (Aguardando NFSe)
                      </span>
                    )}

                    {c.autoEmitNfse && (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold">
                        ⚡ NFSe Automática Ativa
                      </span>
                    )}
                  </div>

                  {/* Ações Rápidas no Contrato */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeTab === 'entrada' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedNfseModal(c)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#1E3328] text-[#DFFFAE] hover:bg-[#2F4A3C] px-3.5 py-1.5 text-xs font-bold"
                        >
                          <FileText className="h-3.5 w-3.5" /> Marcar NFSe
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPixModal(c)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] px-3.5 py-1.5 text-xs font-bold"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Cobrar Pix
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedReajusteModal(c)}
                      className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
                    >
                      <Percent className="h-3.5 w-3.5" /> Reajustar %
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRenovar(c.id)}
                      disabled={actionBusyId === c.id}
                      className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 disabled:opacity-50"
                    >
                      {actionBusyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Renovar (+12m)
                    </button>

                    {c.status === 'ATIVO' && (
                      <button
                        type="button"
                        onClick={() => handleCancelar(c.id)}
                        disabled={actionBusyId === c.id}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(activeTab === 'entrada' ? entradas : saidas).length === 0 && (
              <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12 text-center">Nenhum contrato de {activeTab === 'entrada' ? 'entrada' : 'saída'} cadastrado ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* ✍️ ABA CRIAR & ASSINAR CONTRATO (PDF + AUTENTIQUE + WIZARD) */}
      {activeTab === 'criar' && (
        <div className="space-y-6 animate-in fade-in">
          {wizardMode === 'generate' ? (
            <ContractWizard
              onCancel={() => setWizardMode('upload')}
              onGenerated={(generatedFile) => {
                setFile(generatedFile);
                if (!name) setName(generatedFile.name.replace('.pdf', ''));
                setWizardMode('upload');
              }}
            />
          ) : (
            <form onSubmit={handleUploadSignature} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
                <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Enviar Contrato para Assinatura Eletrônica</h2>
                <button
                  type="button"
                  onClick={() => setWizardMode('generate')}
                  className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline"
                >
                  Usar Gerador de Modelos Padrão →
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

      {/* MODAIS DE AÇÃO */}
      {selectedNfseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                Marcar Nota Fiscal (NFSe) como Emitida
              </h3>
              <button onClick={() => { setSelectedNfseModal(null); setNfseNumeroInput(''); }} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-2 text-sm bg-black/5 dark:bg-white/5 p-4 rounded-2xl">
              <p><span className="text-[#6E6A61] dark:text-[#A8A49C]">Contrato:</span> <strong>{selectedNfseModal.title}</strong></p>
              <p><span className="text-[#6E6A61] dark:text-[#A8A49C]">Tomador (Cliente):</span> <strong>{selectedNfseModal.partyName}</strong></p>
              <p><span className="text-[#6E6A61] dark:text-[#A8A49C]">Valor da Nota:</span> <strong className="text-emerald-700 dark:text-emerald-400">{BRL.format(selectedNfseModal.value)}</strong></p>
            </div>

            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              A emissão real acontece em <strong>Meu Negócio → Fiscal / NFSe</strong>. Aqui você só informa o número da nota já emitida para vincular ao contrato.
            </p>

            <div>
              <label className={lbl}>Número da NFSe emitida *</label>
              <input
                value={nfseNumeroInput}
                onChange={e => setNfseNumeroInput(e.target.value)}
                placeholder="Ex.: 000142"
                className={`mt-1.5 ${field}`}
              />
            </div>

            <button
              type="button"
              onClick={() => handleMarcarNfseEmitida(selectedNfseModal)}
              disabled={actionBusyId === selectedNfseModal.id || !nfseNumeroInput.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
            >
              {actionBusyId === selectedNfseModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmar Vínculo
            </button>
          </div>
        </div>
      )}

      {selectedPixModal && (
        <GeneratePixModal
          isOpen={!!selectedPixModal}
          onClose={() => setSelectedPixModal(null)}
          initialDescription={`Contrato: ${selectedPixModal.title}`}
        />
      )}

      {selectedReajusteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                <Percent className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                Reajustar Valor do Contrato
              </h3>
              <button onClick={() => setSelectedReajusteModal(null)} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5"><X className="h-5 w-5" /></button>
            </div>

            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              Aplica um reajuste percentual no valor mensal do contrato <strong>{selectedReajusteModal.title}</strong>
              {selectedReajusteModal.linkedOnPlatform ? ' (e do lado espelhado com a contraparte)' : ''}.
            </p>

            <div>
              <label className={lbl}>Percentual de Reajuste (%)</label>
              <input
                type="number"
                step="0.1"
                value={reajustePct}
                onChange={e => setReajustePct(e.target.value)}
                className={`mt-1.5 ${field}`}
              />
            </div>

            <button
              type="button"
              onClick={() => handleReajustar(selectedReajusteModal.id)}
              disabled={actionBusyId === selectedReajusteModal.id}
              className="w-full rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
            >
              {actionBusyId === selectedReajusteModal.id ? 'Aplicando...' : 'Aplicar Reajuste'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

