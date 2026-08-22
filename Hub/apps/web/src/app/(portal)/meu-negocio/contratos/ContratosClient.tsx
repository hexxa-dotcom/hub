'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash, UploadSimple, Spinner, CheckCircle, WarningCircle, UserPlus,
  ArrowSquareOut, ArrowsClockwise, Clock, XCircle, EnvelopeSimple, CaretDown, CaretUp,
  QrCode, FileText, TrendUp, ArrowDownRight, ArrowUpRight, Check, X, Percent, ArrowClockwise,
  PencilSimpleLine, Signature, FolderSimple, LinkSimple
} from '@phosphor-icons/react';
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
  'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const TABS = [
  { key: 'entrada', label: 'Contratos de Entrada (Clientes)', icon: ArrowUpRight },
  { key: 'saida', label: 'Contratos de Saída (Fornecedores)', icon: ArrowDownRight },
  { key: 'criar', label: 'Criar & Assinar Contrato (PDF/Wizard)', icon: PencilSimpleLine },
  { key: 'docuseal', label: 'Construtor DocuSeal', icon: Signature },
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
      {/* 🟢 BARRA FLUTUANTE PADRÃO DO SISTEMA (Sub-menu estilo CRM/Financeiro) */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-card p-1 dark:bg-white/3">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-surface-card text-brand-600 shadow-sm dark:bg-white/10 dark:text-brand-400 font-semibold'
                : 'text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className="flex items-center gap-3 rounded-2xl bg-ok/10 border border-ok/30 p-4 text-sm text-ok font-medium animate-in fade-in">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {actionMessage}
        </div>
      )}

      {/* 📥 / 📤 CONTRATOS DE ENTRADA OU SAÍDA */}
      {(activeTab === 'entrada' || activeTab === 'saida') && (
        <div className="space-y-6 animate-in fade-in">
          {/* Cards KPI */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card-flat rounded-card p-5">
              <p className="text-xs font-medium text-ink-soft">
                {activeTab === 'entrada' ? 'Total Recebido em Contratos' : 'Total Pago a Fornecedores'}
              </p>
              <p className={`mt-2 text-2xl font-bold ${activeTab === 'entrada' ? 'text-ok' : 'text-critical'}`}>
                {BRL.format(activeTab === 'entrada' ? totalEntradaMensal : totalSaidaMensal)}/mês
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {activeTab === 'entrada' ? entradas.length : saidas.length} contrato(s) registrado(s)
              </p>
            </div>

            <div className="card-flat rounded-card p-5">
              <p className="text-xs font-medium text-ink-soft">Contratos Ativos</p>
              <p className="mt-2 text-2xl font-bold text-ink">
                {(activeTab === 'entrada' ? entradas : saidas).filter(c => c.status === 'ATIVO').length}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">Gerando lançamentos recorrentes</p>
            </div>

            <div className="card-flat rounded-card p-5">
              <p className="text-xs font-medium text-ink-soft">
                {activeTab === 'entrada' ? 'Faturamento Com Nota Emitida' : 'Provisão de Saída Comprometida'}
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-500">
                {BRL.format(
                  (activeTab === 'entrada' ? entradas : saidas)
                    .filter(c => c.lastNfseEmitted)
                    .reduce((sum, c) => sum + c.value, 0)
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">Status fiscal atualizado</p>
            </div>
          </div>

          {/* Botão de Adicionar Contrato */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">
              {activeTab === 'entrada' ? 'Contratos de Serviços Prestados (Clientes)' : 'Contratos de Serviços Contratados (Fornecedores)'}
            </h2>
            <button
              type="button"
              onClick={() => setShowNewContractForm(v => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Novo Contrato de {activeTab === 'entrada' ? 'Entrada' : 'Saída'}
            </button>
          </div>

          {/* Formulário de Inclusão de Contrato */}
          {showNewContractForm && (
            <form onSubmit={handleCreateContract} className="rounded-2xl border border-brand-400/30 bg-brand-500/5 p-6 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-sm font-bold text-brand-500">
                  + Cadastrar Contrato de {activeTab === 'entrada' ? 'Entrada (Serviço Prestado)' : 'Saída (Prestador/Fornecedor)'}
                </h3>
                <button type="button" onClick={() => setShowNewContractForm(false)} className="text-ink-soft hover:text-ink">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={lbl}>Título / Descrição do Contrato *</label>
                  <input name="title" required placeholder="Ex.: Prestação de Serviços de TI, Contrato Social..." className={`mt-1 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>{activeTab === 'entrada' ? 'Nome do Cliente *' : 'Nome do Fornecedor / Terceirizado *'}</label>
                  <input name="partyName" required placeholder="Razão social ou Nome completo" className={`mt-1 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>CNPJ da contraparte (opcional)</label>
                  <input name="partyCnpj" placeholder="00.000.000/0000-00" className={`mt-1 ${field}`} />
                  <p className="mt-1 text-[11px] text-ink-soft">
                    Se a contraparte também for cliente Hexxa, o contrato e os lançamentos são sincronizados dos dois lados automaticamente.
                  </p>
                </div>

                <div>
                  <label className={lbl}>Valor Mensal (R$) *</label>
                  <input name="value" required type="number" step="0.01" min="1" placeholder="0,00" className={`mt-1 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>Dia de Vencimento no Mês *</label>
                  <input name="dueDay" required type="number" min="1" max="31" defaultValue="10" className={`mt-1 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>Data de Início *</label>
                  <input name="startDate" required type="date" defaultValue={new Date().toISOString().split('T')[0]} className={`mt-1 ${field}`} />
                </div>

                <div>
                  <label className={lbl}>Data de Vencimento/Renovação *</label>
                  <input name="endDate" required type="date" defaultValue={new Date(Date.now() + 365*86400000).toISOString().split('T')[0]} className={`mt-1 ${field}`} />
                </div>

                {activeTab === 'entrada' && (
                  <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                    <input type="checkbox" id="autoEmitNfse" name="autoEmitNfse" className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500" />
                    <label htmlFor="autoEmitNfse" className="text-xs font-medium text-ink cursor-pointer">
                      Emitir Nota Fiscal (NFSe) automaticamente no dia do vencimento
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingContract} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                  {savingContract ? <Spinner className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingContract ? 'Salvando...' : 'Salvar Contrato e Gerar Lançamentos'}
                </button>
                <button type="button" onClick={() => setShowNewContractForm(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/5">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista de Contratos */}
          <div className="space-y-4">
            {(activeTab === 'entrada' ? entradas : saidas).map(c => (
              <div key={c.id} className="rounded-2xl border border-line bg-surface-card p-5 space-y-4 hover:border-brand-400/40 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-ink">{c.title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        c.status === 'ATIVO' ? 'bg-ok/10 text-ok' : 'bg-critical/10 text-critical'
                      }`}>
                        {c.status}
                      </span>
                      {c.linkedOnPlatform && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                          <LinkSimple className="h-3 w-3" /> Sincronizado (também é cliente Hexxa)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {activeTab === 'entrada' ? 'Cliente:' : 'Fornecedor:'} <strong>{c.partyName}</strong> · Vencimento todo dia {c.dueDay}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-extrabold text-ink">{BRL.format(c.value)}/mês</p>
                    <p className="text-[11px] text-ink-soft">Vigência: {c.startDate} a {c.endDate}</p>
                  </div>
                </div>

                {/* Status de Provisão / NFSe */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {c.lastNfseEmitted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                        🟢 Faturado — NFSe Nº {c.nfseNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">
                        🔵 Provisão de Caixa (Aguardando NFSe)
                      </span>
                    )}

                    {c.autoEmitNfse && (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600">
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
                          className="inline-flex items-center gap-1 rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-500/20 dark:text-brand-400"
                        >
                          <FileText className="h-3.5 w-3.5" /> Marcar NFSe Emitida
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPixModal(c)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Cobrar Pix
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedReajusteModal(c)}
                      className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink hover:bg-black/5"
                    >
                      <Percent className="h-3.5 w-3.5" /> Reajustar %
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRenovar(c.id)}
                      disabled={actionBusyId === c.id}
                      className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink hover:bg-black/5 disabled:opacity-50"
                    >
                      {actionBusyId === c.id ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <ArrowClockwise className="h-3.5 w-3.5" />} Renovar (+12m)
                    </button>

                    {c.status === 'ATIVO' && (
                      <button
                        type="button"
                        onClick={() => handleCancelar(c.id)}
                        disabled={actionBusyId === c.id}
                        className="inline-flex items-center gap-1 rounded-xl bg-critical/10 px-2.5 py-1.5 text-xs font-medium text-critical hover:bg-critical/20 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(activeTab === 'entrada' ? entradas : saidas).length === 0 && (
              <p className="text-sm text-ink-soft py-8 text-center">Nenhum contrato de {activeTab === 'entrada' ? 'entrada' : 'saída'} cadastrado ainda.</p>
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
            <form onSubmit={handleUploadSignature} className="card-flat rounded-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h2 className="text-lg font-semibold text-ink">Enviar Contrato para Assinatura Eletrônica</h2>
                <button
                  type="button"
                  onClick={() => setWizardMode('generate')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 underline"
                >
                  Usar Gerador de Modelos Padrão +
                </button>
              </div>

              <div>
                <label className={lbl}>Nome do Documento *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Ex.: Contrato de Prestação de Serviços — Cliente X"
                  className={`mt-1 ${field}`}
                />
              </div>

              <div>
                <label className={lbl}>Arquivo PDF (máx. 5MB)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className={`mt-1 ${field}`}
                />
              </div>

              <div>
                <label className={lbl}>Signatários do Contrato</label>
                <div className="mt-1 space-y-2">
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
                        <button type="button" onClick={() => setSigners(sg => sg.filter((_, idx) => idx !== i))} className="text-ink-soft hover:text-critical">
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSigners(sg => [...sg, { name: '', email: '', role: '' }])}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Adicionar Signatário
                </button>
              </div>

              {formError && (
                <p className="flex items-center gap-2 rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">
                  <WarningCircle className="h-4 w-4 shrink-0" /> {formError}
                </p>
              )}
              {formSuccess && (
                <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">
                  <CheckCircle className="h-4 w-4 shrink-0" /> Contrato enviado via DocuSeal! Os signatários receberão o link por e-mail.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {submitting ? <Spinner className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {submitting ? 'Enviando...' : 'Enviar para Assinatura Eletrônica'}
              </button>
            </form>
          )}

          {/* Lista de assinaturas enviadas (status via DocuSeal) */}
          {docs.length > 0 && (
            <div className="card-flat rounded-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-ink">Documentos Enviados para Assinatura</h3>
              <div className="space-y-2">
                {docs.map(d => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{d.title ?? 'Documento sem título'}</p>
                      <p className="text-xs text-ink-soft">{d.signerName ?? d.signerEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        d.status === 'SIGNED' ? 'bg-ok/10 text-ok'
                        : d.status === 'REFUSED' || d.status === 'EXPIRED' ? 'bg-critical/10 text-critical'
                        : 'bg-warn/10 text-warn'
                      }`}>
                        {d.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRefreshStatus(d.id)}
                        disabled={refreshingId === d.id}
                        className="text-ink-soft hover:text-ink disabled:opacity-50"
                        title="Atualizar status"
                      >
                        <ArrowsClockwise className={`h-4 w-4 ${refreshingId === d.id ? 'animate-spin' : ''}`} />
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
        <section className="card-flat rounded-card p-5 animate-in fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="text-lg font-semibold text-ink">Construtor Interativo DocuSeal</h2>
            <p className="text-xs text-ink-soft">Monte modelos de contratos customizados com campos arrastáveis</p>
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

      {/* MODAIS DE AÇÃO */}
      {selectedNfseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-surface-card border border-line p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-500" />
                Marcar Nota Fiscal (NFSe) como Emitida
              </h3>
              <button onClick={() => { setSelectedNfseModal(null); setNfseNumeroInput(''); }} className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-2 text-sm bg-black/5 dark:bg-white/5 p-4 rounded-xl">
              <p><span className="text-ink-soft">Contrato:</span> <strong>{selectedNfseModal.title}</strong></p>
              <p><span className="text-ink-soft">Tomador (Cliente):</span> <strong>{selectedNfseModal.partyName}</strong></p>
              <p><span className="text-ink-soft">Valor da Nota:</span> <strong className="text-ok">{BRL.format(selectedNfseModal.value)}</strong></p>
            </div>

            <p className="text-xs text-ink-soft">
              A emissão real acontece em <strong>Meu Negócio → Notas</strong>. Aqui você só informa o número da nota já emitida, pra vincular ao contrato.
            </p>

            <div>
              <label className={lbl}>Número da NFSe emitida *</label>
              <input
                value={nfseNumeroInput}
                onChange={e => setNfseNumeroInput(e.target.value)}
                placeholder="Ex.: 000142"
                className={`mt-1 ${field}`}
              />
            </div>

            <button
              type="button"
              onClick={() => handleMarcarNfseEmitida(selectedNfseModal)}
              disabled={actionBusyId === selectedNfseModal.id || !nfseNumeroInput.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {actionBusyId === selectedNfseModal.id ? <Spinner className="h-4 w-4 animate-spin" /> : null}
              Confirmar
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
          <div className="w-full max-w-md rounded-2xl bg-surface-card border border-line p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Percent className="h-5 w-5 text-brand-500" />
                Reajustar Valor do Contrato
              </h3>
              <button onClick={() => setSelectedReajusteModal(null)} className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
            </div>

            <p className="text-xs text-ink-soft">
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
                className={`mt-1 ${field}`}
              />
            </div>

            <button
              type="button"
              onClick={() => handleReajustar(selectedReajusteModal.id)}
              disabled={actionBusyId === selectedReajusteModal.id}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {actionBusyId === selectedReajusteModal.id ? 'Aplicando...' : 'Aplicar Reajuste'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
