'use client';

import { useState, useEffect } from 'react';
import {
  QUICK_ACTIONS_CATALOG,
  DEFAULT_QUICK_ACTIONS,
  QUICK_ACTIONS_STORAGE_KEY,
  readQuickActionsConfig,
  type QuickActionId,
} from '@/lib/quickActions';

export function QuickActionsPreferencesForm() {
  const [selected, setSelected] = useState<QuickActionId[]>(DEFAULT_QUICK_ACTIONS);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setSelected(readQuickActionsConfig());
  }, []);

  function toggle(id: QuickActionId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(selected));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Erro ao salvar ações rápidas:', err);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {savedSuccess && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
          ✓ Ações rápidas salvas com sucesso.
        </div>
      )}

      <div>
        <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Ações Rápidas em Destaque</h3>
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Escolha o que aparece no menu de atalhos rápidos. Selecione ao menos uma ação.
        </p>
      </div>

      <div className="divide-y divide-black/5 dark:divide-white/10 border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden">
        {QUICK_ACTIONS_CATALOG.map((action) => {
          const checked = selected.includes(action.id);
          const Icon = action.icon;
          return (
            <div key={action.id} className="flex items-center justify-between p-4 bg-[#FEFDF3] dark:bg-[#121614] gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] truncate">{action.label}</p>
                  <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] truncate">{action.sub}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(action.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  checked ? 'bg-[#1E3328] dark:bg-[#2F4A3C]' : 'bg-black/10 dark:bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    checked ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={selected.length === 0}
          className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-50"
        >
          Salvar Ações Rápidas
        </button>
      </div>
    </form>
  );
}

