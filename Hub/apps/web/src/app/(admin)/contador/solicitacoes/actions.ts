'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@hexxa/db/client';
import { ticket, ticketMessage } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';

export async function replyToTicketAction(ticketId: string, body: string) {
  const msg = body.trim();
  if (!msg) return { error: 'Digite uma resposta.' };
  try {
    const db = getDb();
    await db.insert(ticketMessage).values({ ticketId, body: msg });
    await db.update(ticket).set({ status: 'IN_PROGRESS' }).where(eq(ticket.id, ticketId));
    revalidatePath('/contador/solicitacoes');
    return { success: true };
  } catch (error) {
    console.error('Erro ao responder solicitação:', error);
    return { error: 'Erro ao enviar resposta.' };
  }
}

export async function resolveTicketAction(ticketId: string) {
  try {
    const db = getDb();
    await db.update(ticket).set({ status: 'RESOLVED' }).where(eq(ticket.id, ticketId));
    revalidatePath('/contador/solicitacoes');
    return { success: true };
  } catch (error) {
    console.error('Erro ao resolver solicitação:', error);
    return { error: 'Erro ao marcar como resolvida.' };
  }
}
