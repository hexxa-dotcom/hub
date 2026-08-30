import { NextResponse } from 'next/server';
import { getDb, withDbTimeout, withTenant, eq, and } from '@hexxa/db';
import { integrationCredential, businessContract, financialEntry, notification } from '@hexxa/db/schema';
import { decryptSecret } from '@/lib/server/secret-crypto';
import { normalizeRevenueSaasPayload } from '@/lib/server/revenue-saas-normalize';

/**
 * Webhook do SaaS de faturamento do cliente (ex.: telemedicina) — POR
 * TENANT (diferente de Asaas/DocuSeal, que usam 1 segredo global pra toda a
 * plataforma): o companyId vem na própria URL, autenticado pelo segredo
 * gerado em configuracoes/integracoes/webhook-repasse.
 *
 * Cada evento gera até 2 lançamentos:
 *  1. Receita da empresa (sempre, se o evento for válido).
 *  2. Repasse do prestador (só se o evento trouxer um providerId que bata
 *     com um business_contract SERVICO/SAIDA ATIVO com repassePercent).
 */
export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params;
    const providedSecret = req.headers.get('x-webhook-secret');

    const db = getDb();
    const [cred] = await withDbTimeout(
      db
        .select()
        .from(integrationCredential)
        .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'webhook-repasse'), eq(integrationCredential.active, true))),
      8000,
    );

    const storedEncrypted = (cred?.secretRef as { webhook_secret_encrypted?: string } | null)?.webhook_secret_encrypted;
    const secret = decryptSecret(storedEncrypted);
    if (!cred || !secret || !providedSecret || providedSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = normalizeRevenueSaasPayload(await req.json());
    if (!event) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const [existing] = await withDbTimeout(
      db.select({ id: financialEntry.id }).from(financialEntry).where(eq(financialEntry.externalId, event.externalId)),
      8000,
    );
    if (existing) {
      return NextResponse.json({ received: true, message: 'Evento já processado' });
    }

    const refMonth = event.occurredAt.slice(0, 7) + '-01';

    await withTenant(companyId, async (tx) => {
      await tx.insert(financialEntry).values({
        companyId,
        type: 'RECEIVABLE',
        status: 'PAID',
        description: event.description,
        amount: String(event.amount),
        dueDate: event.occurredAt,
        referenceMonth: refMonth,
        source: 'INTEGRATION_SAAS',
        sourceId: cred.id,
        externalId: event.externalId,
        paidAt: event.occurredAt,
      });

      if (!event.providerId) return;

      const [medico] = await tx
        .select()
        .from(businessContract)
        .where(
          and(
            eq(businessContract.companyId, companyId),
            eq(businessContract.externalProviderId, event.providerId),
            eq(businessContract.status, 'ATIVO'),
          ),
        )
        .limit(1);

      if (!medico || !medico.repassePercent) {
        await tx.insert(notification).values({
          companyId,
          severity: 'WARNING',
          title: 'Repasse não vinculado',
          body: `Evento ${event.externalId} (R$ ${event.amount.toFixed(2)}) veio com o ID de prestador "${event.providerId}", mas não há contrato ativo com repasse configurado pra esse ID. A receita foi lançada, o repasse não.`,
        });
        return;
      }

      const valorRepasse = event.amount * (Number(medico.repassePercent) / 100);
      await tx.insert(financialEntry).values({
        companyId,
        type: 'PAYABLE',
        status: 'PENDING',
        description: `Repasse — ${medico.partyName} (${medico.repassePercent}%)`,
        amount: String(valorRepasse.toFixed(2)),
        dueDate: event.occurredAt,
        referenceMonth: refMonth,
        source: 'INTEGRATION_SAAS',
        sourceId: medico.id,
        externalId: `${event.externalId}:repasse`,
      });
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook de faturamento (revenue-saas):', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 });
  }
}
