import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { obterRecibo } from '@/lib/server/recibos';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  const r = await obterRecibo(ctx, (await params).id);
  if (!r || r.canceled_at) return NextResponse.json({ error: 'Recibo não encontrado ou cancelado.' }, { status: 404 });
  const download = new URL(request.url).searchParams.get('download') === 'true';
  return new NextResponse(new Uint8Array(Buffer.from(r.pdf_base64, 'base64')), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${r.number}.pdf"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
