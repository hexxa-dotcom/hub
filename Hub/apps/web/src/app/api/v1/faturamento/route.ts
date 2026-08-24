import { extractBearerToken, resolveApiToken } from '@/lib/server/api-auth';
import { createFaturamento } from '@/lib/server/mcp-data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/faturamento — lança uma conta a receber a partir de um
 * sistema externo. Exige token com escopo "write".
 *
 * Body: { descricao, valor, vencimento (AAAA-MM-DD), categoria?, recebido? }
 */
export async function POST(req: Request) {
  const rawToken = extractBearerToken(req);
  if (!rawToken) {
    return Response.json({ error: 'Token de API ausente. Envie "Authorization: Bearer <token>".' }, { status: 401 });
  }

  const auth = await resolveApiToken(rawToken);
  if (!auth) {
    return Response.json({ error: 'Token de API inválido ou revogado.' }, { status: 401 });
  }
  if (auth.scope !== 'write') {
    return Response.json({ error: 'Este token é só leitura. Crie um token com escopo "Leitura e escrita" pra lançar faturamento.' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Corpo da requisição precisa ser JSON válido.' }, { status: 400 });
  }

  try {
    const result = await createFaturamento(auth.companyId, {
      descricao: body.descricao,
      valor: Number(body.valor),
      vencimento: body.vencimento,
      categoria: body.categoria,
      recebidoOuPago: Boolean(body.recebido),
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Falha ao lançar o faturamento.' }, { status: 400 });
  }
}
