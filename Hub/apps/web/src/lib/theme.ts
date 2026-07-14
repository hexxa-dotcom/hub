'use client';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_KEY = 'hexxa.theme';

export function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return t;
}

export function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle('dark', resolveTheme(t) === 'dark');
}

export function getStoredTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'system';
}

export function setTheme(t: Theme): void {
  localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
}
