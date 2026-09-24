import { NextResponse } from 'next/server';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { propostaDaEmpresa } from '@/lib/server/propostas';
import { renderPropostaPdf } from '@/lib/server/proposta-pdf';
import { origemPublica } from '@/lib/server/origem';

export const dynamic = 'force-dynamic';

/** O PDF da proposta, para a empresa ver e baixar. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Proposta inválida.' }, { status: 400 });
  const ctx = await getTenantContext();
  const origem = await origemPublica();
  const p = await propostaDaEmpresa(ctx, id, origem);
  if (!p) return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 });
  const [empresa] = (await getDb().execute(sql`
    SELECT coalesce(nullif(trim(trade_name), ''), legal_name) AS nome, legal_name, cnpj, logo_url, email, phone, city, state FROM company WHERE id = ${ctx.companyId}::uuid
  `)) as unknown as Parameters<typeof renderPropostaPdf>[1][];
  const pdf = await renderPropostaPdf(p, empresa!, p.link);
  const baixar = new URL(request.url).searchParams.get('modo') === 'baixar';
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${p.numero}.pdf"` },
  });
}
