import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { resolveNfsePort } from '@/lib/server/container';
import { withTenant, serviceInvoice, eq, and } from '@hexxa/db';
import { parseNfseXml } from '@/lib/server/danfse';
import { renderDanfsePdf } from '@/lib/server/danfse-pdf';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    const { id, type } = await params;
    if (type !== 'xml' && type !== 'pdf') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const ctx = await getTenantContext();
    if (!ctx.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Acha a nota para verificar se pertence ao tenant e pegar o providerProtocol
    const [nota] = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({ id: serviceInvoice.id, providerProtocol: serviceInvoice.providerProtocol, status: serviceInvoice.status })
        .from(serviceInvoice)
        .where(
          and(
            eq(serviceInvoice.id, id),
            eq(serviceInvoice.companyId, ctx.companyId)
          )
        );
    });

    if (!nota || !nota.providerProtocol) {
      return NextResponse.json({ error: 'NFSe not found or missing protocol' }, { status: 404 });
    }

    const port = await resolveNfsePort(ctx);
    if (!port.download) {
      return NextResponse.json({ error: 'Adapter does not support direct download' }, { status: 501 });
    }

    // O governo não expõe mais um endpoint de PDF utilizável por terceiros —
    // o XML é o documento fiscal real; o PDF (DANFSe) é layout NOSSO,
    // gerado localmente a partir dele (ver lib/server/danfse.ts).
    if (type === 'pdf') {
      const xmlBuffer = await port.download(nota.providerProtocol, 'xml');
      const data = parseNfseXml(xmlBuffer.toString('utf-8'), nota.providerProtocol);
      const pdfBuffer = await renderDanfsePdf(data);
      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="nfse_${nota.providerProtocol}.pdf"`,
        },
      });
    }

    const buffer = await port.download(nota.providerProtocol, type);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="nfse_${nota.providerProtocol}.xml"`,
      },
    });
  } catch (err: any) {
    console.error('Failed to download nfse:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
