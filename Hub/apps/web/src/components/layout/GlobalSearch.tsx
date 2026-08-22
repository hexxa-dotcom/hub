'use client';

import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass, CaretRight, FileText, Users, CurrencyDollar } from '@phosphor-icons/react';
import { NAV } from '@/lib/nav';
import Link from 'next/link';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allLinks = NAV.flatMap(section => 
    section.items.map(item => ({ ...item, section: section.title }))
  );

  const results = query.length > 1 
    ? allLinks.filter(l => l.label.toLowerCase().includes(query.toLowerCase()) || l.section.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="relative" ref={containerRef}>
      <label className="flex w-[220px] items-center gap-2 rounded-full border border-line bg-surface-card px-4 py-2.5 text-sm text-ink-soft shadow-sm transition-all focus-within:shadow-md focus-within:border-brand-400 focus-within:w-[320px]">
        <MagnifyingGlass className="h-4 w-4" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { if (query) setOpen(true); }}
          placeholder="Buscar páginas ou funções..."
          className="w-full bg-transparent text-ink outline-none placeholder:text-ink-soft"
        />
      </label>

      {open && query.length > 1 && (
        <div className="absolute right-0 top-full mt-2 w-full min-w-[320px] overflow-hidden rounded-2xl border border-line bg-surface-card shadow-2xl z-50">
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length > 0 ? (
              <ul className="space-y-1">
                {results.map((r, i) => (
                  <li key={i}>
                    <Link 
                      href={r.href as any}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-xl p-3 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-ink">{r.label}</span>
                        <span className="text-xs text-ink-soft">{r.section}</span>
                      </div>
                      <CaretRight className="h-4 w-4 text-ink-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-ink-soft">
                Nenhum resultado encontrado para "{query}"
              </div>
            )}
          </div>
          <div className="border-t border-line bg-black/[0.07] dark:bg-white/5 px-4 py-2 text-xs text-ink-soft text-center">
            Resultados de páginas do sistema
          </div>
        </div>
      )}
    </div>
  );
}
