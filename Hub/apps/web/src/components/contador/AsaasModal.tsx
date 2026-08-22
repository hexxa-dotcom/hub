'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Spinner, CheckCircle, Warning, ArrowSquareOut, ArrowsClockwise, Trash, Copy, QrCode } from '@phosphor-icons/react';
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
  ACTIVE: { label: 'Ativa', cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  INACTIVE: { label: 'Inativa', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800' },
  EXPIRED: { label: 'Expirada', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const STATUS_PAY: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'text-yellow-600' },
  RECEIVED: { label: 'Recebido', cls: 'text-green-600' },
  CONFIRMED: { label: 'Confirmado', cls: 'text-green-600' },
  OVERDUE: { label: 'Vencido', cls: 'text-red-600' },
  REFUNDED: { label: 'Estornado', cls: 'text-slate-500' },
  CANCELED: { label: 'Cancelado', cls: 'text-slate-400' },
};

const fi = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

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
      // 1. Criar / buscar customer
      const custRes = await fetch('/api/asaas/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cliente.razao,
          cpfCnpj: cliente.cnpj,
          email: cliente.email,
          phone: cliente.telefone,
          externalReference: cliente.id,
        }),
      });
      const custData = await custRes.json();
      if (!custRes.ok) throw new Error(custData.error ?? 'Erro ao criar customer');
      const customerId: string = custData.customer.id;

      // 2. Criar assinatura
      const subRes = await fetch('/api/asaas/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          plano: cliente.plano,
          billingType,
          clienteId: cliente.id,
        }),
      });
      const subData = await subRes.json();
      if (!subRes.ok) throw new Error(subData.error ?? 'Erro ao criar assinatura');

      onLinked(customerId, subData.subscription.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50 space-y-2">
        <Row label="Empresa" value={cliente.razao} />
        <Row label="CNPJ" value={cliente.cnpj} />
        <Row label="E-mail" value={cliente.email} />
        <Row label="Plano" value={cliente.plano} />
        <Row label="Valor mensal" value={BRL.format({ 'Início': 149.9, 'Crescimento': 299.9, 'Escala': 499.9 }[cliente.plano] ?? 0)} />
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Forma de pagamento preferida</p>
        <div className="grid grid-cols-3 gap-2">
          {(['PIX', 'BOLETO', 'CREDIT_CARD'] as BillingType[]).map(bt => (
            <button key={bt} type="button" onClick={() => setBillingType(bt)}
              className={`rounded-xl py-2 text-xs font-medium transition-colors ${billingType === bt ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
              {bt === 'PIX' ? '⚡ PIX' : bt === 'BOLETO' ? '📄 Boleto' : '💳 Cartão'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">O cliente pode alterar antes de pagar.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
          <Warning className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <button onClick={vincular} disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60 transition-colors">
        {loading ? <Spinner className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
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
  const [payments, setPayments] = useState<AsaasPayment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [newPlano, setNewPlano] = useState(cliente.plano);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/asaas/subscriptions/${subscriptionId}?payments=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar');
      setSub(data.subscription);
      setPayments(data.payments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  async function cancelar() {
    if (!confirm('Confirma o cancelamento da assinatura?')) return;
    setCanceling(true);
    try {
      await fetch(`/api/asaas/subscriptions/${subscriptionId}`, { method: 'DELETE' });
      onCanceled();
    } catch {
      setError('Erro ao cancelar');
    } finally {
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

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  // Auto-load ao montar
  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Spinner className="h-6 w-6 animate-spin text-brand-500" />
        <p className="text-sm text-slate-500">Carregando assinatura…</p>
      </div>
    );
  }

  if (!sub && error) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
          <Warning className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
        <button onClick={load} className="text-sm text-brand-600 hover:underline">Tentar novamente</button>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-slate-500">ID da assinatura: <code className="font-mono text-xs bg-slate-100 px-1 rounded">{subscriptionId}</code></p>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <ArrowsClockwise className="h-4 w-4" /> Carregar dados
        </button>
      </div>
    );
  }

  const stSub = (STATUS_SUB[sub.status] ?? STATUS_SUB.INACTIVE)!;

  return (
    <div className="space-y-4">
      {/* Status da assinatura */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
        <div>
          <p className="text-xs text-slate-400">Assinatura Asaas</p>
          <p className="font-mono text-xs text-slate-600 dark:text-slate-400">{sub.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stSub.cls}`}>{stSub.label}</span>
          <button onClick={load} title="Atualizar" className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
            <ArrowsClockwise className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
        <Row label="Plano" value={sub.description.replace('Hexx Hub Digital — ', '')} />
        <Row label="Valor" value={BRL.format(sub.value)} />
        <Row label="Forma de pag." value={BILLING_LABELS[sub.billingType]} />
        <Row label="Próximo venc." value={fmtDate(sub.nextDueDate)} />
      </div>

      {/* Trocar plano */}
      {changingPlan ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Selecionar novo plano</p>
          <div className="grid grid-cols-3 gap-2">
            {['Início', 'Crescimento', 'Escala'].map(p => (
              <button key={p} type="button" onClick={() => setNewPlano(p)}
                className={`rounded-xl py-2 text-xs font-medium transition-colors ${newPlano === p ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={trocarPlano}
              className="flex-1 rounded-xl bg-brand-500 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors">
              Confirmar troca
            </button>
            <button onClick={() => setChangingPlan(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setChangingPlan(true)}
          className="w-full rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 transition-colors">
          Trocar plano
        </button>
      )}

      {/* Cobranças */}
      {payments && payments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Últimas cobranças</p>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
            {payments.slice(0, 6).map(pay => {
              const stPay = STATUS_PAY[pay.status] ?? { label: pay.status, cls: 'text-slate-500' };
              const link = pay.invoiceUrl ?? pay.bankSlipUrl;
              return (
                <div key={pay.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className={`text-xs font-medium ${stPay.cls}`}>{stPay.label}</p>
                    <p className="text-[11px] text-slate-400">Venc. {fmtDate(pay.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{BRL.format(pay.netValue)}</p>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800 transition-colors">
                        <ArrowSquareOut className="h-3.5 w-3.5" />
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
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
          <Warning className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Cancelar */}
      <button onClick={cancelar} disabled={canceling}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-400 transition-colors">
        {canceling ? <Spinner className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
        {canceling ? 'Cancelando…' : 'Cancelar assinatura'}
      </button>
    </div>
  );
}

// ── Sucesso ───────────────────────────────────────────────────────────────────

function StepSucesso({ subscriptionId }: { subscriptionId: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <CheckCircle className="h-12 w-12 text-green-500" />
      <div>
        <p className="font-semibold text-slate-900 dark:text-white">Assinatura criada com sucesso!</p>
        <p className="mt-1 text-sm text-slate-500">
          O cliente receberá o link de pagamento por e-mail.
        </p>
        <p className="mt-2 font-mono text-xs text-slate-400">{subscriptionId}</p>
      </div>
    </div>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/40 backdrop-blur-sm">
      <div className="my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          </div>
          <button onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors">
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
