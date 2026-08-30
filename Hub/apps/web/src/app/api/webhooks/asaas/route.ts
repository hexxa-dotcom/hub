import { NextResponse } from 'next/server';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { financialEntry, contract } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/webhooks/asaas
 * Recebe eventos de cobrança do Asaas e baixa o recebível correspondente —
 * é a integração automática de faturamento via gateway (Pix/boleto/cartão),
 * ao lado da NFSe e da Venda avulsa (/meu-negocio/vendas).
 *
 * Configure em Asaas > Configurações > Webhooks:
 *   URL: https://seu-dominio.com/api/webhooks/asaas
 *   Token de autenticação: valor de ASAAS_WEBHOOK_TOKEN
 *
 * Reconciliação em duas camadas:
 *   1) Se a cobrança já nasceu vinculada a um financial_entry (Pix gerado a
 *      partir de um lançamento existente, via generatePixCharge com
 *      financialEntryId — o external_id já foi gravado na criação), o
 *      webhook só baixa esse lançamento. Idempotente: reenvio do mesmo
 *      evento não duplica nada, só confirma um status já PAID.
 *   2) Senão, cai no fluxo antigo de cobrança recorrente de contrato: usa
 *      payment.externalReference como o id do `contract`, e cria um
 *      financial_entry novo (source='ASAAS').
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

    if (body.event !== 'PAYMENT_RECEIVED' && body.event !== 'PAYMENT_CONFIRMED') {
      return NextResponse.json({ received: true });
    }

    const payment = body.payment;
    if (!payment?.id) {
      return NextResponse.json({ error: 'Missing payment.id' }, { status: 400 });
    }

    const db = getDb();

    // Camada 1: lançamento já vinculado a esta cobrança (por external_id).
    const [linked] = await withDbTimeout(
      db
        .select()
        .from(financialEntry)
        .where(eq(financialEntry.externalId, String(payment.id))),
      8000,
    );

    if (linked) {
      if (linked.status !== 'PAID') {
        await withDbTimeout(
          db
            .update(financialEntry)
            .set({ status: 'PAID', paidAt: new Date().toISOString().split('T')[0]! })
            .where(eq(financialEntry.id, linked.id)),
          8000,
        );
      }
      return NextResponse.json({ success: true, message: 'Lançamento baixado via Asaas.' });
    }

    // Camada 2: cobrança recorrente de contrato (externalReference = contract.id).
    const contractId = payment.externalReference;
    if (!contractId) {
      return NextResponse.json({ error: 'Pagamento sem lançamento nem contrato vinculado' }, { status: 404 });
    }

    const contracts = await withDbTimeout(db.select().from(contract).where(eq(contract.id, contractId)), 8000);
    if (!contracts || contracts.length === 0) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const c = contracts[0]!;
    const referenceMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]!;

    await withDbTimeout(
      db.insert(financialEntry).values({
        companyId: c.companyId,
        type: 'RECEIVABLE',
        status: 'PAID',
        description: `Recebimento Ref. ${c.title}`,
        amount: String(payment.value),
        dueDate: payment.dueDate || new Date().toISOString().split('T')[0]!,
        referenceMonth,
        source: 'ASAAS',
        externalId: String(payment.id),
      }),
      8000,
    );

    return NextResponse.json({ success: true, message: 'Recebível baixado.' });
  } catch (error: any) {
    console.error('Erro no Webhook do Asaas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
