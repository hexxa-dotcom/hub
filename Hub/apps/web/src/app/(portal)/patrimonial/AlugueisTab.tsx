'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  X,
  Loader2,
  Home,
  Percent,
  Ban,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Paperclip,
  CalendarClock,
} from 'lucide-react';
import type { PropertyRow, LeaseRow, RentPaymentRow } from './actions';
import { createLeaseAction, reajustarLeaseAction, encerrarLeaseAction, marcarAluguelPagoAction, getRentPaymentsAction, getLeasePdfAction } from './actions';
import { getComprovante } from '../meu-negocio/hub-financeiro/actions';
import { impostoAluguel, depreciacaoAnual } from './lib';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const YEAR = new Date().getFullYear();

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Próximo aniversário do reajuste (12 meses após adjustmentAnchor, avançado até ser futuro). */
function proximoReajuste(anchor: string) {
  const d = new Date(anchor + 'T12:00:00');
  const hoje = new Date();
  while (d <= hoje) d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0]!;
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  PENDING: { label: 'Em aberto', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', icon: Clock },
  PAID: { label: 'Recebido', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', icon: CheckCircle2 },
  OVERDUE: { label: 'Vencido', cls: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300', icon: AlertTriangle },
  CANCELED: { label: 'Cancelado', cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]', icon: XCircle },
};

const LEASE_STATUS_LABEL: Record<LeaseRow['status'], string> = {
  DRAFT: 'Rascunho',
  PENDING_SIGNATURE: 'Aguardando Assinatura',
  ACTIVE: 'Ativo',
  ENDED: 'Encerrado',
  CANCELED: 'Cancelado',
};

const LEASE_STATUS_CLASS: Record<LeaseRow['status'], string> = {
  DRAFT: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]',
  PENDING_SIGNATURE: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  ENDED: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]',
  CANCELED: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]',
};

