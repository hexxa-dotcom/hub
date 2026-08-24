'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  ShoppingBag,
  QrCode,
  CreditCard,
  Barcode,
  Banknote,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  listSalesAction,
  listCustomersForSaleAction,
  createSaleAction,
  deleteSaleAction,
  type SaleRow,
  type PaymentMethod,
} from './actions';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'PIX', label: 'Pix', icon: QrCode },
  { value: 'CARTAO', label: 'Cartão', icon: CreditCard },
  { value: 'BOLETO', label: 'Boleto', icon: Barcode },
  { value: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { value: 'OUTRO', label: 'Outro', icon: MoreHorizontal },
];

function methodMeta(m: PaymentMethod) {
  return PAYMENT_METHODS.find((p) => p.value === m) ?? PAYMENT_METHODS[4]!;
}

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] px-3.5 py-2 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';

function SaleForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listCustomersForSaleAction().then(setCustomers).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount || !saleDate) {
      setErr('Preencha descrição, valor e data.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await createSaleAction({
        customerId: customerId || null,
        description,
        amount: parseFloat(amount.replace(',', '.')),
        paymentMethod,
        saleDate,
        received,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        setErr(res.message);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr('Falha ao salvar no banco de dados.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-[#DFFFAE] bg-[#EFFFD6]/50 dark:bg-[#1E3328]/30 p-5 space-y-4 shadow-sm animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#1E3328] dark:text-[#DFFFAE] flex items-center gap-1.5 font-serif">
          <ShoppingBag className="h-4 w-4" />
          Nova Venda (sem nota fiscal)
        </p>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Descrição *</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Venda de produto no balcão, Serviço avulso…"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Valor (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Data da venda *</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Cliente</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-1 ${field}`}>
            <option value="">Sem cliente vinculado</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Forma de pagamento</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={`mt-1 ${field}`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
          <input
            id="received"
            type="checkbox"
            checked={received}
            onChange={(e) => setReceived(e.target.checked)}
            className="h-4 w-4 rounded border-black/20 text-[#2F4A3C] focus:ring-[#DFFFAE]"
          />
          <label htmlFor="received" className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">
            Valor já recebido nesta data (desmarque se for a prazo)
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Observações</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${field}`} />
        </div>
      </div>

      {err && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-100 dark:bg-red-950/60 p-3 text-xs font-bold text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {err}
        </p>
      )}

      <div className="flex gap-2.5 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Registrar Venda
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function VendasView() {
  const [data, setData] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pixSale, setPixSale] = useState<SaleRow | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setData(await listSalesAction());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalMes = useMemo(() => {
    const period = new Date().toISOString().slice(0, 7);
    return data.filter((s) => s.saleDate.startsWith(period)).reduce((sum, s) => sum + s.amount, 0);
  }, [data]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteSaleAction(id);
      await load(true);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#1E3328] text-[#FEFDF3] p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]/80">Vendas Registradas Este Mês</p>
          <p className="mt-2 font-serif text-2xl font-bold text-[#DFFFAE] tabular">{fmt(totalMes)}</p>
        </div>
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">O que é isso</p>
          <p className="mt-2 text-sm text-[#231F20] dark:text-[#FEFDF3]">
            Vendas sem nota fiscal (produto, serviço avulso, venda de balcão). Cada venda vira automaticamente um
            lançamento em <strong>Financeiro → Receber</strong> — é a segunda fonte de faturamento do sistema, ao lado da Nota Fiscal.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          Nova venda
        </button>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing || loading}
          title="Atualizar"
          className="rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-2.5 text-[#6E6A61] hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {showForm && <SaleForm onSaved={() => load(true)} onClose={() => setShowForm(false)} />}

      {loading ? (
        <div className="flex items-center justify-center gap-2.5 py-16 text-[#6E6A61]">
          <Loader2 className="h-5 w-5 animate-spin text-[#2F4A3C]" />
          <span className="text-sm font-bold">Carregando vendas…</span>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-12 text-center text-[#6E6A61] dark:text-[#A8A49C]">
          <ShoppingBag className="h-8 w-8 mx-auto opacity-30 mb-2" />
          <p className="text-sm font-semibold">Nenhuma venda registrada ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] shadow-sm">
          <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/20 px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] sm:grid">
            <span>Descrição</span>
            <span className="w-28 text-right">Data</span>
            <span className="w-32 text-right">Valor</span>
            <span className="w-28 text-center">Pagamento</span>
            <span className="w-16 text-center">Ações</span>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {data.map((s) => {
              const meta = methodMeta(s.paymentMethod);
              const Icon = meta.icon;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 sm:px-5 sm:grid-cols-[1fr_auto_auto_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{s.description}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                      {s.customerName && <span>{s.customerName}</span>}
                      <span className="sm:hidden">{fmtDate(s.saleDate)} · {fmt(s.amount)}</span>
                    </div>
                  </div>
                  <span className="hidden w-28 text-right text-sm text-[#6E6A61] dark:text-[#A8A49C] sm:block">
                    {fmtDate(s.saleDate)}
                  </span>
                  <span className="hidden w-32 text-right font-serif text-base font-bold tabular text-[#2F4A3C] dark:text-[#DFFFAE] sm:block">
                    {fmt(s.amount)}
                  </span>
                  <span className="hidden w-28 items-center justify-center gap-1 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] sm:flex">
                    <Icon className="h-3.5 w-3.5" /> {meta.label}
                    {s.received ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" aria-label="Recebido" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-600" aria-label="A receber" />
                    )}
                  </span>
                  <div className="flex w-16 items-center justify-end gap-1 sm:justify-center">
                    {!s.received && s.financialEntryId && (
                      <button
                        type="button"
                        title="Gerar Cobrança Pix"
                        onClick={() => setPixSale(s)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-2 py-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]"
                      >
                        <QrCode className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="rounded-full p-2 text-[#6E6A61] hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-40"
                    >
                      {deleting === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pixSale && (
        <GeneratePixModal
          isOpen={true}
          onClose={() => setPixSale(null)}
          initialValue={pixSale.amount}
          initialDescription={pixSale.description}
          initialCustomerName={pixSale.customerName ?? ''}
          financialEntryId={pixSale.financialEntryId ?? undefined}
        />
      )}
    </div>
  );
}
