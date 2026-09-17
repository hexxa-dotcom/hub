'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { evaluatePartnerDistributionAction, confirmDistributionAction } from '@/lib/server/profit-distribution';

type PartnerOption = { id: string; nome: string; participacao: number };

type LockResult = { passed: boolean; message?: string };
type EvalResult = {
  isApproved: boolean;
  approvedAmount: number;
  blockedAmount: number;
  locks: Record<string, LockResult>;
};

const LOCK_LABELS: Record<string, string> = {
  taxDebts: 'Débitos fiscais em aberto',
  mutualContracts: 'Contratos de mútuo (DDL)',
  realTimeDre: 'Limite de DRE em tempo real',
  accumulatedLosses: 'Prejuízos acumulados',
  unpaidCapital: 'Capital social integralizado',
  disproportionateDistribution: 'Distribuição proporcional à cota',
};

const field =
  'mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-xs font-bold text-ink-soft uppercase tracking-wide';

/**
 * Formulário único de "pedir distribuição de lucro", usado tanto em Sócios
 * (lucro de serviços) quanto em Patrimonial (lucro de aluguéis) — o cálculo
 * de quanto lucro existe já vem diferente (por company.type) de
 * getAvailableProfitAction(), mas a validação (6 travas legais) e o
 * registro são o mesmo motor pros dois. Ver lib/server/profit-distribution.ts.
 */
export function DistributionRequestForm({
  partners,
  availableToDistribute,
  onConfirmed,
}: {
  partners: PartnerOption[];
  availableToDistribute: number;
  onConfirmed: () => void;
}) {
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const value = Number(amount.replace(',', '.'));
    if (!partnerId) {
      setError('Selecione um sócio.');
      return;
    }
    if (!(value > 0)) {
      setError('Informe um valor maior que zero.');
      return;
    }
    setEvaluating(true);
    try {
      const res = await evaluatePartnerDistributionAction(partnerId, value);
      if ('error' in res) {
        setError(res.error);
      } else {
        setResult(res as EvalResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao avaliar.');
    } finally {
      setEvaluating(false);
    }
  }

  async function handleConfirm() {
    if (!result || result.approvedAmount <= 0) return;
    setConfirming(true);
    try {
      const res = await confirmDistributionAction({ partnerId, amount: result.approvedAmount, notes: notes || undefined });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setResult(null);
      setAmount('');
      setNotes('');
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Card level={1} className="p-6 sm:p-8 space-y-5 card-finish">
      <div>
        <h3 className="font-serif font-bold text-base text-ink">Pedir distribuição de lucro</h3>
        <p className="mt-1 text-xs text-ink-soft">
          Disponível pra distribuir agora: <strong className="font-serif tabular text-ink">{availableToDistribute.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>.
          A validação abaixo checa as 6 travas legais (débito fiscal, capital social, prejuízo acumulado, limite por sócio, mútuo, proporcionalidade) antes de liberar.
        </p>
      </div>

      <form onSubmit={handleEvaluate} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>Sócio</label>
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={field}>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.nome} ({p.participacao}%)</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Valor solicitado (R$)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Observação (opcional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: adiantamento de lucro do 2º trimestre" className={field} />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={evaluating || partners.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 px-6 py-2.5 text-xs font-bold shadow-(--elev-1) transition-all disabled:opacity-60"
          >
            {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {evaluating ? 'Avaliando…' : 'Avaliar pedido'}
          </button>
        </div>
      </form>

      {error && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-800 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="space-y-3 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-5">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-bold ${result.isApproved ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {result.isApproved ? 'Aprovado' : result.approvedAmount > 0 ? 'Aprovado parcialmente' : 'Bloqueado'}
            </p>
            <p className="text-sm font-serif tabular font-bold text-ink">
              {result.approvedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              {result.blockedAmount > 0 && (
                <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  (bloqueado: {result.blockedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                </span>
              )}
            </p>
          </div>

          <ul className="space-y-1.5">
            {Object.entries(result.locks).map(([key, lock]) => (
              <li key={key} className="flex items-start gap-2 text-xs">
                {lock.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-600" />
                )}
                <div>
                  <span className={`font-bold ${lock.passed ? 'text-ink' : 'text-red-700 dark:text-red-400'}`}>
                    {LOCK_LABELS[key] ?? key}
                  </span>
                  {lock.message && <p className="mt-0.5 text-ink-soft">{lock.message}</p>}
                </div>
              </li>
            ))}
          </ul>

          {result.approvedAmount > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 px-6 py-2.5 text-xs font-bold shadow-(--elev-1) transition-all disabled:opacity-60"
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {confirming ? 'Confirmando…' : `Confirmar distribuição de ${result.approvedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
