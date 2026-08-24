'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getStoredTheme, resolveTheme, setTheme, type Theme } from '@/lib/theme';

const OPTS: { v: Theme; label: string }[] = [
  { v: 'light', label: 'Claro' },
  { v: 'dark', label: 'Escuro' },
  { v: 'system', label: 'Sistema' },
];

/** Seletor segmentado (usado em Configurações). */
export function ThemeSegmented() {
  const [theme, setLocal] = useState<Theme>('system');
  useEffect(() => setLocal(getStoredTheme()), []);

  return (
    <div className="flex rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-1 text-xs">
      {OPTS.map((o) => (
        <button
          key={o.v}
          onClick={() => {
            setLocal(o.v);
            setTheme(o.v);
          }}
          className={`rounded-full px-3 py-1 font-medium transition-all ${
            theme === o.v
              ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
              : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Botão claro/escuro (usado no topo ou sidebar). */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(resolveTheme(getStoredTheme()) === 'dark');
  }, []);

  function toggle() {
    const next: Theme = dark ? 'light' : 'dark';
    setDark(!dark);
    setTheme(next);
  }

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        type="button"
        aria-label="Alternar tema"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] text-[#6E6A61] dark:text-[#A8A49C] hover:bg-[#DFFFAE] hover:text-[#231F20] transition-colors"
      >
        {mounted && dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      type="button"
      className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-colors"
    >
      <span className="flex items-center gap-2">
        {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {mounted && dark ? 'Tema claro' : 'Tema escuro'}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
        {mounted && dark ? 'Escuro' : 'Claro'}
      </span>
    </button>
  );
}
