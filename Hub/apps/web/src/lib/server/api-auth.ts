import 'server-only';
import { createHash } from 'crypto';
import { getDb, eq, and } from '@hexxa/db';
import { isNull } from 'drizzle-orm';
import { apiToken } from '@hexxa/db/schema';

export type ApiTokenAuth = { companyId: string; scope: 'read' | 'write' };

/**
 * Resolve um token de API (`Authorization: Bearer <token>`) pro companyId e
 * escopo dele — compartilhado entre o servidor MCP (`/api/mcp`) e a API REST
 * de escrita (`/api/v1/*`). Nunca loga o token em texto puro.
 */
export async function resolveApiToken(rawToken: string): Promise<ApiTokenAuth | null> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const db = getDb();
  const [row] = await db
    .select({ id: apiToken.id, companyId: apiToken.companyId, scope: apiToken.scope })
    .from(apiToken)
    .where(and(eq(apiToken.tokenHash, tokenHash), isNull(apiToken.revokedAt)));
  if (!row) return null;
  // Fire-and-forget — não bloqueia a resposta por causa disso.
  db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id)).catch(() => {});
  return { companyId: row.companyId, scope: (row.scope as 'read' | 'write') ?? 'read' };
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
}
