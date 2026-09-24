'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Link2,
  CalendarCheck,
  CalendarDays,
  Percent,
  RotateCcw,
  FileText,
  QrCode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Paperclip,
  X,
  Pencil,
} from 'lucide-react';
import type { ContractDetail } from '../actions';
import {
  atualizarAssinaturaAction,
  reajustarContratoAction,
  renovarContratoAction,
  cancelarContratoAction,
  marcarNfseEmitidaAction,
  getContractPdfAction,
  adicionarPagamentoExtraAction,
} from '../actions';
import { reenviarParaAssinaturaAction } from '../unified-actions';
import { STATUS_LABEL, STATUS_CLASS } from '../contract-status';
import { getComprovante } from '../../hub-financeiro/actions';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const field =
  'w-full rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-caption font-bold text-ink-soft uppercase tracking-wider';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const PAYMENT_STATUS_CFG: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  PENDING: { label: 'Em aberto', cls: 'bg-status-warning/15 text-status-warning', icon: Clock },
  PAID: { label: 'Pago', cls: 'bg-status-success/15 text-status-success', icon: CheckCircle2 },
  OVERDUE: { label: 'Vencido', cls: 'bg-status-danger/15 text-status-danger', icon: AlertTriangle },
  CANCELED: { label: 'Cancelado', cls: 'bg-surface-elevated text-ink-soft', icon: XCircle },
};

function InfoCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4">
      <p className="rotulo text-ink-soft">{label}</p>
      <p className="mt-0.5 font-serif tabular font-bold text-base text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-ink-soft">{hint}</p>}
    </div>
  );
}

