import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and } from '@hexxa/db';
import { businessContract } from '@hexxa/db/schema';

export const dynamic = 'force-dynamic';

/** O PDF do contrato, para ler antes de assinar e para baixar. Só da própria empresa. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  const [c] = await withTenant(ctx.companyId, (tx) =>
    tx
      .select({ pdf: businessContract.pdfBase64, title: businessContract.title })
      .from(businessContract)
      .where(and(eq(businessContract.id, id), eq(businessContract.companyId, ctx.companyId))),
  );
  if (!c?.pdf) return NextResponse.json({ error: 'Contrato sem PDF.' }, { status: 404 });
  const baixar = new URL(request.url).searchParams.get('modo') === 'baixar';
  const nome = `${c.title.replace(/[^\w\- ]/g, '_').slice(0, 60)}.pdf`;
  return new NextResponse(Buffer.from(c.pdf.replace(/^data:[^,]+,/, ''), 'base64'), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
