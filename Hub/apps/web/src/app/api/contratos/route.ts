import { NextResponse } from 'next/server';
import { makeContractSignatureService } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const service = makeContractSignatureService();
    const requests = await service.list(ctx);
    return NextResponse.json(requests);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar contratos' },
      { status: 500 },
    );
  }
}
