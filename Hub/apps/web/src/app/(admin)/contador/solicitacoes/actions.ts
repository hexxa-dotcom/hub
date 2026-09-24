'use server';

import { revalidatePath } from 'next/cache';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { ticket, ticketMessage } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/admin-guard';

/**
 * Responde o chamado — com anexo, se houver (a certidão pedida, por exemplo,
 * que vai também para os Documentos da Empresa). `pedirAoCliente` deixa o
 * chamado "aguardando o cliente", e ele vê o aviso nos pedidos.
 */
export async function replyToTicketAction(
  ticketId: string,
  body: string,
  anexo?: { dataUrl: string; nome: string } | null,
  pedirAoCliente = false,
) {
  await requireAdmin();
  const msg = body.trim();
  if (!msg && !anexo) return { error: 'Digite uma resposta.' };
  if (anexo && !/^data:(application\/pdf|image\/(png|jpe?g|webp));base64,/.test(anexo.dataUrl)) return { error: 'O anexo precisa ser PDF ou imagem.' };
  try {
    const db = getDb();
    await withDbTimeout(
      db.insert(ticketMessage).values({
        ticketId,
        body: msg || '(arquivo anexado)',
        sender: 'ACCOUNTING',
        attachment: anexo?.dataUrl ?? null,
        attachmentName: anexo?.nome ?? null,
      }),
      8000,
    );
    await withDbTimeout(db.update(ticket).set({ status: pedirAoCliente ? 'WAITING_CLIENT' : 'IN_PROGRESS' }).where(eq(ticket.id, ticketId)), 8000);
    revalidatePath('/mais/servicos');
    revalidatePath('/minha-contabilidade/arquivos');
    revalidatePath('/contador/solicitacoes');
    return { success: true };
  } catch (error) {
    console.error('Erro ao responder solicitação:', error);
    return { error: 'Erro ao enviar resposta.' };
  }
}

export async function resolveTicketAction(ticketId: string) {
  await requireAdmin();
  try {
    const db = getDb();
    await withDbTimeout(db.update(ticket).set({ status: 'RESOLVED' }).where(eq(ticket.id, ticketId)), 8000);
    revalidatePath('/contador/solicitacoes');
    return { success: true };
  } catch (error) {
    console.error('Erro ao resolver solicitação:', error);
    return { error: 'Erro ao marcar como resolvida.' };
  }
}
