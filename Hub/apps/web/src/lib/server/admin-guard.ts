import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';

function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Mesmo gate de acesso do (admin)/layout.tsx — login + e-mail na allowlist. */
export async function isAdminUser(): Promise<boolean> {
  if (DEV_SKIP_AUTH) return true;
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
  return emails.some((e) => allowedEmails().includes(e));
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
