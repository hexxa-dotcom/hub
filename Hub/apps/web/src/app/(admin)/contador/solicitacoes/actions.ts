'use server';

import { revalidatePath } from 'next/cache';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { ticket, ticketMessage } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/admin-guard';

export async function replyToTicketAction(ticketId: string, body: string) {
  await requireAdmin();
  const msg = body.trim();
  if (!msg) return { error: 'Digite uma resposta.' };
  try {
    const db = getDb();
    await withDbTimeout(db.insert(ticketMessage).values({ ticketId, body: msg, sender: 'ACCOUNTING' }), 8000);
    await withDbTimeout(db.update(ticket).set({ status: 'IN_PROGRESS' }).where(eq(ticket.id, ticketId)), 8000);
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
