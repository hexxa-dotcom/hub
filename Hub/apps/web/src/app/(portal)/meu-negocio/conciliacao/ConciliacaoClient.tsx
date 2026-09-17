'use client';

import { useState, useTransition } from 'react';
import {
  matchTransaction,
  ignoreTransaction,
  generateMockTransactions,
  suggestAiMatchesAction,
  applyAiMatchAction,
  applyAiNewEntryAction,
} from './actions';
import { Loader2, ArrowRightLeft, Check, X, RefreshCw, Plus, Sparkles } from 'lucide-react';


type Transaction = {
  id: string;
  postedAt: string;
  amount: number;
  description: string;
};

type Entry = {
  id: string;
  type: string;
  description: string;
  amount: number;
  dueDate: string;
};

type AiSuggestion = {
  transactionId: string;
  suggestedCategoryId: string;
  confidenceScore: number;
  action: 'MATCH_EXISTING' | 'CREATE_NEW';
  matchedEntryId?: string;
  justification: string;
};

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export function ConciliacaoClient({
  transactions,
  entries,
}: {
  transactions: Transaction[];
  entries: Entry[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, AiSuggestion>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function handleMatch(txId: string, entryId: string) {
    startTransition(async () => {
      try {
        const res = await matchTransaction(txId, entryId);
        if (!res.ok) {
          alert(res.message || 'Não foi possível conciliar — tipo ou valor divergente.');
          return;
        }
        alert('Conciliado com sucesso!');
        setSelectedTx(null);
      } catch (err) {
        alert('Erro ao conciliar.');
      }
    });
  }

  function handleIgnore(txId: string) {
    startTransition(async () => {
      try {
        await ignoreTransaction(txId);
        alert('Transação ignorada.');
        setSelectedTx(null);
      } catch (err) {
        alert('Erro ao ignorar.');
      }
    });
  }

  function handleMock() {
    startTransition(async () => {
      try {
        await generateMockTransactions();
        alert('Mock gerado!');
      } catch (err) {
        alert('Erro ao gerar mock.');
      }
    });
  }

  async function handleSuggestAi() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await suggestAiMatchesAction();
      if (!res.ok) {
        setAiError(res.message || 'Não foi possível consultar a IA.');
        return;
      }
      const byTx: Record<string, AiSuggestion> = {};
      for (const s of res.suggestions ?? []) byTx[s.transactionId] = s;
      setSuggestions(byTx);
    } catch {
      setAiError('Erro ao consultar a IA.');
    } finally {
      setAiLoading(false);
    }
  }

  function handleApplyAiMatch(suggestion: AiSuggestion) {
    if (!suggestion.matchedEntryId) return;
    startTransition(async () => {
      const res = await applyAiMatchAction(suggestion.transactionId, suggestion.matchedEntryId!, suggestion.suggestedCategoryId);
      if (!res.ok) {
        alert(res.message || 'Não foi possível aplicar a sugestão.');
        return;
      }
      setSuggestions((prev) => {
        const next = { ...prev };
        delete next[suggestion.transactionId];
        return next;
      });
      setSelectedTx(null);
    });
  }

  function handleApplyAiNewEntry(suggestion: AiSuggestion) {
    startTransition(async () => {
      const res = await applyAiNewEntryAction(suggestion.transactionId, suggestion.suggestedCategoryId);
      if (!res.ok) {
        alert(res.message || 'Não foi possível criar o lançamento.');
        return;
      }
      setSuggestions((prev) => {
        const next = { ...prev };
        delete next[suggestion.transactionId];
        return next;
      });
    });
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-black/5 dark:border-white/10 rounded-3xl bg-surface-card shadow-(--elev-1) card-finish mt-8">
        <ArrowRightLeft className="h-12 w-12 text-ink-soft opacity-30 mb-4" />
        <h3 className="font-serif text-xl font-bold text-ink mb-2">Tudo em dia!</h3>
        <p className="text-sm text-ink-soft max-w-md mb-6">
          Não há transações pendentes de conciliação. Quando você fizer upload do OFX ou integrar seu banco, elas aparecerão aqui.
        </p>
        <button
          onClick={handleMock}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold transition-all disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Gerar Dados de Teste
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6 animate-in fade-in">
      <div className="flex justify-end gap-2">
        <button
          onClick={handleSuggestAi}
          disabled={aiLoading}
          className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-4 py-2 text-xs font-bold transition-all disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Sugerir com IA
        </button>
        <button
          onClick={handleMock}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          + Dados
        </button>
      </div>

      {aiError && (
        <p className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400">
          {aiError}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
        {/* Lado Esquerdo: Extrato Bancário */}
        <div className="space-y-4">
          <h2 className="text-caption font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) text-xs">1</span>
            Extrato Bancário
          </h2>
          
          <div className="space-y-3">
            {transactions.map(tx => (
              <div 
                key={tx.id}
                onClick={() => setSelectedTx(tx.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedTx === tx.id 
                    ? 'border-hexxa-green dark:border-hexxa-lime bg-surface-card shadow-(--elev-inset)' 
                    : 'border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) card-finish hover:shadow-(--elev-2)'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-bold text-ink">{tx.description}</p>
                  <p className={`font-serif font-bold tabular ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-hexxa-green dark:text-hexxa-lime'}`}>
                    {fmt(tx.amount)}
                  </p>
                </div>
                <div className="flex justify-between items-center text-xs text-ink-soft">
                  <span className="tabular">{fmtDate(tx.postedAt)}</span>
                  {selectedTx === tx.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleIgnore(tx.id); }}
                      className="text-red-600 dark:text-red-400 font-bold hover:underline"
                    >
                      Ignorar
                    </button>
                  )}
                </div>

                {suggestions[tx.id] && (
                  <div className="mt-3 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-hexxa-green/20 p-3.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-hexxa-green dark:text-hexxa-lime">
                      <Sparkles className="h-3 w-3" /> Sugestão da IA
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">{suggestions[tx.id]!.justification}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const s = suggestions[tx.id]!;
                        s.action === 'MATCH_EXISTING' ? handleApplyAiMatch(s) : handleApplyAiNewEntry(s);
                      }}
                      disabled={isPending}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-3.5 py-1.5 text-[11px] font-bold transition-all disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      {suggestions[tx.id]!.action === 'MATCH_EXISTING' ? 'Conciliar com sugestão' : 'Criar lançamento categorizado'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Linha Divisória visual */}
        <div className="hidden lg:block absolute left-1/2 top-10 bottom-0 w-px bg-black/5 dark:bg-white/5 -translate-x-1/2">
           <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-card shadow-(--elev-1) p-2 rounded-full border border-black/5 dark:border-white/5">
             <ArrowRightLeft className="h-4 w-4 text-ink-soft opacity-50" />
           </div>
        </div>

        {/* Lado Direito: Sugestões de Match */}
        <div className="space-y-4">
          <h2 className="text-caption font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) text-xs">2</span>
            Encontrar Correspondência
          </h2>

          {!selectedTx ? (
            <div className="h-full min-h-[220px] flex items-center justify-center border border-dashed border-black/10 dark:border-white/10 rounded-3xl bg-surface-card/40">
              <p className="text-sm text-ink-soft text-center px-8">
                Selecione uma transação do lado esquerdo para ver as sugestões de lançamentos correspondentes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.length === 0 ? (
                <div className="p-6 text-center text-ink-soft bg-surface-card rounded-2xl border border-black/5 dark:border-white/10 shadow-(--elev-1)">
                  <p className="text-sm mb-4">Não há lançamentos pendentes no Hub.</p>
                  <button className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) px-4 py-2 text-xs font-bold hover:brightness-110">
                    <Plus className="h-3 w-3" /> Criar Lançamento a partir do Extrato
                  </button>
                </div>
              ) : (
                entries.map(entry => {
                  const tx = transactions.find(t => t.id === selectedTx)!;
                  const isSameSign = (tx.amount < 0 && entry.type === 'PAYABLE') || (tx.amount > 0 && entry.type === 'RECEIVABLE');
                  // Mostra todos, mas destacaria se fosse match exato
                  return (
                    <div 
                      key={entry.id}
                      className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) card-finish flex justify-between items-center group hover:border-hexxa-green/40 hover:shadow-(--elev-2) transition-all"
                    >
                      <div>
                        <p className="text-sm font-bold text-ink flex items-center gap-2">
                          {entry.description}
                          {!isSameSign && <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-normal">Tipo divergente</span>}
                        </p>
                        <p className="text-xs text-ink-soft mt-1">
                          Vencimento: <span className="tabular">{fmtDate(entry.dueDate)}</span> · {entry.type === 'PAYABLE' ? 'A Pagar' : 'A Receber'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-serif font-bold tabular ${entry.type === 'PAYABLE' ? 'text-red-600 dark:text-red-400' : 'text-hexxa-green dark:text-hexxa-lime'}`}>
                          {fmt(entry.amount)}
                        </p>
                        <button
                          onClick={() => handleMatch(selectedTx, entry.id)}
                          disabled={isPending}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
