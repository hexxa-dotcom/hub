import { NextResponse } from 'next/server';
import { makeContractSignatureService } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';

/**
 * O DocuSeal não documenta um endpoint de "reenvio" de e-mail; esta rota
 * consulta o status mais recente da assinatura na API e atualiza o registro
 * local (equivalente a "atualizar status", mantida na mesma URL para não
 * quebrar as telas que já chamam essa rota).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  try {
    const ctx = await getTenantContext();
    const service = makeContractSignatureService();
    const record = await service.refreshStatus(ctx, publicId);
    if (!record) return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 404 });
    return NextResponse.json({ ok: true, status: record.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao atualizar status' },
      { status: 500 },
    );
  }
}
