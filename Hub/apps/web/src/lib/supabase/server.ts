import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@hexxa/db';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function cookieConfig() {
  const cookieStore = await cookies();
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // chamado de um Server Component — ignorável com middleware de refresh.
      }
    },
  };
}

/** Client Supabase tipado pelo schema gerado (Server Components / Actions). */
export async function createClient() {
  return createServerClient<Database>(URL, KEY, { cookies: await cookieConfig() });
}

/** Client sem tipos — para tabelas ainda não incluídas nos types gerados. */
export async function createRawClient() {
  return createServerClient(URL, KEY, { cookies: await cookieConfig() });
}
