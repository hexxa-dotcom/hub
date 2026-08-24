'use client';

import React from 'react';
import { motion } from 'framer-motion';

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

  return (
    <div
      className={`inline-flex p-1.5 rounded-full border border-black/5 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 backdrop-blur-md gap-1 max-w-full overflow-x-auto no-scrollbar shadow-xs relative ${className}`}
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
                ? 'text-[#DFFFAE] dark:text-[#1E3328]'
                : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3]'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-[#1E3328] dark:bg-[#DFFFAE] shadow-sm -z-10"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
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
