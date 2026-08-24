import { extractBearerToken, resolveApiToken } from '@/lib/server/api-auth';
import { listContas } from '@/lib/server/mcp-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/contas?tipo=pagar|receber&status=&mes=AAAA-MM — lista contas a
 * pagar/receber pra um sistema externo consultar. Funciona com qualquer token
 * válido (leitura já basta).
 */
export async function GET(req: Request) {
  const rawToken = extractBearerToken(req);
  if (!rawToken) {
    return Response.json({ error: 'Token de API ausente. Envie "Authorization: Bearer <token>".' }, { status: 401 });
  }

  const auth = await resolveApiToken(rawToken);
  if (!auth) {
    return Response.json({ error: 'Token de API inválido ou revogado.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const tipo = url.searchParams.get('tipo');
  if (tipo !== 'pagar' && tipo !== 'receber') {
    return Response.json({ error: 'Parâmetro "tipo" é obrigatório: "pagar" ou "receber".' }, { status: 400 });
  }
  const status = url.searchParams.get('status') as 'aberto' | 'vencido' | 'pago' | null;
  const mes = url.searchParams.get('mes') || undefined;

  const data = await listContas(auth.companyId, { tipo, status: status ?? undefined, mes });
  return Response.json({ data });
}
