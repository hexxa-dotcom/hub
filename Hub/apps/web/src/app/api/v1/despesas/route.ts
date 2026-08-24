import { extractBearerToken, resolveApiToken } from '@/lib/server/api-auth';
import { createDespesa } from '@/lib/server/mcp-data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/despesas — lança uma conta a pagar a partir de um sistema
 * externo (ex.: outro financeiro, ERP, planilha automatizada). Exige token
 * com escopo "write" (Configurações → Integrações → Assistente de IA).
 *
 * Body: { descricao, valor, vencimento (AAAA-MM-DD), categoria?, pago? }
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
    return Response.json({ error: 'Este token é só leitura. Crie um token com escopo "Leitura e escrita" pra lançar despesas.' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Corpo da requisição precisa ser JSON válido.' }, { status: 400 });
  }

  try {
    const result = await createDespesa(auth.companyId, {
      descricao: body.descricao,
      valor: Number(body.valor),
      vencimento: body.vencimento,
      categoria: body.categoria,
      recebidoOuPago: Boolean(body.pago),
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Falha ao lançar a despesa.' }, { status: 400 });
  }
}
