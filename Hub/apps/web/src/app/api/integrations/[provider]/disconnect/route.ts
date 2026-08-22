import { NextResponse } from 'next/server';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  try {
    const ctx = await getTenantContext();
    await withTenant(ctx.companyId, async (tx) => {
      return tx
        .update(integrationCredential)
        .set({ active: false })
        .where(and(eq(integrationCredential.companyId, ctx.companyId), eq(integrationCredential.provider, provider)));
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao desconectar integração:', err);
    return NextResponse.json({ error: 'Erro ao desconectar.' }, { status: 500 });
  }
}
