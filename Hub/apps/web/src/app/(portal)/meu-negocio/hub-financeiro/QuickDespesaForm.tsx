'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, TrendingDown } from 'lucide-react';
import { createLancamento } from './actions';

const field =
  'mt-1 w-full rounded-2xl bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-caption font-bold text-ink-soft uppercase tracking-wider';

export function QuickDespesaForm({ onDone }: { onDone: () => void }) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim()) {
      setFeedback({ ok: false, msg: 'Descreva a despesa.' });
      return;
    }
    if (!v || v <= 0) {
      setFeedback({ ok: false, msg: 'Informe um valor válido.' });
      return;
    }
    startTransition(async () => {
      try {
        await createLancamento({ tipo: 'PAGAR', descricao: descricao.trim(), valor: v, vencimento });
        setFeedback({ ok: true, msg: 'Despesa lançada com sucesso!' });
        setDone(true);
      } catch (err) {
        setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Erro ao lançar despesa.' });
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-card shadow-(--elev-1) p-5 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-hexxa-green dark:text-hexxa-lime mb-2" />
          <p className="text-sm font-bold text-ink">Despesa lançada com sucesso!</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDescricao('');
              setValor('');
              setFeedback(null);
              setDone(false);
            }}
            className="flex-1 rounded-full bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) px-4 py-2.5 text-xs font-bold text-ink transition-all"
          >
            Lançar outra
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-4 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={lbl}>Descrição *</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Aluguel do escritório"
          className={field}
        />
      </div>

      <div>
        <label className={lbl}>Valor (R$) *</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className={`${field} font-serif text-lg font-bold tabular text-hexxa-forest dark:text-hexxa-lime`}
        />
      </div>

      <div>
        <label className={lbl}>Vencimento *</label>
        <input
          type="date"
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
          className={field}
        />
      </div>

      {feedback && !feedback.ok && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 shadow-(--elev-inset) px-4 py-3 text-xs font-bold text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {feedback.msg}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-6 py-3 text-sm font-bold text-hexxa-lime shadow-(--elev-1) transition-transform hover:scale-[1.01] disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingDown className="h-4 w-4" />}
        {pending ? 'Lançando…' : 'Lançar Despesa'}
      </button>
    </form>
  );
}
