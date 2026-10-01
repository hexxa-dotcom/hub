import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb, sql } from '@hexxa/db';

/** The only public access to real receipts is an expiring, unguessable token. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) return new NextResponse('Link inválido.', { status: 404 });
  const [r] = await getDb().execute(sql`
    SELECT r.number, r.pdf_base64 FROM receipt_share s
    JOIN payment_receipt r ON r.id = s.receipt_id AND r.company_id = s.company_id
    JOIN financial_entry fe ON fe.id = r.financial_entry_id AND fe.company_id = r.company_id
    WHERE s.token_hash = ${createHash('sha256').update(token).digest('hex')}
      AND s.expires_at > now() AND r.canceled_at IS NULL AND fe.status = 'PAID' LIMIT 1
  `);
  if (!r) return new NextResponse('Este link expirou ou o recibo foi cancelado. Peça um novo link ao remetente.', { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(String(r.pdf_base64), 'base64')), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${r.number}.pdf"`,
    'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  } });
}
