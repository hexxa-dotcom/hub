import { NextResponse } from 'next/server';
import { withTenant, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { danfseDePrevia, type PedidoDePrevia } from '@/lib/server/danfse-exemplo';
import { aliquotaDoFaturamento } from '@/lib/server/bussola';

export const dynamic = 'force-dynamic';

/**
 * PRÉVIA DA NOTA — a DANFSe de uma nota que ainda não foi emitida.
 *
 * POST: os dados do formulário de emissão (o "Visualizar" antes de emitir).
 * GET ?agendada=<id>: a próxima nota de uma emissão agendada.
 */

const pdf = (buf: Buffer, baixar: boolean) =>
  new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="previa-da-nota.pdf"`,
      'Cache-Control': 'no-store',
    },
  });

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  const p = (await request.json().catch(() => null)) as PedidoDePrevia | null;
  if (!p?.tomador?.nome || !(p.valor > 0)) return NextResponse.json({ error: 'Preencha para quem, o valor e o serviço.' }, { status: 400 });
  return pdf(await danfseDePrevia(ctx.companyId, { ...p, descricao: String(p.descricao ?? ''), informacoes: String(p.informacoes ?? '') }), false);
}

export async function GET(request: Request) {
  const ctx = await getTenantContext();
  const url = new URL(request.url);
  const id = url.searchParams.get('agendada') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Agendamento inválido.' }, { status: 400 });
  const [a] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT a.descricao, a.valor::float, to_char(a.proxima_data, 'YYYY-MM-DD') AS data, a.perfil_id::text AS "perfilId",
             c.name AS nome, coalesce(c.document, '') AS documento, c.email, c.phone, c.endereco
        FROM emissao_agendada a JOIN customer c ON c.id = a.customer_id
       WHERE a.id = ${id}::uuid AND a.company_id = ${ctx.companyId}`),
  )) as unknown as {
    descricao: string;
    valor: number;
    data: string;
    perfilId: string | null;
    nome: string;
    documento: string;
    email: string | null;
    phone: string | null;
    endereco: PedidoDePrevia['tomador']['endereco'];
  }[];
  if (!a) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });
  const taxa = await aliquotaDoFaturamento(ctx).catch(() => ({ aliquota: 0 }));
  const buf = await danfseDePrevia(ctx.companyId, {
    tomador: { nome: a.nome, documento: a.documento, email: a.email ?? '', telefone: a.phone ?? '', endereco: a.endereco },
    descricao: a.descricao,
    valor: a.valor,
    competencia: a.data,
    perfilId: a.perfilId,
    taxa: taxa.aliquota,
    agendadaPara: a.data,
  });
  return pdf(buf, url.searchParams.get('modo') === 'baixar');
}
