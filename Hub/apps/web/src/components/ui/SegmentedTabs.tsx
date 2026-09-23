'use client';

import React from 'react';
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
            onClick={() => onChange(tab.id)}
            className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-full ${paddingCls} transition-colors duration-200 shrink-0 select-none ${
              isActive
                ? 'text-ink'
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