function NovoAluguelForm({ properties, onClose, onDone }: { properties: PropertyRow[]; onClose: () => void; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disponiveis = properties.filter((p) => !p.leaseId && p.status === 'AVAILABLE');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    const res = await createLeaseAction({
      propertyId: String(fd.get('propertyId') ?? ''),
      lesseeName: String(fd.get('lesseeName') ?? '').trim(),
      monthlyRent: Number(String(fd.get('monthlyRent') ?? '0').replace(',', '.')),
      indexType: (String(fd.get('indexType') ?? 'IPCA') as 'IPCA' | 'IGPM'),
      startDate: String(fd.get('startDate') ?? ''),
      endDate: String(fd.get('endDate') ?? '') || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    onDone();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 p-6 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Novo Contrato de Aluguel</p>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      {disponiveis.length === 0 ? (
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Todos os bens já têm um contrato ativo, ou você ainda não cadastrou nenhum bem. Cadastre um imóvel na aba "Gestão de Ativos" primeiro.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Imóvel *</label>
            <select name="propertyId" required className={`mt-1.5 ${field}`}>
              {disponiveis.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Locatário (quem está alugando) *</label>
            <input name="lesseeName" required placeholder="Nome ou razão social" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className={lbl}>Valor do Aluguel (R$/mês) *</label>
            <input name="monthlyRent" required inputMode="decimal" placeholder="0,00" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className={lbl}>Índice de Reajuste</label>
            <select name="indexType" className={`mt-1.5 ${field}`}>
              <option value="IPCA">IPCA</option>
              <option value="IGPM">IGP-M</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Início da Vigência *</label>
            <input name="startDate" required type="date" defaultValue={new Date().toISOString().split('T')[0]} className={`mt-1.5 ${field}`} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Fim da Vigência (opcional)</label>
            <input name="endDate" type="date" className={`mt-1.5 ${field}`} />
            <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Deixe em branco pra um contrato por prazo indeterminado — geramos 24 meses de lançamentos e renovamos conforme o tempo passa.</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}

      {disponiveis.length > 0 && (
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] transition-all hover:scale-105 disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar Contrato
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}

function LeaseCard({ lease, property, onChanged }: { lease: LeaseRow; property: PropertyRow | undefined; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [payments, setPayments] = useState<RentPaymentRow[] | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showReajuste, setShowReajuste] = useState(false);
  const [pct, setPct] = useState('5');
  const [busy, setBusy] = useState(false);

  const impostoMensal = impostoAluguel(lease.monthlyRent * 12) / 12;
  const depMensal = property ? depreciacaoAnual(property.acq, property.rate, YEAR - property.year) / 12 : 0;
  const disponivelCaixa = lease.monthlyRent - impostoMensal;
  const resultadoContabil = disponivelCaixa - depMensal;

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && payments === null) {
      setLoadingPayments(true);
      try {
        setPayments(await getRentPaymentsAction(lease.id));
      } finally {
        setLoadingPayments(false);
      }
    }
  }

  async function handleMarcarPago(entryId: string) {
    setBusy(true);
    try {
      await marcarAluguelPagoAction(entryId);
      setPayments(await getRentPaymentsAction(lease.id));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerComprovante(id: string) {
    const r = await getComprovante(id);
    if (r) window.open(r.dataUrl, '_blank');
  }

  async function handleReajustar() {
    const p = parseFloat(pct) || 0;
    if (p <= 0) return;
    setBusy(true);
    try {
      await reajustarLeaseAction(lease.id, p);
      setShowReajuste(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleEncerrar() {
    const msg = lease.status === 'PENDING_SIGNATURE'
      ? 'Cancelar este contrato antes da assinatura?'
      : 'Encerrar este contrato de aluguel? Os lançamentos futuros ainda pendentes serão cancelados.';
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await encerrarLeaseAction(lease.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerPdf() {
    const base64 = await getLeasePdfAction(lease.id);
    if (!base64) return;
    const win = window.open('', '_blank');
    if (win) win.location.href = `data:application/pdf;base64,${base64}`;
  }

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md overflow-hidden shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-1.5">
                <Home className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" /> {lease.propertyName}
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${LEASE_STATUS_CLASS[lease.status]}`}>
                {LEASE_STATUS_LABEL[lease.status]}
              </span>
            </div>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">
              Locatário: <strong>{lease.lesseeName}</strong> · Índice {lease.indexType === 'IPCA' ? 'IPCA' : 'IGP-M'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(lease.monthlyRent)}<span className="text-xs font-sans font-normal text-[#6E6A61] dark:text-[#A8A49C]">/mês</span></p>
            <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Vigência: {fmtDate(lease.startDate)} — {lease.endDate ? fmtDate(lease.endDate) : 'indeterminado'}</p>
          </div>
        </div>

        {/* Resultado do aluguel — imposto, depreciação, o que sobra */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Aluguel/mês</p>
            <p className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(lease.monthlyRent)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Imposto estimado</p>
            <p className="font-serif font-bold text-sm text-amber-700 dark:text-amber-400">− {BRL.format(impostoMensal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Disponível em caixa</p>
            <p className="font-serif font-bold text-sm text-emerald-700 dark:text-emerald-400">{BRL.format(disponivelCaixa)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Depreciação/mês</p>
            <p className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(depMensal)}</p>
          </div>
        </div>
        <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] -mt-2">
          Resultado contábil após depreciação (não é saída de caixa): <strong className="text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(resultadoContabil)}</strong>/mês.
          Imposto pelo Lucro Presumido (base 32%, IRPJ+CSLL 24%).
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            <CalendarClock className="h-3.5 w-3.5" /> Próximo reajuste: {fmtDate(proximoReajuste(lease.adjustmentAnchor))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lease.hasPdf && (
              <button type="button" onClick={handleVerPdf} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
                Ver PDF
              </button>
            )}
            {lease.status === 'ACTIVE' && (
              <button type="button" onClick={() => setShowReajuste((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
                <Percent className="h-3.5 w-3.5" /> Reajustar
              </button>
            )}
            {(lease.status === 'ACTIVE' || lease.status === 'PENDING_SIGNATURE') && (
              <button type="button" onClick={handleEncerrar} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                <Ban className="h-3.5 w-3.5" /> {lease.status === 'PENDING_SIGNATURE' ? 'Cancelar' : 'Encerrar'}
              </button>
            )}
          </div>
        </div>

        {showReajuste && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/70 dark:bg-black/20 p-3">
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Reajuste (%)</label>
            <input type="number" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} className="w-24 rounded-xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-2.5 py-1.5 text-sm outline-none focus:border-[#2F4A3C]" />
            <button type="button" onClick={handleReajustar} disabled={busy} className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}
            </button>
          </div>
        )}

        <button type="button" onClick={toggleExpand} className="flex w-full items-center justify-between text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline">
          Histórico de recebimentos
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/10">
          {loadingPayments ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : payments && payments.length > 0 ? (
            payments.map((p) => {
              const st = STATUS_CFG[p.status] ?? STATUS_CFG.PENDING!;
              const StIcon = st.icon;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">{p.description}</p>
                    <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Vence {fmtDate(p.dueDate)}{p.paidAt ? ` · recebido em ${fmtDate(p.paidAt)}` : ''}</p>
                  </div>
                  <span className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(p.amount)}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>
                    <StIcon className="h-3 w-3" /> {st.label}
                  </span>
                  {p.hasReceipt && (
                    <button type="button" onClick={() => handleVerComprovante(p.id)} className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-2.5 py-0.5 text-[11px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]">
                      <Paperclip className="h-3 w-3" /> Comprovante
                    </button>
                  )}
                  {p.status === 'PENDING' && (
                    <button type="button" onClick={() => handleMarcarPago(p.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors disabled:opacity-50">
                      <CheckCircle2 className="h-3 w-3" /> Marcar recebido
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="py-8 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nenhum lançamento encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AlugueisTab({ properties, leases }: { properties: PropertyRow[]; leases: LeaseRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  function refresh() {
    router.refresh();
  }

  const ativos = leases.filter((l) => l.status === 'ACTIVE');
  const rendaMensal = ativos.reduce((s, l) => s + l.monthlyRent, 0);
  const impostoAnual = impostoAluguel(rendaMensal * 12);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-black/5 bg-[#1E3328] dark:bg-[#1A201C] p-6 text-[#FEFDF3] shadow-md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]">Renda de Aluguel (mensal)</h3>
          <p className="mt-2 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#DFFFAE]">{BRL.format(rendaMensal)}</p>
          <p className="mt-1 text-[11px] text-[#DFFFAE]/70">{ativos.length} contrato(s) ativo(s)</p>
        </div>
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Imposto Estimado (a.a.)</h3>
          <p className="mt-2 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400">{BRL.format(impostoAnual)}</p>
          <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Lucro Presumido — 7,68% sobre a receita bruta</p>
        </div>
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Disponível em Caixa (a.a.)</h3>
          <p className="mt-2 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">{BRL.format(rendaMensal * 12 - impostoAnual)}</p>
          <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Base pro simulador de dividendos</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Contratos de Aluguel</h2>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
          <Plus className="h-4 w-4" /> Novo Contrato
        </button>
      </div>

      {showForm && <NovoAluguelForm properties={properties} onClose={() => setShowForm(false)} onDone={refresh} />}

      <div className="space-y-4">
        {leases.length === 0 ? (
          <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12 text-center">Nenhum contrato de aluguel cadastrado ainda.</p>
        ) : (
          leases.map((l) => (
            <LeaseCard key={l.id} lease={l} property={properties.find((p) => p.id === l.propertyId)} onChanged={refresh} />
          ))
        )}
      </div>
    </div>
  );
}
