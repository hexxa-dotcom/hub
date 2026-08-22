import { NextResponse } from 'next/server';
import { getDb, sql } from '@hexxa/db';
import { company } from '@hexxa/db/schema';
import { requireAdminApi } from '@/lib/server/admin-guard';

/** Busca global do painel do contador: nome/fantasia/CNPJ da empresa. Mesmo
 * gate de acesso do layout — não dá pra confiar só no fato de a rota estar
 * sob (admin), porque rotas de API não passam pelo layout de página. */
export async function GET(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  const db = getDb();
  const like = `%${q}%`;
  const rows = await db
    .select({ id: company.id, legalName: company.legalName, tradeName: company.tradeName, cnpj: company.cnpj })
    .from(company)
    .where(sql`${company.legalName} ILIKE ${like} OR ${company.tradeName} ILIKE ${like} OR ${company.cnpj} ILIKE ${like}`)
    .limit(8);

  return NextResponse.json({ results: rows });
}
