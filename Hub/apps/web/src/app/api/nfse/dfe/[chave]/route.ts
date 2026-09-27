import { NextResponse } from 'next/server';
import { fetchXmlDaNotaPorNsu } from '@hexxa/integrations';
import { withTenant, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { getCertForTenant, getNfseConfig } from '@/lib/server/fiscal';
import { parseNfseXml } from '@/lib/server/danfse';
import { renderDanfsePdf } from '@/lib/server/danfse-pdf';

export const dynamic = 'force-dynamic';

/**
 * A DANFSe de uma nota que veio do Emissor Nacional, gerada na hora a partir
 * do XML oficial (buscado pelo NSU com o certificado da empresa). Abre dentro
 * do Hub; `?modo=baixar` baixa. `?formato=xml` devolve o XML.
 */
export async function GET(request: Request, { params }: { params: Promise<{ chave: string }> }) {
  const { chave } = await params;
  if (!/^[0-9A-Za-z]{20,60}$/.test(chave)) return NextResponse.json({ error: 'Chave inválida.' }, { status: 400 });
  const ctx = await getTenantContext();
  const [doc] = (await withTenant(ctx.companyId, (tx) =>
    // A mesma chave aparece na nota e nos eventos dela (cancelamento…): a
    // DANFSe é da NOTA — pegar o evento dava um documento todo em branco.
    tx.execute(sql`
      SELECT nsu, bool_or(cancelado) OVER () AS cancelada FROM nfse_distribuicao_doc
       WHERE company_id = ${ctx.companyId} AND chave_acesso = ${chave}
       ORDER BY (tipo_documento = 'NFSE') DESC, nsu ASC
       LIMIT 1`),
  )) as unknown as { nsu: string; cancelada: boolean }[];
  if (!doc) return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 });

  const [cert, cfg] = await Promise.all([getCertForTenant(ctx), getNfseConfig(ctx)]);
  if (!cert || !cfg?.cnpj) return NextResponse.json({ error: 'Sem certificado digital para buscar a nota no Emissor Nacional.' }, { status: 409 });

  const xml = await fetchXmlDaNotaPorNsu(cert, cfg.ambiente, cfg.cnpj!, Number(doc.nsu)).catch(() => null);
  if (!xml) return NextResponse.json({ error: 'O Emissor Nacional não devolveu a nota agora. Tente de novo.' }, { status: 502 });

  const url = new URL(request.url);
  if (url.searchParams.get('formato') === 'xml') {
    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml', 'Content-Disposition': `attachment; filename="nfse_${chave}.xml"` } });
  }
  const pdf = await renderDanfsePdf({ ...parseNfseXml(xml, chave), cancelada: Boolean(doc.cancelada) });
  const baixar = url.searchParams.get('modo') === 'baixar';
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="nfse_${chave}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
