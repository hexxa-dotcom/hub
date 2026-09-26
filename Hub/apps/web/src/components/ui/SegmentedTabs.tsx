'use client';

import React from 'react';
import { flushSync } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { spring, crossFade } from '@/lib/motion';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
}

interface SegmentedTabsProps<T extends string = string> {
  tabs: readonly TabItem<T>[] | TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId = 'segmentedTabActivePill',
  className = '',
  size = 'md',
}: SegmentedTabsProps<T>) {
  const isSm = size === 'sm';
  const paddingCls = isSm ? 'px-3.5 py-1.5 text-xs font-bold' : 'px-4 sm:px-5 py-2 text-xs font-bold';
  const reduceMotion = useReducedMotion();

  // A troca de aba esmaece o conteúdo (View Transitions). Sem suporte no
  // navegador, ou com movimento reduzido, troca direto.
  function trocar(id: T) {
    const doc = typeof document !== 'undefined' ? (document as Document & { startViewTransition?: (cb: () => void) => unknown }) : null;
    if (id === activeTab || reduceMotion || !doc?.startViewTransition) return onChange(id);
    doc.startViewTransition(() => flushSync(() => onChange(id)));
  }

  return (
    <div
      className={`segmented-track relative inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1 no-scrollbar ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => trocar(tab.id)}
            className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-full ${paddingCls} transition-colors duration-200 shrink-0 select-none ${
              isActive
                ? 'segmented-active'
                : 'segmented-idle hover:text-ink'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={reduceMotion ? undefined : layoutId}
                className="segmented-thumb absolute inset-0 -z-10 rounded-full"
                transition={reduceMotion ? crossFade : spring.snappy}
              />
            )}
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span>{tab.label}</span>
            {tab.badge && <span className="ml-0.5">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * O número vermelho da aba — o padrão de notificação dos menus. Só aparece
 * quando há algo pedindo ação (vencido, não lido, atrasado).
 */
export function alertaDaAba(n: number): React.ReactNode {
  return n > 0 ? (
    <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">{n}</span>
  ) : undefined;
}
