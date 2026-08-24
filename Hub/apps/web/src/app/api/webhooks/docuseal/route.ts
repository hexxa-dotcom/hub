import { NextResponse } from 'next/server';
import { getDb } from '@hexxa/db/client';
import { signatureRequest } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';

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

    const status =
      eventType === 'form.completed' || eventType === 'submission.completed'
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
    const rows = await db
      .select({ id: signatureRequest.id })
      .from(signatureRequest)
      .where(eq(signatureRequest.providerEnvelopeId, String(submissionId)))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json({ error: 'Pedido de assinatura não encontrado' }, { status: 404 });
    }

    await db
      .update(signatureRequest)
      .set({ status, updatedAt: new Date() })
      .where(eq(signatureRequest.id, rows[0].id));

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook do DocuSeal:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 });
  }
}
