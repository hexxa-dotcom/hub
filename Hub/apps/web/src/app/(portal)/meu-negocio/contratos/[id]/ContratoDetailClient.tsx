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
} from '../actions';
import { getComprovante } from '../../hub-financeiro/actions';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const PAYMENT_STATUS_CFG: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  PENDING: { label: 'Em aberto', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', icon: Clock },
  PAID: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', icon: CheckCircle2 },
  OVERDUE: { label: 'Vencido', cls: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300', icon: AlertTriangle },
  CANCELED: { label: 'Cancelado', cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]', icon: XCircle },
};

function InfoCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">{label}</p>
      <p className="mt-0.5 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">{hint}</p>}
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

  async function handleVerComprovante(paymentId: string) {
    const r = await getComprovante(paymentId);
    if (r) window.open(r.dataUrl, '_blank');
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
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isEntrada ? 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}`}>
            {isEntrada ? 'Vínculo de Entrada (você presta o serviço)' : 'Vínculo de Saída (você contrata)'}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
            {c.status}
          </span>
          {c.linkedOnPlatform && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3 py-1 text-xs font-bold">
              <Link2 className="h-3 w-3" /> Sincronizado com {detail.mirrorPartyName ?? 'a contraparte'} na Hexxa
            </span>
          )}
        </div>

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
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#1E3328] dark:text-[#DFFFAE]">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Data de assinatura</p>
              {editingSigning ? (
                <input
                  type="date"
                  value={signingInput}
                  onChange={(e) => setSigningInput(e.target.value)}
                  className="mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-2.5 py-1.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]"
                />
              ) : (
                <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                  {c.signingDate ? fmtDate(c.signingDate) : 'Ainda não assinado'}
                </p>
              )}
            </div>
          </div>
          {editingSigning ? (
            <div className="flex gap-2">
              <button type="button" onClick={handleSalvarAssinatura} disabled={busy} className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
              </button>
              <button type="button" onClick={() => { setEditingSigning(false); setSigningInput(c.signingDate ?? ''); }} className="rounded-full border border-black/10 dark:border-white/10 px-4 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditingSigning(true)} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
              <Pencil className="h-3.5 w-3.5" /> {c.signingDate ? 'Editar' : 'Registrar'}
            </button>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/5 dark:border-white/10">
          {isEntrada && (
            <>
              <button type="button" onClick={() => setShowNfse(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] hover:bg-[#2F4A3C] px-3.5 py-1.5 text-xs font-bold mt-3">
                <FileText className="h-3.5 w-3.5" /> Marcar NFSe
              </button>
              <button type="button" onClick={() => setShowPix(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] px-3.5 py-1.5 text-xs font-bold mt-3">
                <QrCode className="h-3.5 w-3.5" /> Cobrar Pix
              </button>
            </>
          )}
          <button type="button" onClick={() => setShowReajuste(true)} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 mt-3">
            <Percent className="h-3.5 w-3.5" /> Reajustar %
          </button>
          <button type="button" onClick={handleRenovar} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 disabled:opacity-50 mt-3">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Renovar (+12m)
          </button>
          {c.status === 'ATIVO' && (
            <button type="button" onClick={handleCancelar} disabled={busy} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50 mt-3">
              Cancelar Vínculo
            </button>
          )}
        </div>
      </div>

      {/* Histórico de pagamentos */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-sm overflow-hidden">
        <div className="p-5 border-b border-black/5 dark:border-white/10 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          <h2 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Histórico de Pagamentos</h2>
        </div>
        {detail.payments.length === 0 ? (
          <p className="py-12 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nenhum lançamento gerado ainda para este vínculo.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {detail.payments.map((p) => {
              const st = PAYMENT_STATUS_CFG[p.status] ?? PAYMENT_STATUS_CFG.PENDING!;
              const StIcon = st.icon;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{p.description}</p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                      Vence {fmtDate(p.dueDate)}{p.paidAt ? ` · pago em ${fmtDate(p.paidAt)}` : ''}
                    </p>
                  </div>
                  <span className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(p.amount)}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>
                    <StIcon className="h-3 w-3" /> {st.label}
                  </span>
                  {p.hasReceipt && (
                    <button
                      type="button"
                      onClick={() => handleVerComprovante(p.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-2.5 py-0.5 text-[11px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]"
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
      {showNfse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Marcar NFSe como Emitida
              </h3>
              <button onClick={() => setShowNfse(false)} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
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
              className="w-full rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
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
          <div className="w-full max-w-md rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                <Percent className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Reajustar Valor do Vínculo
              </h3>
              <button onClick={() => setShowReajuste(false)} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
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
              className="w-full rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
            >
              {busy ? 'Aplicando...' : 'Aplicar Reajuste'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
