'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight } from 'lucide-react';
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
      <label className="flex w-[220px] items-center gap-2.5 rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] px-4 py-2 text-sm text-[#6E6A61] dark:text-[#A8A49C] shadow-sm transition-all focus-within:shadow-md focus-within:border-[#2F4A3C] dark:focus-within:border-[#DFFFAE] focus-within:w-[320px]">
        <Search className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { if (query) setOpen(true); }}
          placeholder="Buscar no sistema..."
          className="w-full bg-transparent text-[#231F20] dark:text-[#FEFDF3] outline-none placeholder:text-[#6E6A61] dark:placeholder:text-[#A8A49C] text-xs sm:text-sm"
        />
      </label>

      {open && query.length > 1 && (
        <div className="absolute right-0 top-full mt-2 w-full min-w-[320px] overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] shadow-2xl z-50">
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length > 0 ? (
              <ul className="space-y-1">
                {results.map((r, i) => (
                  <li key={i}>
                    <Link 
                      href={r.href as any}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-xl p-3 text-sm hover:bg-[#F4EFE4] dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#231F20] dark:text-[#FEFDF3]">{r.label}</span>
                        <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{r.section}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
                Nenhum resultado encontrado para "{query}"
              </div>
            )}
          </div>
          <div className="border-t border-black/5 dark:border-white/5 bg-[#F4EFE4]/50 dark:bg-white/5 px-4 py-2 text-xs text-[#6E6A61] dark:text-[#A8A49C] text-center">
            Páginas e atalhos do Hexxa Hub
          </div>
        </div>
      )}
    </div>
  );
}
