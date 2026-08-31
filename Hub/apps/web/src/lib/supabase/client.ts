'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Client Supabase pra Client Components (formulário de login/OTP, logout). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
