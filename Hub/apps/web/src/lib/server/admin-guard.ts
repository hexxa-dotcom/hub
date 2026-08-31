import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';
// TEMPORÁRIO — ver comentário em lib/server/tenant.ts. Remover junto.
const SKIP_AUTH_TEMP = (process.env.SKIP_AUTH_TEMP ?? '').trim().toLowerCase() === 'true';

export function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Mesmo gate de acesso do (admin)/layout.tsx — login + e-mail na allowlist. */
export async function isAdminUser(): Promise<boolean> {
  if (DEV_SKIP_AUTH || SKIP_AUTH_TEMP) return true;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && allowedEmails().includes(email));
}

/**
 * Gate pra rotas de API sob /api/* que só o contador/admin pode chamar.
 * Rotas de API NÃO passam pelo layout de página — (admin)/layout.tsx só
 * protege a navegação, nunca a própria rota. Toda rota de API que expõe
 * dado ou ação administrativa (ex.: gestão de assinatura Asaas de QUALQUER
 * empresa) precisa chamar isto explicitamente.
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  return null;
}

/**
 * Mesmo gate, pra Server Actions ('use server') sob (admin)/contador/**.
 * Assim como as rotas de API, uma Server Action é o próprio endpoint (POST
 * direto pro action-id) — o (admin)/layout.tsx protege só a RENDERIZAÇÃO da
 * página, nunca a Server Action em si. Toda action que lê/grava dado de
 * QUALQUER empresa (não só a do usuário logado) precisa chamar isto como
 * primeira linha.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminUser())) {
    throw new Error('Não autorizado.');
  }
}
