import { NextResponse } from 'next/server';
import { getDb } from '@hexxa/db/client';
import { financialEntry, contract } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/webhooks/asaas
 * Recebe eventos de cobrança do Asaas e baixa o recebível correspondente.
 *
 * Configure em Asaas > Configurações > Webhooks:
 *   URL: https://seu-dominio.com/api/webhooks/asaas
 *   Token de autenticação: valor de ASAAS_WEBHOOK_TOKEN
 *
 * NÃO emite NFSe automaticamente — a emissão fiscal exige revisão manual do
 * usuário (ver /meu-negocio/nfse), não pode ser fabricada aqui.
 */
export async function POST(req: Request) {
  const token = req.headers.get('asaas-access-token');
  if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
      const payment = body.payment;

      // Assumimos que o externalReference do Asaas (na subscription ou no payment)
      // contém o ID do Contrato no nosso DB.
      const contractId = payment?.externalReference;
      if (!contractId) {
        return NextResponse.json({ error: 'Missing externalReference (contractId)' }, { status: 400 });
      }

      const db = getDb();

      const contracts = await db.select().from(contract).where(eq(contract.id, contractId));
      if (!contracts || contracts.length === 0) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      const c = contracts[0]!;
      const referenceMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]!;

      await db.insert(financialEntry).values({
        companyId: c.companyId,
        type: 'RECEIVABLE',
        status: 'PAID',
        description: `Recebimento Ref. ${c.title}`,
        amount: String(payment.value),
        dueDate: payment.dueDate || new Date().toISOString().split('T')[0]!,
        referenceMonth,
        source: 'ASAAS',
        externalId: payment.id,
      });

      return NextResponse.json({ success: true, message: 'Recebível baixado.' });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Erro no Webhook do Asaas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
