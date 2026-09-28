import { NextResponse } from 'next/server';
import { withTenant, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

/**
 * O PDF da guia, para ABRIR dentro do Hub (padrão) ou baixar (`?modo=baixar`).
 * A guia com entrega protocolada abre por /api/documentos/<entrega>, que
 * registra a abertura; esta rota é para a que não tem protocolo.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Guia inválida.' }, { status: 400 });
  const ctx = await getTenantContext();
  const [g] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`SELECT tax_name, reference_month::text AS mes, file_url FROM tax_guide WHERE id = ${id}::uuid AND company_id = ${ctx.companyId}`),
  )) as unknown as { tax_name: string; mes: string; file_url: string | null }[];
  if (!g?.file_url) return NextResponse.json({ error: 'Guia sem arquivo.' }, { status: 404 });
  if (!g.file_url.startsWith('data:')) return NextResponse.redirect(g.file_url);

  const [cabecalho, base64] = g.file_url.split(',', 2);
  const mime = cabecalho!.slice(5).split(';')[0] || 'application/pdf';
  const nome = `${g.tax_name} ${g.mes.slice(0, 7)}.pdf`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\- ]/g, '_');
  const baixar = new URL(request.url).searchParams.get('modo') === 'baixar';
  return new NextResponse(Buffer.from(base64 ?? '', 'base64'), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
