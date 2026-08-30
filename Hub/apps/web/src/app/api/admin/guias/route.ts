import { NextResponse } from 'next/server';
import { getDb, AdminTaxGuideRepository, withDbTimeout } from '@hexxa/db';
import { requireAdminApi } from '@/lib/server/admin-guard';

export async function GET(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const companyId = new URL(req.url).searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'companyId é obrigatório' }, { status: 400 });

  try {
    const guias = await withDbTimeout(new AdminTaxGuideRepository().listByCompany(getDb(), companyId), 8000);
    return NextResponse.json(guias);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao listar guias' }, { status: 500 });
  }
}
