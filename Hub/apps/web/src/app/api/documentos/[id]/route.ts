import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTenantContext } from '@/lib/server/tenant';
import { arquivoDaEntrega, registrarEventoDoCliente } from '@/lib/server/entregas';
import { CONTADOR_NA_AREA_COOKIE } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

/**
 * ABRIR OU BAIXAR UM DOCUMENTO — E DEIXAR REGISTRADO.
 *
 * O arquivo nunca é entregue direto ao navegador: passa por aqui, que grava
 * no histórico quem abriu e quando. É isso que responde "não recebi".
 *
 * Quando é o contador olhando pela área do cliente, o registro diz isso, e
 * não conta como visualização do cliente — senão a prova seria falsa.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baixar = new URL(request.url).searchParams.get('modo') === 'baixar';
  const ctx = await getTenantContext();

  const arquivo = await arquivoDaEntrega(ctx, id);
  if (!arquivo) return NextResponse.json({ error: 'Documento sem arquivo.' }, { status: 404 });

  const contador = (await cookies()).get(CONTADOR_NA_AREA_COOKIE)?.value === ctx.companyId;
  await registrarEventoDoCliente(
    ctx,
    id,
    contador ? 'ABERTO_PELO_CONTADOR' : baixar ? 'BAIXADO' : 'VISUALIZADO',
    request.headers.get('user-agent')?.slice(0, 200) ?? null,
  );

  if (!arquivo.conteudo.startsWith('data:')) return NextResponse.redirect(arquivo.conteudo);

  const [cabecalho, base64] = arquivo.conteudo.split(',', 2);
  const mime = cabecalho!.slice(5).split(';')[0] || 'application/pdf';
  const nome = arquivo.nome.replace(/[^\w.\- ]/g, '_');
  return new NextResponse(Buffer.from(base64 ?? '', 'base64'), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
