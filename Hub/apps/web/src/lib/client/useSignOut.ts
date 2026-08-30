'use client';

import { useClerk } from '@clerk/nextjs';

export type AccessArea = 'cliente' | 'contador';

/** Logout compartilhado entre o portal do cliente e a área do contador. */
export function useSignOut(area: AccessArea) {
  const { signOut } = useClerk();

  return async function sair() {
    try {
      await fetch(`/auth/sair?area=${area}`);
    } catch {
      // ignora — segue pro signOut/redirect mesmo se o fetch falhar
    }
    try {
      await signOut();
    } catch {
      // sem sessão Clerk ativa (ex.: SKIP_AUTH_TEMP) — signOut() não lança nem redireciona
    }
    window.location.href = '/';
  };
}
