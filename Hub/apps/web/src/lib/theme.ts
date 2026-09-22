'use client';

export type Theme = 'light' | 'dark' | 'focus' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'focus';

export const THEME_KEY = 'hexxa.theme';

export function resolveTheme(t: Theme | string): ResolvedTheme {
  if (t === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  // Migração suave: modo 'gray' virou modo 'focus' (cinza P&B)
  if (t === 'gray') return 'focus';
  if (t === 'dark') return 'dark';
  if (t === 'focus') return 'focus';
  return 'light';
}

export function applyTheme(t: Theme): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(t);
  const root = document.documentElement;

  // Limpa estados anteriores
  root.classList.remove('dark', 'theme-light', 'theme-focus', 'theme-gray');

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else if (resolved === 'focus') {
    root.classList.add('theme-focus');
  } else {
    // Modo Claro: cores plenas com fundo suave e cards brancos
    root.classList.add('theme-light');
  }
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const val = localStorage.getItem(THEME_KEY);
  if (val === 'gray') return 'focus';
  return (val as Theme | null) ?? 'system';
}

export function setTheme(t: Theme): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_KEY, t);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('themechange', { detail: resolveTheme(t) }));
  }
  applyTheme(t);
}
