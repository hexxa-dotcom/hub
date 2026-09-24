import { NextResponse } from 'next/server';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { isAdminUser } from '@/lib/server/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * O anexo de uma mensagem de chamado. A empresa só abre anexos dos próprios
 * chamados; o contador (admin) abre qualquer um.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Anexo inválido.' }, { status: 400 });
  const [m] = (await getDb().execute(sql`
    SELECT m.attachment, m.attachment_name, t.company_id
      FROM ticket_message m JOIN ticket t ON t.id = m.ticket_id
     WHERE m.id = ${id}::uuid
  `)) as unknown as { attachment: string | null; attachment_name: string | null; company_id: string }[];
  if (!m?.attachment) return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 });

  const admin = await isAdminUser().catch(() => false);
  if (!admin) {
    const ctx = await getTenantContext();
    if (ctx.companyId !== m.company_id) return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 });
  }

  const [cabecalho, base64] = m.attachment.split(',', 2);
  const mime = cabecalho!.slice(5).split(';')[0] || 'application/pdf';
  const baixar = new URL(request.url).searchParams.get('modo') === 'baixar';
  const nome = (m.attachment_name || 'anexo').replace(/[^\w.\- ]/g, '_');
  return new NextResponse(Buffer.from(base64 ?? '', 'base64'), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
