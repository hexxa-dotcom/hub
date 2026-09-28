import { NextResponse } from 'next/server';
import { getDb, sql, withDbTimeout } from '@hexxa/db';
import { company } from '@hexxa/db/schema';
import { requireAdminApi } from '@/lib/server/admin-guard';

/** Busca global do painel do contador: número (001–999), nome/fantasia/CNPJ da empresa. Mesmo
 * gate de acesso do layout — não dá pra confiar só no fato de a rota estar
 * sob (admin), porque rotas de API não passam pelo layout de página. */
export async function GET(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  // Número da empresa: "8" ou "008" já basta — é para isso que ele existe.
  const numero = /^\d{1,3}$/.test(q) ? Number(q) : null;
  if (q.length < 2 && numero === null) return NextResponse.json({ results: [] });

  const db = getDb();
  const like = `%${q}%`;
  const rows = await withDbTimeout(
    db
      .select({ id: company.id, numero: company.numero, legalName: company.legalName, tradeName: company.tradeName, cnpj: company.cnpj })
      .from(company)
      .where(
        numero !== null
          ? sql`${company.numero} = ${numero}`
          : sql`${company.legalName} ILIKE ${like} OR ${company.tradeName} ILIKE ${like} OR ${company.cnpj} ILIKE ${like}`,
      )
      // O número exato vem primeiro.
      .orderBy(sql`(${company.numero} = ${numero ?? -1}) DESC, ${company.numero}`)
      .limit(8),
    8000,
  );

  return NextResponse.json({ results: rows });
}
