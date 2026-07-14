import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

function allowedCNPJs(): string[] {
  return (process.env.ADMIN_ALLOWED_CNPJS ?? '')
    .split(',')
    .map(s => s.replace(/\D/g, ''))
    .filter(Boolean);
}

function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * GET /api/admin/access — lista a allowlist de acesso admin.
 * Restrito: só responde para usuários logados (Clerk) que JÁ são admin.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const emails = (user.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
  const isAdmin = emails.some((e) => allowedEmails().includes(e));
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ cnpjs: allowedCNPJs(), emails: allowedEmails() });
}
