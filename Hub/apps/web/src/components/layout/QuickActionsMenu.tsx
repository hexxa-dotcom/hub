'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Plus, ChevronDown, Sparkles, Settings } from 'lucide-react';
import { QUICK_ACTIONS_CATALOG, DEFAULT_QUICK_ACTIONS, readQuickActionsConfig, type QuickActionId } from '@/lib/quickActions';
import { QuickActionDrawer } from './QuickActionDrawer';

export function QuickActionsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState(DEFAULT_QUICK_ACTIONS);
  const [drawerId, setDrawerId] = useState<QuickActionId | null>(null);

  useEffect(() => {
    setSelectedIds(readQuickActionsConfig());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ACTIONS = selectedIds
    .map((id) => QUICK_ACTIONS_CATALOG.find((a) => a.id === id))
    .filter((a): a is (typeof QUICK_ACTIONS_CATALOG)[number] => Boolean(a));

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full bg-[#DFFFAE] hover:bg-[#c9f58c] text-[#1E3328] px-3.5 py-2 text-xs sm:text-sm font-bold shadow-sm transition-all duration-200 hover:scale-105"
      >
        <Plus className="h-4 w-4 shrink-0 stroke-[2.5]" />
        <span className="hidden sm:inline">Nova Ação</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-3xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] p-2 shadow-2xl z-50 animate-fade-up">
          <div className="px-3 py-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE] flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Ações Rápidas
            </span>
          </div>

          {ACTIONS.length === 0 && (
            <p className="px-3 py-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              Nenhuma ação selecionada. Configure abaixo.
            </p>
          )}

          <div className="py-1 space-y-1">
            {ACTIONS.map((item) => {
              const Icon = item.icon;
              const inner = (
                <>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2F4A3C] text-[#DFFFAE] group-hover:bg-[#1E3328] group-hover:scale-105 transition-all shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] truncate leading-tight">
                        {item.label}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] truncate">
                      {item.sub}
                    </p>
                  </div>
                </>
              );

              if (item.drawer) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setDrawerId(item.id);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl p-2.5 hover:bg-[#F4EFE4] dark:hover:bg-white/5 transition-colors group"
                  >
                    {inner}
                  </button>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href as never}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-[#F4EFE4] dark:hover:bg-white/5 transition-colors group"
                >
                  {inner}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-black/5 dark:border-white/5 mt-1 pt-1">
            <Link
              href={'/configuracoes/preferencias' as never}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl p-2.5 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-[#F4EFE4] dark:hover:bg-white/5 hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-colors"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/5 dark:bg-white/10">
                <Settings className="h-4 w-4" />
              </span>
              <p className="text-xs sm:text-sm font-semibold">Editar ações rápidas</p>
            </Link>
          </div>
        </div>
      )}

      <QuickActionDrawer actionId={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  );
}