export function ContratoDetailClient({ detail }: { detail: ContractDetail }) {
  const router = useRouter();
  const c = detail.contract;
  const isEntrada = c.type === 'ENTRADA';

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editingSigning, setEditingSigning] = useState(false);
  const [signingInput, setSigningInput] = useState(c.signingDate ?? '');

  const [showReajuste, setShowReajuste] = useState(false);
  const [reajustePct, setReajustePct] = useState('5');

  const [showNfse, setShowNfse] = useState(false);
  const [nfseInput, setNfseInput] = useState('');

  const [showPix, setShowPix] = useState(false);

  const [showExtra, setShowExtra] = useState(false);
  const [extraDescricao, setExtraDescricao] = useState('');
  const [extraValor, setExtraValor] = useState('');
  const [extraData, setExtraData] = useState(new Date().toISOString().split('T')[0]!);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 6000);
  }

  async function handleSalvarAssinatura() {
    setBusy(true);
    try {
      const res = await atualizarAssinaturaAction(c.id, signingInput);
      flash(res.message);
      setEditingSigning(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReajustar() {
    const pct = parseFloat(reajustePct) || 0;
    if (pct <= 0) return;
    setBusy(true);
    try {
      const res = await reajustarContratoAction(c.id, pct);
      flash(res.message);
      setShowReajuste(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRenovar() {
    setBusy(true);
    try {
      const res = await renovarContratoAction(c.id);
      flash(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelar() {
    if (!confirm('Cancelar este vínculo? Os lançamentos futuros ainda pendentes serão cancelados.')) return;
    setBusy(true);
    try {
      const res = await cancelarContratoAction(c.id);
      flash(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleMarcarNfse() {
    if (!nfseInput.trim()) return;
    setBusy(true);
    try {
      const res = await marcarNfseEmitidaAction(c.id, nfseInput.trim());
      flash(res.message);
      setShowNfse(false);
      setNfseInput('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdicionarExtra() {
    setBusy(true);
    try {
      const res = await adicionarPagamentoExtraAction({
        contractId: c.id,
        descricao: extraDescricao,
        valor: Number(extraValor.replace(',', '.')),
        dueDate: extraData,
      });
      flash(res.message);
      if (res.ok) {
        setShowExtra(false);
        setExtraDescricao('');
        setExtraValor('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerComprovante(paymentId: string) {
    const r = await getComprovante(paymentId);
    if (r) window.open(r.dataUrl, '_blank');
  }

  async function handleVerPdf() {
    setBusy(true);
    try {
      const base64 = await getContractPdfAction(c.id);
      if (!base64) { flash('PDF não disponível para este contrato.'); return; }
      const win = window.open('', '_blank');
      if (win) win.location.href = `data:application/pdf;base64,${base64}`;
    } finally {
      setBusy(false);
    }
  }

  async function handleReenviar() {
    setBusy(true);
    try {
      const res = await reenviarParaAssinaturaAction(c.id);
      flash(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const totalPago = detail.payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const totalAberto = detail.payments.filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {message}
        </div>
      )}

      {/* Cabeçalho / status */}
      <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-6 sm:p-8 space-y-6 card-finish">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isEntrada ? 'bg-status-success/15 text-status-success' : 'bg-status-warning/15 text-status-warning'}`}>
            {isEntrada ? 'Vínculo de Entrada (você presta o serviço)' : 'Vínculo de Saída (você contrata)'}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLASS[c.status]}`}>
            {STATUS_LABEL[c.status]}
          </span>
          {c.linkedOnPlatform && (
            <span className="inline-flex items-center gap-1 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) px-3 py-1 text-xs font-bold">
              <Link2 className="h-3 w-3" /> Sincronizado com {detail.mirrorPartyName ?? 'a contraparte'} na Hexxa
            </span>
          )}
          {c.externalProviderId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-[#7C3AED]/20 px-3 py-1 text-xs font-bold">
              Repasse automático — {c.repassePercent}% · {c.paymentFrequency === 'QUINZENAL' ? 'Quinzenal' : c.paymentFrequency === 'SEMANAL' ? 'Semanal' : 'Mensal'}
            </span>
          )}
        </div>

        {c.status === 'RECUSADO' && c.refusalReason && (
          <div className="flex items-center gap-2 rounded-2xl bg-status-danger/10 border border-status-danger/20 p-3 text-xs font-bold text-status-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Motivo da recusa: {c.refusalReason}
          </div>
        )}
        {c.status === 'AGUARDANDO_ASSINATURA' && (
          <div className="flex items-center gap-2 rounded-2xl bg-status-warning/10 border border-status-warning/20 p-3 text-xs font-bold text-status-warning">
            <Clock className="h-4 w-4 shrink-0" /> Aguardando a assinatura da contraparte — os lançamentos financeiros só são gerados quando o contrato for assinado.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoCard label={isEntrada ? 'Cliente' : 'Fornecedor'} value={c.partyName} hint={c.partyCnpj ?? undefined} />
          <InfoCard label="Valor Mensal" value={`${BRL.format(c.value)}/mês`} hint={`Vencimento todo dia ${c.dueDay}`} />
          <InfoCard label="Vigência" value={`${fmtDate(c.startDate)} — ${fmtDate(c.endDate)}`} />
          <InfoCard label="Total Pago" value={BRL.format(totalPago)} />
          <InfoCard label="Total em Aberto" value={BRL.format(totalAberto)} />
          <InfoCard
            label="Nota Fiscal"
            value={c.lastNfseEmitted ? `Nº ${c.nfseNumber}` : 'Não emitida'}
            hint={c.autoEmitNfse ? 'Emissão automática ativa' : undefined}
          />
        </div>

        {/* Data de assinatura */}
        <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="rotulo text-ink-soft">Data de assinatura</p>
              {editingSigning ? (
                <input
                  type="date"
                  value={signingInput}
                  onChange={(e) => setSigningInput(e.target.value)}
                  className="mt-1 rounded-xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 px-2.5 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
                />
              ) : (
                <p className="font-serif font-bold text-base text-ink">
                  {c.signingDate ? fmtDate(c.signingDate) : 'Ainda não assinado'}
                </p>
              )}
            </div>
          </div>
          {editingSigning ? (
            <div className="flex gap-2">
              <button type="button" onClick={handleSalvarAssinatura} disabled={busy} className="rounded-full bg-hexxa-forest hover:brightness-110 px-4 py-1.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
              </button>
              <button type="button" onClick={() => { setEditingSigning(false); setSigningInput(c.signingDate ?? ''); }} className="rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1)">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditingSigning(true)} className="inline-flex items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1)">
              <Pencil className="h-3.5 w-3.5" /> {c.signingDate ? 'Editar' : 'Registrar'}
            </button>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/5 dark:border-white/5">
          {c.hasPdf && (
            <button type="button" onClick={handleVerPdf} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) disabled:opacity-50 mt-3">
              <FileText className="h-3.5 w-3.5" /> Ver PDF do Contrato
            </button>
          )}
          {c.status === 'AGUARDANDO_ASSINATURA' && (
            <button type="button" onClick={handleReenviar} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 px-3.5 py-1.5 text-xs font-bold mt-3 disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reenviar para Assinatura
            </button>
          )}
          {c.status === 'ATIVO' && isEntrada && (
            <>
              <button type="button" onClick={() => setShowNfse(true)} className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 shadow-(--elev-1) px-3.5 py-1.5 text-xs font-bold mt-3">
                <FileText className="h-3.5 w-3.5" /> Marcar NFSe
              </button>
              <button type="button" onClick={() => setShowPix(true)} className="inline-flex items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/5 text-ink hover:bg-surface-elevated shadow-(--elev-1) px-3.5 py-1.5 text-xs font-bold mt-3">
                <QrCode className="h-3.5 w-3.5" /> Cobrar Pix
              </button>
            </>
          )}
          {c.status === 'ATIVO' && (
            <>
              <button type="button" onClick={() => setShowReajuste(true)} className="inline-flex items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) mt-3">
                <Percent className="h-3.5 w-3.5" /> Reajustar %
              </button>
              <button type="button" onClick={handleRenovar} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) disabled:opacity-50 mt-3">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Renovar (+12m)
              </button>
            </>
          )}
          {c.status === 'ATIVO' && c.externalProviderId && (
            <button type="button" onClick={() => setShowExtra(true)} className="inline-flex items-center gap-1.5 rounded-full bg-status-warning/15 text-status-warning hover:bg-status-warning/25 px-3.5 py-1.5 text-xs font-bold mt-3">
              + Pagamento Extra (Plantão etc.)
            </button>
          )}
          {(c.status === 'ATIVO' || c.status === 'AGUARDANDO_ASSINATURA') && (
            <button type="button" onClick={handleCancelar} disabled={busy} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-status-danger hover:bg-status-danger/10 disabled:opacity-50 mt-3">
              Cancelar Vínculo
            </button>
          )}
        </div>
      </div>

      {/* Histórico de pagamentos */}
      <div className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 card-finish overflow-hidden">
        <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-hexxa-green dark:text-hexxa-lime" />
          <h2 className="font-serif font-bold text-sm text-ink">Histórico de Pagamentos</h2>
        </div>
        {detail.payments.length === 0 ? (
          <p className="py-12 text-center text-xs text-ink-soft">Nenhum lançamento gerado ainda para este vínculo.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {detail.payments.map((p) => {
              const st = PAYMENT_STATUS_CFG[p.status] ?? PAYMENT_STATUS_CFG.PENDING!;
              const StIcon = st.icon;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{p.description}</p>
                    <p className="text-footnote text-ink-soft">
                      Vence {fmtDate(p.dueDate)}{p.paidAt ? ` · pago em ${fmtDate(p.paidAt)}` : ''}
                    </p>
                  </div>
                  <span className="font-serif tabular font-bold text-sm text-ink">{BRL.format(p.amount)}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>
                    <StIcon className="h-3 w-3" /> {st.label}
                  </span>
                  {p.hasReceipt && (
                    <button
                      type="button"
                      onClick={() => handleVerComprovante(p.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) px-2.5 py-0.5 text-[11px] font-bold"
                    >
                      <Paperclip className="h-3 w-3" /> Comprovante
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modais */}
      {showExtra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-surface-card shadow-(--elev-3) border border-black/5 dark:border-white/5 p-6 sm:p-8 card-finish space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-ink flex items-center gap-2">
                Pagamento Extra (Plantão etc.)
              </h3>
              <button onClick={() => setShowExtra(false)} className="rounded-full p-1 text-ink-soft hover:bg-black/5 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-ink-soft">
              Fica separado da regra automática de repasse ({c.repassePercent}%) — soma no total a pagar, mas aparece como extra.
            </p>
            <div>
              <label className={lbl}>Descrição *</label>
              <input value={extraDescricao} onChange={(e) => setExtraDescricao(e.target.value)} placeholder="Ex.: Plantão extra dia 15" className={`mt-1.5 ${field}`} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={lbl}>Valor (R$) *</label>
                <input value={extraValor} onChange={(e) => setExtraValor(e.target.value)} placeholder="0,00" className={`mt-1.5 ${field}`} />
              </div>
              <div>
                <label className={lbl}>Data *</label>
                <input type="date" value={extraData} onChange={(e) => setExtraData(e.target.value)} className={`mt-1.5 ${field}`} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdicionarExtra}
              disabled={busy || !extraDescricao.trim() || !extraValor.trim()}
              className="w-full rounded-full bg-hexxa-forest hover:brightness-110 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Lançar Pagamento Extra'}
            </button>
          </div>
        </div>
      )}

      {showNfse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-surface-card shadow-(--elev-3) border border-black/5 dark:border-white/5 p-6 sm:p-8 card-finish space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-ink flex items-center gap-2">
                <FileText className="h-5 w-5 text-hexxa-green dark:text-hexxa-lime" /> Marcar NFSe como Emitida
              </h3>
              <button onClick={() => setShowNfse(false)} className="rounded-full p-1 text-ink-soft hover:bg-black/5 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-ink-soft">
              A emissão real acontece em <strong>Meu Negócio → Notas</strong>. Aqui você só informa o número da nota já emitida para vincular a este vínculo.
            </p>
            <div>
              <label className={lbl}>Número da NFSe emitida *</label>
              <input value={nfseInput} onChange={(e) => setNfseInput(e.target.value)} placeholder="Ex.: 000142" className={`mt-1.5 ${field}`} />
            </div>
            <button
              type="button"
              onClick={handleMarcarNfse}
              disabled={busy || !nfseInput.trim()}
              className="w-full rounded-full bg-hexxa-forest hover:brightness-110 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirmar Vínculo'}
            </button>
          </div>
        </div>
      )}

      {showPix && (
        <GeneratePixModal isOpen={showPix} onClose={() => setShowPix(false)} initialDescription={`Contrato: ${c.title}`} />
      )}

      {showReajuste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-surface-card shadow-(--elev-3) border border-black/5 dark:border-white/5 p-6 sm:p-8 card-finish space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-ink flex items-center gap-2">
                <Percent className="h-5 w-5 text-hexxa-green dark:text-hexxa-lime" /> Reajustar Valor do Vínculo
              </h3>
              <button onClick={() => setShowReajuste(false)} className="rounded-full p-1 text-ink-soft hover:bg-black/5 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-ink-soft">
              Aplica um reajuste percentual no valor mensal{c.linkedOnPlatform ? ' (e do lado espelhado com a contraparte)' : ''}.
            </p>
            <div>
              <label className={lbl}>Percentual de Reajuste (%)</label>
              <input type="number" step="0.1" value={reajustePct} onChange={(e) => setReajustePct(e.target.value)} className={`mt-1.5 ${field}`} />
            </div>
            <button
              type="button"
              onClick={handleReajustar}
              disabled={busy}
              className="w-full rounded-full bg-hexxa-forest hover:brightness-110 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {busy ? 'Aplicando...' : 'Aplicar Reajuste'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
