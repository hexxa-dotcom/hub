import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';

export const dynamic = 'force-dynamic';

/**
 * Abre (ou baixa) o comprovante anexado a um lançamento. Só da própria
 * empresa. Antes o arquivo abria como link `data:`, que o Chrome bloqueia
 * numa aba nova — ficava uma página em branco.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Comprovante não encontrado.' }, { status: 404 });
  const ctx = await getTenantContext();
  const [l] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT receipt_base64, receipt_filename, receipt_mime_type FROM financial_entry
       WHERE id = ${id}::uuid AND company_id = ${ctx.companyId}
    `),
  )) as unknown as { receipt_base64: string | null; receipt_filename: string | null; receipt_mime_type: string | null }[];
  if (!l?.receipt_base64) return NextResponse.json({ error: 'Comprovante não encontrado.' }, { status: 404 });
  // Há comprovantes gravados com o prefixo `data:...;base64,` e outros sem.
  const base64 = l.receipt_base64.includes(',') ? l.receipt_base64.split(',', 2)[1]! : l.receipt_base64;
  const baixar = new URL(request.url).searchParams.get('modo') === 'baixar';
  const nome = (l.receipt_filename || 'comprovante').replace(/[^\w.\- ]/g, '_');
  return new NextResponse(Buffer.from(base64, 'base64'), {
    headers: {
      'Content-Type': l.receipt_mime_type || 'application/octet-stream',
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
