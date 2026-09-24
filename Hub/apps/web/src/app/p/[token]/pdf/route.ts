import { NextResponse } from 'next/server';
import { propostaPublica } from '@/lib/server/propostas';
import { renderPropostaPdf } from '@/lib/server/proposta-pdf';

export const dynamic = 'force-dynamic';

/** O PDF da proposta pelo link público — para o cliente baixar. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await propostaPublica(token);
  if (!r) return new NextResponse('Proposta não encontrada.', { status: 404 });
  const pdf = await renderPropostaPdf(r.proposta, r.empresa, request.url.replace(/\/pdf(\?.*)?$/, ''));
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${r.proposta.numero}.pdf"` },
  });
}
