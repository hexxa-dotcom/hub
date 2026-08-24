'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Loader2, CheckCircle2, AlertTriangle, ExternalLink, RotateCw, Trash2, Copy, QrCode } from 'lucide-react';
import type { AsaasSubscription, AsaasPayment, BillingType } from '@/lib/asaas';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Cliente = {
  id: string;
  razao: string;
  cnpj: string;
  email: string;
  telefone: string;
  plano: string;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
};

type Props = {
  cliente: Cliente;
  onClose: () => void;
  onLinked: (customerId: string, subscriptionId: string) => void;
  onCanceled: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const BILLING_LABELS: Record<BillingType, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto bancário',
  CREDIT_CARD: 'Cartão de crédito',
  UNDEFINED: 'Não definido',
};

const STATUS_SUB: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Ativa', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  INACTIVE: { label: 'Inativa', cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]' },
  EXPIRED: { label: 'Expirada', cls: 'bg-red-500/10 text-red-700 dark:text-red-400' },
};

const STATUS_PAY: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'text-amber-600 dark:text-amber-400' },
  RECEIVED: { label: 'Recebido', cls: 'text-emerald-600 dark:text-emerald-400' },
  CONFIRMED: { label: 'Confirmado', cls: 'text-emerald-600 dark:text-emerald-400' },
  OVERDUE: { label: 'Vencido', cls: 'text-red-600 dark:text-red-400' },
  REFUNDED: { label: 'Estornado', cls: 'text-[#6E6A61] dark:text-[#A8A49C]' },
  CANCELED: { label: 'Cancelado', cls: 'text-[#6E6A61] dark:text-[#A8A49C]' },
};

const fi = 'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-3.5 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none transition-colors focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]';

function fmtDate(iso: string) {
  return iso?.split('-').reverse().join('/') ?? '—';
}

// ── Passo 1: Vincular cliente ─────────────────────────────────────────────────

