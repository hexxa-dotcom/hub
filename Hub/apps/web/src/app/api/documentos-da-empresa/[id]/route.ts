import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and } from '@hexxa/db';
import { companyDocument } from '@hexxa/db/schema';

export const dynamic = 'force-dynamic';

/** Abre (ou baixa) o arquivo de um documento da empresa. Só da própria empresa. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  const [d] = await withTenant(ctx.companyId, (tx) =>
    tx
      .select({ data: companyDocument.fileData, url: companyDocument.fileUrl, nome: companyDocument.fileName, titulo: companyDocument.name })
      .from(companyDocument)
      .where(and(eq(companyDocument.id, id), eq(companyDocument.companyId, ctx.companyId))),
  );
  if (!d) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  if (!d.data) {
    if (d.url && /^https?:\/\//i.test(d.url)) return NextResponse.redirect(d.url);
    return NextResponse.json({ error: 'Documento sem arquivo.' }, { status: 404 });
  }
  const [cabecalho, base64] = d.data.split(',', 2);
  const mime = cabecalho!.slice(5).split(';')[0] || 'application/pdf';
  const baixar = new URL(request.url).searchParams.get('modo') === 'baixar';
  const nome = (d.nome || `${d.titulo}.pdf`).replace(/[^\w.\- ]/g, '_');
  return new NextResponse(Buffer.from(base64 ?? '', 'base64'), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
