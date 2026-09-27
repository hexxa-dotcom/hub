import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { danfseDeExemplo } from '@/lib/server/danfse-exemplo';

export const dynamic = 'force-dynamic';

/** A DANFSe da nota de exemplo — ver lib/server/danfse-exemplo.ts. */
export async function GET() {
  const ctx = await getTenantContext();
  const pdf = await danfseDeExemplo(ctx.companyId);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="nota-de-exemplo.pdf"', 'Cache-Control': 'no-store' },
  });
}