function StepVincular({
  cliente,
  onLinked,
}: {
  cliente: Cliente;
  onLinked: (customerId: string, subscriptionId: string) => void;
}) {
  const [billingType, setBillingType] = useState<BillingType>('PIX');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/asaas/customers/${cliente.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLinked(data.customerId, data.subscriptionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao vincular cobrança');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 border border-black/5 dark:border-white/10 p-4">
        <Row label="Empresa" value={cliente.razao} />
        <Row label="CNPJ" value={cliente.cnpj} />
        <Row label="E-mail" value={cliente.email} />
        <Row label="Plano" value={cliente.plano} />
      </div>

      <div>
        <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Forma de pagamento padrão</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(['PIX', 'BOLETO', 'CREDIT_CARD'] as BillingType[]).map(bt => (
            <button
              key={bt}
              type="button"
              onClick={() => setBillingType(bt)}
              className={`rounded-full py-2 text-xs font-bold transition-all ${
                billingType === bt
                  ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
                  : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
              }`}
            >
              {bt === 'PIX' ? '⚡ PIX' : bt === 'BOLETO' ? '📄 Boleto' : '💳 Cartão'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">O cliente pode alterar antes de pagar.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-xs font-bold text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <button onClick={vincular} disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-3 text-xs font-bold text-[#DFFFAE] shadow-sm disabled:opacity-60 transition-all hover:scale-102">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {loading ? 'Criando assinatura…' : 'Vincular e criar assinatura'}
      </button>
    </div>
  );
}

// ── Passo 2: Assinatura ativa ─────────────────────────────────────────────────

function StepAssinatura({
  cliente,
  subscriptionId,
  onCanceled,
}: {
  cliente: Cliente;
  subscriptionId: string;
  onCanceled: () => void;
}) {
  const [sub, setSub] = useState<AsaasSubscription | null>(null);
  const [payments, setPayments] = useState<AsaasPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState(false);
  const [newPlano, setNewPlano] = useState(cliente.plano);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/asaas/subscriptions/${subscriptionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSub(data.subscription);
      setPayments(data.payments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar assinatura');
    } finally {
      setLoading(false);
    }
  }

  async function cancelar() {
    if (!confirm('Deseja realmente cancelar esta assinatura no Asaas? As próximas cobranças serão interrompidas.')) return;
    setCanceling(true);
    try {
      const res = await fetch(`/api/asaas/subscriptions/${subscriptionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCanceled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao cancelar assinatura');
      setCanceling(false);
    }
  }

  async function trocarPlano() {
    try {
      const res = await fetch(`/api/asaas/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: newPlano }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSub(data.subscription);
      setChangingPlan(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao trocar plano');
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-[#2F4A3C] dark:text-[#DFFFAE]" />
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Carregando assinatura…</p>
      </div>
    );
  }

  if (!sub && error) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-xs font-bold text-red-700 dark:text-red-400">{error}</p>
        </div>
        <button onClick={load} className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">Tentar novamente</button>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">ID da assinatura: <code className="font-mono text-xs bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md">{subscriptionId}</code></p>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE]">
          <RotateCw className="h-4 w-4" /> Carregar dados
        </button>
      </div>
    );
  }

  const stSub = (STATUS_SUB[sub.status] ?? STATUS_SUB.INACTIVE)!;

  return (
    <div className="space-y-4">
      {/* Status da assinatura */}
      <div className="flex items-center justify-between rounded-2xl bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 border border-black/5 dark:border-white/10 px-4 py-3">
        <div>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Assinatura Asaas</p>
          <p className="font-mono text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">{sub.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stSub.cls}`}>{stSub.label}</span>
          <button onClick={load} title="Atualizar" className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 border border-black/5 dark:border-white/10 p-4">
        <Row label="Plano" value={sub.description.replace('Hexx Hub Digital — ', '')} />
        <Row label="Valor" value={BRL.format(sub.value)} />
        <Row label="Forma de pag." value={BILLING_LABELS[sub.billingType]} />
        <Row label="Próximo venc." value={fmtDate(sub.nextDueDate)} />
      </div>

      {/* Trocar plano */}
      {changingPlan ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Selecionar novo plano</p>
          <div className="grid grid-cols-3 gap-2">
            {['Início', 'Crescimento', 'Escala'].map(p => (
              <button key={p} type="button" onClick={() => setNewPlano(p)}
                className={`rounded-full py-2 text-xs font-bold transition-all ${newPlano === p ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328]' : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={trocarPlano}
              className="flex-1 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-2.5 text-xs font-bold text-[#DFFFAE] transition-all">
              Confirmar troca
            </button>
            <button onClick={() => setChangingPlan(false)}
              className="flex-1 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setChangingPlan(true)}
          className="w-full rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 py-2.5 text-xs font-bold text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#FEFDF3] hover:bg-black/5 transition-all">
          Trocar plano
        </button>
      )}

      {/* Cobranças */}
      {payments && payments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Últimas cobranças</p>
          <div className="divide-y divide-black/5 dark:divide-white/10 rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] overflow-hidden">
            {payments.slice(0, 6).map(pay => {
              const stPay = STATUS_PAY[pay.status] ?? { label: pay.status, cls: 'text-[#6E6A61]' };
              const link = pay.invoiceUrl ?? pay.bankSlipUrl;
              return (
                <div key={pay.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className={`text-xs font-bold ${stPay.cls}`}>{stPay.label}</p>
                    <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Venc. {fmtDate(pay.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(pay.netValue)}</p>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="rounded-full p-1.5 text-[#6E6A61] hover:text-[#2F4A3C] hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-xs font-bold text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Cancelar */}
      <button onClick={cancelar} disabled={canceling}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-red-500/30 py-2.5 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400 transition-colors">
        {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {canceling ? 'Cancelando…' : 'Cancelar assinatura'}
      </button>
    </div>
  );
}

// ── Sucesso ───────────────────────────────────────────────────────────────────

function StepSucesso({ subscriptionId }: { subscriptionId: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-600" />
      <div>
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Assinatura criada com sucesso!</p>
        <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          O cliente receberá o link de pagamento por e-mail.
        </p>
        <p className="mt-2 font-mono text-xs text-[#6E6A61] dark:text-[#A8A49C] bg-black/5 dark:bg-white/10 px-2 py-1 rounded-full">{subscriptionId}</p>
      </div>
    </div>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#6E6A61] dark:text-[#A8A49C]">{label}</span>
      <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{value}</span>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export function AsaasModal({ cliente, onClose, onLinked, onCanceled }: Props) {
  const jaVinculado = !!(cliente.asaasCustomerId && cliente.asaasSubscriptionId);
  const [newSubId, setNewSubId] = useState<string | null>(null);

  function handleLinked(customerId: string, subscriptionId: string) {
    setNewSubId(subscriptionId);
    onLinked(customerId, subscriptionId);
  }

  const title = jaVinculado ? 'Gerenciar cobrança' : 'Vincular cobrança Asaas';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/40 backdrop-blur-md">
      <div className="my-8 w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-black/5 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <CreditCard className="h-4 w-4" />
            </span>
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{title}</h2>
          </div>
          <button onClick={onClose}
            className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {newSubId ? (
          <StepSucesso subscriptionId={newSubId} />
        ) : jaVinculado ? (
          <StepAssinatura
            cliente={cliente}
            subscriptionId={cliente.asaasSubscriptionId!}
            onCanceled={onCanceled}
          />
        ) : (
          <StepVincular cliente={cliente} onLinked={handleLinked} />
        )}
      </div>
    </div>
  );
}
