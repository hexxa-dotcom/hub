import { NextResponse } from 'next/server';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { signatureRequest, businessContract, lease, property } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { gerarLancamentosDoContrato, jaTemLancamentosDoContrato, gerarLancamentosDoAluguel, jaTemLancamentosDoAluguel } from '@/lib/server/contract-financials';

type EnvelopeStatus = 'SIGNED' | 'REFUSED' | 'EXPIRED';

/**
 * Ativa (ou recusa/expira) o business_contract/lease ligado a este pedido de
 * assinatura — o wizard unificado de Contratos só lança financeiro depois
 * que o DocuSeal confirma SIGNED. Contrato espelho (mirrorContractId) usa o
 * MESMO signature_request_id (um envelope, dois signatários), então a busca
 * por signatureRequestId já traz os dois lados de uma vez.
 */
async function activateLinkedRecords(signatureRequestId: string, status: EnvelopeStatus, refusalReason: string | null) {
  const db = getDb();

  const contracts = await withDbTimeout(
    db.select().from(businessContract).where(eq(businessContract.signatureRequestId, signatureRequestId)),
    8000,
  );
  for (const c of contracts) {
    try {
      if (status === 'SIGNED') {
        if (c.status === 'ATIVO' || (await jaTemLancamentosDoContrato(c.companyId, c.id))) continue;
        const today = new Date().toISOString().split('T')[0]!;
        await withDbTimeout(
          db.update(businessContract).set({ status: 'ATIVO', signingDate: today, updatedAt: new Date() }).where(eq(businessContract.id, c.id)),
          8000,
        );
        await gerarLancamentosDoContrato({
          companyId: c.companyId,
          contractId: c.id,
          tipo: c.type === 'ENTRADA' || c.type === 'MUTUO_ATIVO' ? 'RECEBER' : 'PAGAR',
          descricao: `[Contrato] ${c.title} — ${c.partyName}`,
          valor: Number(c.value),
          dueDay: c.dueDay,
          startDate: c.startDate,
          endDate: c.endDate,
        });
      } else if (status === 'REFUSED') {
        await withDbTimeout(
          db.update(businessContract).set({ status: 'RECUSADO', refusalReason, updatedAt: new Date() }).where(eq(businessContract.id, c.id)),
          8000,
        );
      } else {
        await withDbTimeout(
          db.update(businessContract).set({ status: 'EXPIRADO', updatedAt: new Date() }).where(eq(businessContract.id, c.id)),
          8000,
        );
      }
    } catch (err) {
      console.error(`Erro ao ativar business_contract ${c.id} a partir do webhook DocuSeal:`, err);
    }
  }

  const leases = await withDbTimeout(
    db.select().from(lease).where(eq(lease.signatureRequestId, signatureRequestId)),
    8000,
  );
  for (const l of leases) {
    try {
      if (status === 'SIGNED') {
        if (l.status === 'ACTIVE' || (await jaTemLancamentosDoAluguel(l.companyId, l.id))) continue;
        await withDbTimeout(
          db.update(lease).set({ status: 'ACTIVE' }).where(eq(lease.id, l.id)),
          8000,
        );
        await withDbTimeout(
          db.update(property).set({ status: 'RENTED' }).where(eq(property.id, l.propertyId)),
          8000,
        );
        await gerarLancamentosDoAluguel({
          companyId: l.companyId,
          leaseId: l.id,
          descricao: `[Aluguel] ${l.lesseeName}`,
          valor: Number(l.monthlyRent),
          startDate: l.startDate ?? l.adjustmentAnchor,
          endDate: l.endDate,
        });
      } else {
        // Recusado ou expirado antes de assinar — sem estado dedicado em
        // lease_status, volta pra CANCELED (não havia lançamento gerado
        // ainda). O imóvel tinha sido reservado (property.status='RENTED')
        // assim que o contrato nasceu — libera de volta pra AVAILABLE.
        await withDbTimeout(
          db.update(lease).set({ status: 'CANCELED' }).where(eq(lease.id, l.id)),
          8000,
        );
        await withDbTimeout(
          db.update(property).set({ status: 'AVAILABLE' }).where(eq(property.id, l.propertyId)),
          8000,
        );
      }
    } catch (err) {
      console.error(`Erro ao ativar lease ${l.id} a partir do webhook DocuSeal:`, err);
    }
  }
}

// Webhook do DocuSeal — atualiza o status local quando o signatário assina,
// recusa ou a submissão expira. Consulta direta via getDb() (sem tenant
// context — o registro já é achado pelo provider_envelope_id, que é único).
//
// Autenticação: a doc pública do DocuSeal não deixa claro um esquema de
// assinatura HMAC por webhook, então protegemos com um segredo compartilhado
// na própria URL. Configure o webhook no painel do DocuSeal apontando para
// `.../api/webhooks/docuseal?secret=<DOCUSEAL_WEBHOOK_SECRET>` — sem isso,
// qualquer pessoa que descobrisse um provider_envelope_id poderia forjar uma
// assinatura como concluída.
export async function POST(req: Request) {
  try {
    const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
    const providedSecret = new URL(req.url).searchParams.get('secret');
    if (!secret || providedSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const eventType: string = body.event_type ?? body.event;
    const data = body.data ?? body;
    // Eventos 'form.*' trazem o submitter em `data`: o id da submissão vem
    // em `data.submission.id` (ou `data.submission_id`) — `data.id` ali é o
    // id do submitter, não da submissão. Eventos 'submission.*' trazem a
    // submissão em `data`: `data.id` é o id da submissão diretamente.
    const submissionId = eventType?.startsWith('submission.')
      ? data.id
      : (data.submission?.id ?? data.submission_id);

    if (!submissionId) {
      return NextResponse.json({ error: 'Payload sem submission id' }, { status: 400 });
    }

    // 'form.completed' dispara por SIGNATÁRIO (um evento por pessoa que
    // assina); 'submission.completed' dispara UMA vez, quando TODOS os
    // signatários do envelope terminaram. Contrato espelho manda os dois
    // lados assinarem o MESMO envelope — se ativássemos em 'form.completed',
    // o contrato entraria em vigor com só uma das partes tendo assinado.
    // Por isso só 'submission.completed' conta como SIGNED aqui.
    const status =
      eventType === 'submission.completed'
        ? 'SIGNED'
        : eventType === 'form.declined'
          ? 'REFUSED'
          : eventType === 'submission.expired'
            ? 'EXPIRED'
            : null;

    if (!status) {
      return NextResponse.json({ received: true });
    }

    const db = getDb();
    const rows = await withDbTimeout(
      db
        .select({ id: signatureRequest.id })
        .from(signatureRequest)
        .where(eq(signatureRequest.providerEnvelopeId, String(submissionId)))
        .limit(1),
      8000,
    );

    if (!rows[0]) {
      return NextResponse.json({ error: 'Pedido de assinatura não encontrado' }, { status: 404 });
    }

    await withDbTimeout(
      db
        .update(signatureRequest)
        .set({ status, updatedAt: new Date() })
        .where(eq(signatureRequest.id, rows[0].id)),
      8000,
    );

    const refusalReason: string | null = data?.decline_reason ?? data?.declined_reason ?? data?.reason ?? null;
    await activateLinkedRecords(rows[0].id, status, refusalReason);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook do DocuSeal:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 });
  }
}
