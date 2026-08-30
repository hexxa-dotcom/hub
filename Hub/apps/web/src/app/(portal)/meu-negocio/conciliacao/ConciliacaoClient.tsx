'use client';

import { useState, useTransition } from 'react';
import { matchTransaction, ignoreTransaction, generateMockTransactions } from './actions';
import { Loader2, ArrowRightLeft, Check, X, RefreshCw, Plus } from 'lucide-react';


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

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-black/5 dark:border-white/10 rounded-3xl bg-[#F4EFE4]/50 dark:bg-[#1A201C]/50 mt-8">
        <ArrowRightLeft className="h-12 w-12 text-[#6E6A61] opacity-30 mb-4" />
        <h3 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#FEFDF3] mb-2">Tudo em dia!</h3>
        <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-md mb-6">
          Não há transações pendentes de conciliação. Quando você fizer upload do OFX ou integrar seu banco, elas aparecerão aqui.
        </p>
        <button
          onClick={handleMock}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Gerar Dados de Teste
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6 animate-in fade-in">
      <div className="flex justify-end">
        <button
          onClick={handleMock}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-bold text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          + Dados
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
        {/* Lado Esquerdo: Extrato Bancário */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E3328] text-[#DFFFAE] text-xs">1</span>
            Extrato Bancário
          </h2>
          
          <div className="space-y-3">
            {transactions.map(tx => (
              <div 
                key={tx.id}
                onClick={() => setSelectedTx(tx.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedTx === tx.id 
                    ? 'border-[#2F4A3C] bg-[#EFFFD6] dark:bg-[#1E3328]/40 shadow-sm' 
                    : 'border-black/5 dark:border-white/10 bg-white/50 dark:bg-[#1A201C] hover:bg-white dark:hover:bg-[#1A201C]/80'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{tx.description}</p>
                  <p className={`font-serif font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'}`}>
                    {fmt(tx.amount)}
                  </p>
                </div>
                <div className="flex justify-between items-center text-xs text-[#6E6A61]">
                  <span>{fmtDate(tx.postedAt)}</span>
                  {selectedTx === tx.id && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleIgnore(tx.id); }}
                      className="text-red-600 font-bold hover:underline"
                    >
                      Ignorar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Linha Divisória visual */}
        <div className="hidden lg:block absolute left-1/2 top-10 bottom-0 w-px bg-black/5 dark:bg-white/5 -translate-x-1/2">
           <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#F4EFE4] dark:bg-[#121614] p-2 rounded-full border border-black/5 dark:border-white/5">
             <ArrowRightLeft className="h-4 w-4 text-[#6E6A61] opacity-50" />
           </div>
        </div>

        {/* Lado Direito: Sugestões de Match */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E3328] text-[#DFFFAE] text-xs">2</span>
            Encontrar Correspondência
          </h2>

          {!selectedTx ? (
            <div className="h-full min-h-[200px] flex items-center justify-center border border-dashed border-black/10 dark:border-white/10 rounded-3xl bg-black/5 dark:bg-white/5">
              <p className="text-sm text-[#6E6A61] text-center px-8">
                Selecione uma transação do lado esquerdo para ver as sugestões de lançamentos correspondentes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.length === 0 ? (
                <div className="p-6 text-center text-[#6E6A61] bg-white/50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10">
                  <p className="text-sm mb-4">Não há lançamentos pendentes no Hub.</p>
                  <button className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-4 py-2 text-xs font-bold hover:bg-black/10">
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
                      className="p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-[#1A201C] flex justify-between items-center group hover:border-[#DFFFAE] hover:bg-white transition-all"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                          {entry.description}
                          {!isSameSign && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-normal">Tipo divergente</span>}
                        </p>
                        <p className="text-xs text-[#6E6A61] mt-1">
                          Vencimento: {fmtDate(entry.dueDate)} · {entry.type === 'PAYABLE' ? 'A Pagar' : 'A Receber'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-serif font-bold ${entry.type === 'PAYABLE' ? 'text-red-600' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'}`}>
                          {fmt(entry.amount)}
                        </p>
                        <button
                          onClick={() => handleMatch(selectedTx, entry.id)}
                          disabled={isPending}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
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
