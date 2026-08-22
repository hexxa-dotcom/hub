import { NextRequest, NextResponse } from 'next/server';
import {
  createSubscription,
  nextDueDate,
  PLANO_VALOR,
  AsaasError,
  type BillingType,
} from '@/lib/asaas';
import { requireAdminApi } from '@/lib/server/admin-guard';

/** POST /api/asaas/subscriptions
 *  Body: { customerId, plano, billingType, clienteId }
 *  Cria assinatura mensal para o cliente no plano selecionado.
 *  Só o contador/admin gerencia assinatura de qualquer empresa por aqui.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { customerId, plano, billingType = 'PIX', clienteId } = await req.json();

    if (!customerId || !plano) {
      return NextResponse.json({ error: 'customerId e plano são obrigatórios' }, { status: 400 });
    }

    const value = PLANO_VALOR[plano];
    if (!value) {
      return NextResponse.json({ error: `Plano inválido: ${plano}` }, { status: 400 });
    }

    const subscription = await createSubscription({
      customer: customerId,
      billingType: billingType as BillingType,
      value,
      nextDueDate: nextDueDate(),
      description: `Hexx Hub Digital — Plano ${plano}`,
      externalReference: clienteId,
    });

    return NextResponse.json({ subscription });
  } catch (err) {
    if (err instanceof AsaasError) {
      return NextResponse.json({ error: 'Erro Asaas', detail: err.body }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
