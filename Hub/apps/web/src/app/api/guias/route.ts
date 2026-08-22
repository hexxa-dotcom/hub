import { NextResponse } from 'next/server';
import { DrizzleTaxGuideRepository } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const guias = await new DrizzleTaxGuideRepository().listAll(ctx);
    return NextResponse.json(guias);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao listar guias' }, { status: 500 });
  }
}
