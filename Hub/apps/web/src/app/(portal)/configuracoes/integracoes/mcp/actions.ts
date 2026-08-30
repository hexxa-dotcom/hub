'use server';

import { randomBytes, createHash } from 'crypto';
import { revalidatePath } from 'next/cache';
import { withTenant, eq, and, desc } from '@hexxa/db';
import { isNull } from 'drizzle-orm';
import { apiToken } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export type ApiTokenScope = 'read' | 'write' | 'admin';

export type ApiTokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: ApiTokenScope;
  lastUsedAt: string | null;
  createdAt: string;
  revoked: boolean;
};

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function listApiTokens(): Promise<ApiTokenRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(apiToken)
      .where(eq(apiToken.companyId, ctx.companyId))
      .orderBy(desc(apiToken.createdAt));
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tokenPrefix: r.tokenPrefix,
    scope: (r.scope as ApiTokenScope) ?? 'read',
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    revoked: r.revokedAt !== null,
  }));
}

/**
 * Cria um token novo e devolve o valor bruto — é a ÚNICA vez que ele existe
 * em texto puro. Só o hash fica salvo; se o usuário perder, precisa gerar outro.
 */
export async function createApiToken(name: string, scope: ApiTokenScope): Promise<{ token: string }> {
  const ctx = await getTenantContext();
  if (!name.trim()) throw new Error('Dê um nome pro token (ex.: "Claude Desktop").');

  if (scope === 'admin') {
    const { isAdminUser } = await import('@/lib/server/admin-guard');
    if (!(await isAdminUser())) {
      throw new Error('Apenas administradores podem criar tokens com escopo de Contador/Admin.');
    }
  }

  const raw = `hexx_mcp_${randomBytes(24).toString('hex')}`;
  const tokenHash = hashToken(raw);
  const tokenPrefix = raw.slice(0, 17); // "hexx_mcp_" + 8 chars

  await withTenant(ctx.companyId, async (tx) => {
    await tx.insert(apiToken).values({
      companyId: ctx.companyId,
      name: name.trim(),
      tokenHash,
      tokenPrefix,
      scope,
    });
  });

  revalidatePath('/configuracoes/integracoes/mcp');
  return { token: raw };
}

export async function revokeApiToken(id: string): Promise<void> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(apiToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiToken.id, id), eq(apiToken.companyId, ctx.companyId), isNull(apiToken.revokedAt)));
  });
  revalidatePath('/configuracoes/integracoes/mcp');
}
