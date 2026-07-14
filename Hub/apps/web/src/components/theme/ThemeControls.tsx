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
    <div className="flex rounded-xl border border-line p-0.5 text-xs">
      {OPTS.map((o) => (
        <button
          key={o.v}
          onClick={() => {
            setLocal(o.v);
            setTheme(o.v);
          }}
          className={`rounded-xl px-2.5 py-1 transition-colors ${
            theme === o.v
              ? 'bg-brand-500/12 font-medium text-brand-700 dark:text-brand-300'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Botão claro/escuro (usado na sidebar / topo mobile). */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(resolveTheme(getStoredTheme()) === 'dark'), []);

  function toggle() {
    const next: Theme = dark ? 'light' : 'dark';
    setDark(!dark);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Alternar tema"
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
        collapsed ? 'justify-center' : ''
      }`}
    >
      {dark ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
      {!collapsed && <span>{dark ? 'Tema claro' : 'Tema escuro'}</span>}
    </button>
  );
}
