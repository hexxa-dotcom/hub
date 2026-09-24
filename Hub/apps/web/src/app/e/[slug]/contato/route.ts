import { NextResponse } from 'next/server';
import { getFichaPublica, urlDaFicha } from '@/lib/server/ficha-publica';
import { formatarCnpj } from '@/components/ficha/contatos';

export const dynamic = 'force-dynamic';

/** "Salvar contato no celular": o cartão da empresa em vCard (.vcf). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await getFichaPublica(slug);
  if (!f) return new NextResponse('Ficha não encontrada.', { status: 404 });

  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
  const so = (v: string | null) => {
    const d = v?.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '') ?? '';
    return d.length >= 10 ? d : '';
  };
  const site = f.website ? (/^https?:\/\//i.test(f.website) ? f.website : `https://${f.website}`) : null;
  const linhas = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(f.nome.trim())}`,
    `ORG:${esc(f.razaoSocial.trim())}`,
    f.atividadeTexto && `TITLE:${esc(f.atividadeTexto)}`,
    so(f.whatsapp) && `TEL;TYPE=CELL:+55${so(f.whatsapp)}`,
    so(f.telefone) && so(f.telefone) !== so(f.whatsapp) && `TEL;TYPE=WORK:+55${so(f.telefone)}`,
    f.email && `EMAIL;TYPE=WORK:${esc(f.email)}`,
    site && `URL:${esc(site)}`,
    f.cidade && `ADR;TYPE=WORK:;;;${esc(f.cidade)};${esc(f.uf ?? '')};;Brasil`,
    `NOTE:${esc(`CNPJ ${formatarCnpj(f.cnpj)} · ${await urlDaFicha(f.slug)}`)}`,
    'END:VCARD',
  ].filter(Boolean);

  return new NextResponse(linhas.join('\r\n'), {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${f.slug}.vcf"`,
    },
  });
}
