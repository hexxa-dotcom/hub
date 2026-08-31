import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client Supabase pra Server Components/Actions/Route Handlers.
 * O `setAll` pode falhar quando chamado de dentro de um Server Component puro
 * (Next não deixa setar cookie fora de Action/Route Handler) — ignoramos
 * porque o middleware (`updateSession`) já garante o refresh de sessão a
 * cada requisição.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // chamado de um Server Component — sem problema, ver comentário acima.
          }
        },
      },
    },
  );
}
