import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscription,
  updateSubscription,
  cancelSubscription,
  listSubscriptionPayments,
  PLANO_VALOR,
  AsaasError,
  type BillingType,
} from '@/lib/asaas';

type Params = { params: Promise<{ id: string }> };

/** GET /api/asaas/subscriptions/[id]?payments=true */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const url = new URL(_req.url);
    const withPayments = url.searchParams.get('payments') === 'true';

    const [subscription, paymentsRes] = await Promise.all([
      getSubscription(id),
      withPayments ? listSubscriptionPayments(id) : Promise.resolve(null),
    ]);

    return NextResponse.json({ subscription, payments: paymentsRes?.data ?? null });
  } catch (err) {
    if (err instanceof AsaasError) {
      return NextResponse.json({ error: 'Erro Asaas', detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/** PUT /api/asaas/subscriptions/[id]
 *  Body: { plano?, billingType? } — troca plano/forma de pagamento
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { plano, billingType } = await req.json();

    const updates: Parameters<typeof updateSubscription>[1] = {};
    if (plano) {
      const value = PLANO_VALOR[plano];
      if (!value) return NextResponse.json({ error: `Plano inválido: ${plano}` }, { status: 400 });
      updates.value = value;
      updates.description = `Hexx Hub Digital — Plano ${plano}`;
    }
    if (billingType) updates.billingType = billingType as BillingType;

    const subscription = await updateSubscription(id, updates);
    return NextResponse.json({ subscription });
  } catch (err) {
    if (err instanceof AsaasError) {
      return NextResponse.json({ error: 'Erro Asaas', detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/** DELETE /api/asaas/subscriptions/[id] — cancela */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const result = await cancelSubscription(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AsaasError) {
      return NextResponse.json({ error: 'Erro Asaas', detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
