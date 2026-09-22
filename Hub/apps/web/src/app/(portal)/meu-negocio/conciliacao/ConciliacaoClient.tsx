'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  matchTransaction,
  ignoreTransaction,
  suggestAiMatchesAction,
  applyAiMatchAction,
  applyAiNewEntryAction,
  applyBatchAiSuggestionsAction,
} from './actions';
import {
  Loader2,
  ArrowRightLeft,
  Check,
  Plus,
  Sparkles,
  Tag,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Folder,
  ListFilter,
  Layers,
} from 'lucide-react';

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

type CategoryItem = {
  id: string;
  name: string;
  kind?: string;
};

type AiSuggestion = {
  transactionId: string;
  suggestedCategoryId: string;
  categoryName?: string;
  confidenceScore: number;
  action: 'MATCH_EXISTING' | 'CREATE_NEW';
  matchedEntryId?: string;
  justification: string;
};

interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  transactions: Transaction[];
  totalAmount: number;
  suggestionCount: number;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export function ConciliacaoClient({
  transactions,
  entries,
  categories = [],
}: {
  transactions: Transaction[];
  entries: Entry[];
  categories?: CategoryItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, AiSuggestion>>({});
  const [editingCategoryTx, setEditingCategoryTx] = useState<Record<string, boolean>>({});
  const [selectedCategoryByTx, setSelectedCategoryByTx] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Modo de visualização: 'category' (agrupado em acordeom) ou 'list' (corrida)
  const [viewMode, setViewMode] = useState<'category' | 'list'>('category');
  // Estado dos acordeons de categoria (true = aberto, false = fechado)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
      } catch {
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
      } catch {
        alert('Erro ao ignorar.');
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

  function handleApplyAiMatch(suggestion: AiSuggestion, categoryId?: string) {
    if (!suggestion.matchedEntryId) return;
    const catId = categoryId || suggestion.suggestedCategoryId;
    startTransition(async () => {
      const res = await applyAiMatchAction(suggestion.transactionId, suggestion.matchedEntryId!, catId);
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

  function handleApplyAiNewEntry(suggestion: AiSuggestion, categoryId?: string) {
    const catId = categoryId || suggestion.suggestedCategoryId;
    startTransition(async () => {
      const res = await applyAiNewEntryAction(suggestion.transactionId, catId);
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

  function handleAcceptAllSuggestions() {
    const list = Object.values(suggestions).map((s) => ({
      transactionId: s.transactionId,
      categoryId: selectedCategoryByTx[s.transactionId] || s.suggestedCategoryId,
      action: s.action,
      matchedEntryId: s.matchedEntryId,
    }));

    if (list.length === 0) return;

    startTransition(async () => {
      const res = await applyBatchAiSuggestionsAction(list);
      if (!res.ok) {
        alert(res.message || 'Não foi possível aceitar todas as sugestões.');
        return;
      }
      setSuggestions({});
      setSelectedTx(null);
      alert(`${res.count} transação(ões) categorizada(s) e conciliada(s) com sucesso!`);
    });
  }

  function handleAcceptGroupSuggestions(group: CategoryGroup) {
    const list = group.transactions
      .filter((tx) => !!suggestions[tx.id])
      .map((tx) => {
        const s = suggestions[tx.id]!;
        return {
          transactionId: s.transactionId,
          categoryId: selectedCategoryByTx[s.transactionId] || s.suggestedCategoryId,
          action: s.action,
          matchedEntryId: s.matchedEntryId,
        };
      });

    if (list.length === 0) return;

    startTransition(async () => {
      const res = await applyBatchAiSuggestionsAction(list);
      if (!res.ok) {
        alert(res.message || 'Não foi possível aceitar as sugestões do grupo.');
        return;
      }
      setSuggestions((prev) => {
        const next = { ...prev };
        for (const item of list) {
          delete next[item.transactionId];
        }
        return next;
      });
      setSelectedTx(null);
      alert(`${res.count} transações do grupo "${group.categoryName}" conciliadas com sucesso!`);
    });
  }

  // Agrupamento de transações por categoria
  const categoryGroups = useMemo(() => {
    const groups: Record<string, CategoryGroup> = {};

    for (const tx of transactions) {
      const s = suggestions[tx.id];
      const chosenCatId = selectedCategoryByTx[tx.id] || s?.suggestedCategoryId;
      const catObj = chosenCatId ? categories.find((c) => c.id === chosenCatId) : undefined;
      const catName =
        catObj?.name ||
        s?.categoryName ||
        (chosenCatId ? 'Categoria selecionada' : 'Aguardando Análise');
      const groupKey = chosenCatId || '__unassigned__';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          categoryId: groupKey,
          categoryName: catName,
          transactions: [],
          totalAmount: 0,
          suggestionCount: 0,
        };
      }

      groups[groupKey].transactions.push(tx);
      groups[groupKey].totalAmount += tx.amount;
      if (s) {
        groups[groupKey].suggestionCount += 1;
      }
    }

    return Object.values(groups).sort((a, b) => {
      if (a.categoryId === '__unassigned__') return 1;
      if (b.categoryId === '__unassigned__') return -1;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }, [transactions, suggestions, selectedCategoryByTx, categories]);

  const suggestionCount = Object.keys(suggestions).length;

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: prev[groupId] !== undefined ? !prev[groupId] : true,
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of categoryGroups) next[g.categoryId] = true;
    setOpenGroups(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of categoryGroups) next[g.categoryId] = false;
    setOpenGroups(next);
  };

  // Se não há transações, o CardStatusConciliacao já exibe o status de "Tudo em dia!"
  if (transactions.length === 0) {
    return null;
  }

  // Renderiza um card de transação individual
  const renderTxCard = (tx: Transaction) => {
    const isSelected = selectedTx === tx.id;
    const s = suggestions[tx.id];
    const isEditing = editingCategoryTx[tx.id];
    const chosenCatId = selectedCategoryByTx[tx.id] || s?.suggestedCategoryId;
    const chosenCatName =
      categories.find((c) => c.id === chosenCatId)?.name ||
      s?.categoryName ||
      'Categoria sugerida';
    const isDespesa = tx.amount < 0;

    return (
      <div
        key={tx.id}
        onClick={() => setSelectedTx(tx.id)}
        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
          isSelected
            ? 'border-hexxa-green dark:border-hexxa-lime bg-surface-card shadow-(--elev-inset)'
            : 'border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) card-finish hover:shadow-(--elev-2)'
        }`}
      >
        <div className="flex justify-between items-start mb-1.5">
          <p className="text-sm font-bold text-ink leading-snug">{tx.description}</p>
          <p
            className={`font-serif font-bold tabular ml-3 shrink-0 ${
              tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-hexxa-green dark:text-hexxa-lime'
            }`}
          >
            {fmt(tx.amount)}
          </p>
        </div>

        <div className="flex justify-between items-center text-xs text-ink-soft">
          <span className="tabular">{fmtDate(tx.postedAt)}</span>
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleIgnore(tx.id);
              }}
              className="text-red-600 dark:text-red-400 font-bold hover:underline"
            >
              Ignorar
            </button>
          )}
        </div>

        {s && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 rounded-2xl bg-surface-card border border-hexxa-green/30 dark:border-hexxa-lime/30 p-4 shadow-(--elev-1) space-y-3 animate-in fade-in"
          >
            {/* Topo da sugestão com badge de precisão */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime text-[10px] shadow-xs">
                  <Sparkles className="h-3 w-3" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-hexxa-forest dark:text-hexxa-lime">
                  Sugestão Automática de Categoria
                </span>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                {Math.round(s.confidenceScore * 100)}% confiança
              </span>
            </div>

            {/* Descrição em linguagem clara para o usuário */}
            <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-3.5 border border-black/5 dark:border-white/5 space-y-2">
              <p className="text-sm text-ink leading-relaxed">
                {isDespesa ? 'Esta despesa foi categorizada como ' : 'Esta receita foi categorizada como '}
                <strong className="inline-flex items-center gap-1 rounded-lg bg-hexxa-forest text-hexxa-lime dark:bg-hexxa-lime/20 dark:text-hexxa-lime px-2.5 py-0.5 text-xs font-bold shadow-xs">
                  <Tag className="h-3 w-3" />
                  {chosenCatName}
                </strong>
              </p>

              {s.justification && (
                <p className="text-xs text-ink-soft leading-normal">
                  <span className="font-semibold text-ink">Motivo:</span> {s.justification}
                </p>
              )}
            </div>

            {/* Dropdown de edição inline */}
            {isEditing && (
              <div className="rounded-xl bg-surface-card p-3 border border-hexxa-green/40 dark:border-hexxa-lime/40 shadow-(--elev-inset) space-y-1.5 animate-in fade-in">
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft block">
                  Para qual categoria deve ir esta {isDespesa ? 'despesa' : 'receita'}?
                </label>
                <select
                  value={chosenCatId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCategoryByTx((prev) => ({ ...prev, [tx.id]: val }));
                  }}
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-surface-card px-3 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime shadow-(--elev-inset)"
                >
                  <option value="">— Selecione uma categoria —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Confirmação e botões */}
            <div className="pt-2.5 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-ink">É isso mesmo?</p>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategoryTx((prev) => ({ ...prev, [tx.id]: !isEditing }));
                  }}
                  className="rounded-full border border-black/10 dark:border-white/10 bg-surface-card px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-all active:scale-95"
                >
                  {isEditing ? 'Concluir escolha' : 'Editar categoria'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuggestions((prev) => {
                      const next = { ...prev };
                      delete next[tx.id];
                      return next;
                    });
                  }}
                  className="rounded-full border border-black/10 dark:border-white/10 bg-surface-card px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shadow-(--elev-1) transition-all active:scale-95"
                >
                  Não
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const finalCatId = chosenCatId || s.suggestedCategoryId;
                    s.action === 'MATCH_EXISTING'
                      ? handleApplyAiMatch(s, finalCatId)
                      : handleApplyAiNewEntry(s, finalCatId);
                  }}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 px-3.5 py-1.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Sim, confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const selectedTransactionObj = transactions.find((t) => t.id === selectedTx);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Barra de Ações Superior */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-xl text-ink">Transações do Extrato</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            {transactions.length} transação(ões) aguardando correspondência ou categorização.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador de Visualização: Por Categoria vs Lista Geral */}
          <div className="flex items-center rounded-2xl bg-surface p-1 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
            <button
              type="button"
              onClick={() => setViewMode('category')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewMode === 'category'
                  ? 'bg-surface-card text-ink shadow-(--elev-1)'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Por Categoria
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewMode === 'list'
                  ? 'bg-surface-card text-ink shadow-(--elev-1)'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Lista Geral
            </button>
          </div>

          {/* Botão de Aceitar Todas */}
          {suggestionCount > 0 && (
            <button
              onClick={handleAcceptAllSuggestions}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-(--elev-1) hover:brightness-110 active:scale-95 px-4 py-2 text-xs font-bold transition-all disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Aceitar todas ({suggestionCount})
            </button>
          )}

          {/* Botão de Sugerir IA */}
          <button
            onClick={handleSuggestAi}
            disabled={aiLoading}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-4 py-2 text-xs font-bold transition-all disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {aiLoading ? 'Analisando extrato...' : 'Sugerir Categorização Automática (IA)'}
          </button>
        </div>
      </div>

      {/* Banner de Sugestões de IA Prontas */}
      {suggestionCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-surface-card border border-hexxa-green/30 dark:border-hexxa-lime/30 shadow-(--elev-1) animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-hexxa-forest text-hexxa-lime text-xs shadow-xs">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">
                {suggestionCount} sugestão(ões) de categoria pronta(s)
              </p>
              <p className="text-xs text-ink-soft">
                Você pode aceitar por categoria nos blocos abaixo ou aceitar todas com um único clique.
              </p>
            </div>
          </div>

          <button
            onClick={handleAcceptAllSuggestions}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all disabled:opacity-50 shrink-0"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Aceitar todas ({suggestionCount})
          </button>
        </div>
      )}

      {aiError && (
        <p className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400">
          {aiError}
        </p>
      )}

      {/* Grid Principal: Lado Esquerdo (Extrato / Categorias) & Lado Direito (Correspondência) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
        {/* Lado Esquerdo: Extrato Bancário (Agrupado por Categoria ou Lista) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-caption font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) text-xs font-bold">
                1
              </span>
              Extrato Bancário
            </h2>

            {viewMode === 'category' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-[11px] font-bold text-ink-soft hover:text-ink transition-colors"
                >
                  Expandir todos
                </button>
                <span className="text-ink-soft opacity-40">·</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-[11px] font-bold text-ink-soft hover:text-ink transition-colors"
                >
                  Recolher todos
                </button>
              </div>
            )}
          </div>

          {/* VISUALIZAÇÃO 1: Agrupada por Categoria (Acordeom) */}
          {viewMode === 'category' ? (
            <div className="space-y-3.5">
              {categoryGroups.map((group) => {
                const hasSelectedInside = selectedTx
                  ? group.transactions.some((t) => t.id === selectedTx)
                  : false;
                const isOpen =
                  openGroups[group.categoryId] !== undefined
                    ? openGroups[group.categoryId]
                    : hasSelectedInside; // Aberto se tiver transação selecionada, caso contrário fechado por padrão

                return (
                  <div
                    key={group.categoryId}
                    className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish overflow-hidden transition-all"
                  >
                    {/* Cabeçalho do Acordeom de Categoria */}
                    <div
                      onClick={() => toggleGroup(group.categoryId)}
                      className="p-4 sm:p-4.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/10 text-hexxa-forest dark:text-hexxa-lime border border-hexxa-green/20">
                          {isOpen ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-ink truncate">
                              {group.categoryName}
                            </h3>
                            <span className="text-[11px] rounded-full px-2 py-0.5 bg-surface border border-black/5 dark:border-white/5 text-ink-soft font-medium tabular">
                              {group.transactions.length}{' '}
                              {group.transactions.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>

                          <p className="text-xs text-ink-soft font-serif tabular mt-0.5">
                            Total:{' '}
                            <span
                              className={`font-bold ${
                                group.totalAmount < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-hexxa-green dark:text-hexxa-lime'
                              }`}
                            >
                              {fmt(group.totalAmount)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Ações do cabeçalho da categoria */}
                      <div className="flex items-center gap-2 shrink-0">
                        {group.suggestionCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptGroupSuggestions(group);
                            }}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-[11px] font-bold shadow-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" />
                            Aceitar grupo ({group.suggestionCount})
                          </button>
                        )}

                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface border border-black/5 dark:border-white/5 text-ink-soft">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Lista interna de transações da categoria */}
                    {isOpen && (
                      <div className="p-3 sm:p-4 pt-1 sm:pt-1 border-t border-black/5 dark:border-white/5 space-y-2.5 bg-black/[0.01] dark:bg-white/[0.01]">
                        {group.transactions.map((tx) => renderTxCard(tx))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* VISUALIZAÇÃO 2: Lista Geral */
            <div className="space-y-3">
              {transactions.map((tx) => renderTxCard(tx))}
            </div>
          )}
        </div>

        {/* Linha Divisória visual central em telas grandes */}
        <div className="hidden lg:block absolute left-1/2 top-10 bottom-0 w-px bg-black/5 dark:bg-white/5 -translate-x-1/2 pointer-events-none">
          <div className="sticky top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-card shadow-(--elev-1) p-2 rounded-full border border-black/5 dark:border-white/5">
            <ArrowRightLeft className="h-4 w-4 text-ink-soft opacity-50" />
          </div>
        </div>

        {/* Lado Direito: Sugestões de Match e Lançamentos */}
        <div className="space-y-4">
          <h2 className="text-caption font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) text-xs font-bold">
              2
            </span>
            Encontrar Correspondência
          </h2>

          {!selectedTx ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center border border-dashed border-black/10 dark:border-white/10 rounded-3xl bg-surface-card/40 p-8 text-center">
              <Layers className="h-10 w-10 text-ink-soft opacity-30 mb-3" />
              <h4 className="font-serif font-bold text-base text-ink mb-1">
                Nenhuma transação selecionada
              </h4>
              <p className="text-xs text-ink-soft max-w-xs">
                Selecione uma transação à esquerda para visualizar lançamentos correspondentes ou vinculá-la com um lançamento existente.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Banner da Transação Atualmente Selecionada */}
              {selectedTransactionObj && (
                <div className="p-3.5 rounded-2xl bg-surface-card border border-hexxa-green/40 dark:border-hexxa-lime/40 shadow-(--elev-1) flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-hexxa-forest dark:text-hexxa-lime">
                      Transação Ativa
                    </span>
                    <p className="text-xs font-bold text-ink truncate mt-0.5">
                      {selectedTransactionObj.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-serif font-bold text-sm tabular ${
                        selectedTransactionObj.amount < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-hexxa-green dark:text-hexxa-lime'
                      }`}
                    >
                      {fmt(selectedTransactionObj.amount)}
                    </p>
                    <span className="text-[10px] text-ink-soft">
                      {fmtDate(selectedTransactionObj.postedAt)}
                    </span>
                  </div>
                </div>
              )}

              {/* Lista de Lançamentos Pendentes no Hub */}
              {entries.length === 0 ? (
                <div className="p-6 text-center text-ink-soft bg-surface-card rounded-2xl border border-black/5 dark:border-white/10 shadow-(--elev-1)">
                  <p className="text-sm mb-4">Não há lançamentos pendentes no Hub.</p>
                  <button className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) px-4 py-2 text-xs font-bold hover:brightness-110">
                    <Plus className="h-3 w-3" /> Criar Lançamento a partir do Extrato
                  </button>
                </div>
              ) : (
                entries.map((entry) => {
                  const tx = transactions.find((t) => t.id === selectedTx)!;
                  const isSameSign =
                    (tx.amount < 0 && entry.type === 'PAYABLE') ||
                    (tx.amount > 0 && entry.type === 'RECEIVABLE');
                  const isExactAmount = Math.abs(Math.abs(tx.amount) - entry.amount) < 0.01;

                  return (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-2xl border bg-surface-card shadow-(--elev-1) card-finish flex justify-between items-center group transition-all ${
                        isExactAmount && isSameSign
                          ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                          : 'border-black/5 dark:border-white/5 hover:border-hexxa-green/40 hover:shadow-(--elev-2)'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-bold text-ink flex items-center gap-2 flex-wrap">
                          <span className="truncate">{entry.description}</span>
                          {isExactAmount && isSameSign && (
                            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                              Correspondência exata
                            </span>
                          )}
                          {!isSameSign && (
                            <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-normal">
                              Tipo divergente
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-soft mt-1">
                          Vencimento: <span className="tabular">{fmtDate(entry.dueDate)}</span> ·{' '}
                          {entry.type === 'PAYABLE' ? 'A Pagar' : 'A Receber'}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <p
                          className={`font-serif font-bold tabular ${
                            entry.type === 'PAYABLE'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-hexxa-green dark:text-hexxa-lime'
                          }`}
                        >
                          {fmt(entry.amount)}
                        </p>
                        <button
                          onClick={() => handleMatch(selectedTx, entry.id)}
                          disabled={isPending}
                          title="Conciliar transação com este lançamento"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
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

