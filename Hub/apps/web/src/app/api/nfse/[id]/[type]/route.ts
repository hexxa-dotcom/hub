import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { resolveNfsePort } from '@/lib/server/container';
import { createRawClient } from '@/lib/supabase/server';

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
    const sb = await createRawClient();
    const { data: nota } = await sb
      .from('service_invoice')
      .select('id, provider_protocol, status')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single();

    if (!nota || !nota.provider_protocol) {
      return NextResponse.json({ error: 'NFSe not found or missing protocol' }, { status: 404 });
    }

    const port = await resolveNfsePort(ctx);
    if (!port.download) {
      return NextResponse.json({ error: 'Adapter does not support direct download' }, { status: 501 });
    }

    const buffer = await port.download(nota.provider_protocol, type);

    const filename = `nfse_${nota.provider_protocol}.${type}`;
    const contentType = type === 'pdf' ? 'application/pdf' : 'application/xml';

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Failed to download nfse:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
