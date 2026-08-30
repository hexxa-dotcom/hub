import 'server-only';
import { createHash } from 'crypto';
import { getDb, eq, and, withDbTimeout } from '@hexxa/db';
import { isNull } from 'drizzle-orm';
import { apiToken } from '@hexxa/db/schema';

export type ApiTokenAuth = { companyId: string; scope: 'read' | 'write' | 'admin' };

/**
 * Resolve um token de API (`Authorization: Bearer <token>`) pro companyId e
 * escopo dele — compartilhado entre o servidor MCP (`/api/mcp`) e a API REST
 * de escrita (`/api/v1/*`). Nunca loga o token em texto puro.
 */
export async function resolveApiToken(rawToken: string): Promise<ApiTokenAuth | null> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const db = getDb();
  const [row] = await withDbTimeout(
    db
      .select({ id: apiToken.id, companyId: apiToken.companyId, scope: apiToken.scope })
      .from(apiToken)
      .where(and(eq(apiToken.tokenHash, tokenHash), isNull(apiToken.revokedAt))),
    8000,
  );
  if (!row) return null;
  // Aguarda (em vez de fire-and-forget): em serverless a função pode
  // congelar/finalizar antes da promise resolver, deixando a conexão em
  // estado indefinido no pool compartilhado.
  await withDbTimeout(db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id)), 8000).catch(() => {});
  return { companyId: row.companyId, scope: (row.scope as 'read' | 'write' | 'admin') ?? 'read' };
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const xApiKey = req.headers.get('x-api-key');
  if (xApiKey) return xApiKey.trim();

  try {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token') || url.searchParams.get('apiKey');
    if (queryToken) return queryToken.trim();
  } catch {}

  return null;
}
