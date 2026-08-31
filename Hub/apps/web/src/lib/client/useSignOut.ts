'use client';

import { createClient } from '@/lib/supabase/client';

export type AccessArea = 'cliente' | 'contador';

/** Logout compartilhado entre o portal do cliente e a área do contador. */
export function useSignOut(area: AccessArea) {
  return async function sair() {
    try {
      await fetch(`/auth/sair?area=${area}`);
    } catch {
      // ignora — segue pro signOut/redirect mesmo se o fetch falhar
    }
    try {
      await createClient().auth.signOut();
    } catch {
      // sem sessão Supabase ativa (ex.: SKIP_AUTH_TEMP) — segue pro redirect mesmo assim
    }
    window.location.href = '/';
  };
}
