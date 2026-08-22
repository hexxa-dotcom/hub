import { NextResponse } from 'next/server';
import { requireAdminApi, allowedEmails } from '@/lib/server/admin-guard';

function allowedCNPJs(): string[] {
  return (process.env.ADMIN_ALLOWED_CNPJS ?? '')
    .split(',')
    .map(s => s.replace(/\D/g, ''))
    .filter(Boolean);
}

/**
 * GET /api/admin/access — lista a allowlist de acesso admin.
 * Restrito: só responde para usuários logados (Clerk) que JÁ são admin.
 */
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  return NextResponse.json({ cnpjs: allowedCNPJs(), emails: allowedEmails() });
}
