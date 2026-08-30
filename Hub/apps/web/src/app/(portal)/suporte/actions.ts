'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, desc } from '@hexxa/db';
import { inArray } from 'drizzle-orm';
import { ticket, ticketMessage } from '@hexxa/db/schema';

export type ChatMessage = {
  id: string;
  sender: 'client' | 'accounting';
  text: string;
  time: string;
};

export type SupportTicketRow = {
  id: string;
  subject: string;
  category: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CLIENT' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  lastMessageAt: string;
  messages: ChatMessage[];
};

/** Mesma fila `ticket`/`ticket_message` já usada por Serviços Adicionais e lida pelo painel do contador. */
export async function listSupportTicketsAction(): Promise<SupportTicketRow[]> {
  const ctx = await getTenantContext();
  const { tickets, messages } = await withTenant(ctx.companyId, async (tx) => {
    const t = await tx.select().from(ticket).where(eq(ticket.companyId, ctx.companyId)).orderBy(desc(ticket.createdAt));
    const all = t.length === 0
      ? []
      : await tx.select().from(ticketMessage).where(inArray(ticketMessage.ticketId, t.map((row) => row.id))).orderBy(ticketMessage.createdAt);
    return { tickets: t, messages: all };
  });

  return tickets.map((t) => {
    const msgs = messages.filter((m) => m.ticketId === t.id);
    const last = msgs[msgs.length - 1];
    return {
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      lastMessageAt: (last?.createdAt ?? t.createdAt).toISOString(),
      messages: msgs.map((m) => ({
        id: m.id,
        sender: m.sender === 'ACCOUNTING' ? 'accounting' : 'client',
        text: m.body,
        time: m.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      })),
    };
  });
}

export type ActionState = { ok: boolean; message: string };

export async function createSupportTicketAction(input: {
  subject: string;
  category: string;
  initialText: string;
}): Promise<ActionState & { id?: string }> {
  const ctx = await getTenantContext();

  const id = await withTenant(ctx.companyId, async (tx) => {
    const [created] = await tx
      .insert(ticket)
      .values({ companyId: ctx.companyId, subject: input.subject, category: input.category, status: 'OPEN' })
      .returning({ id: ticket.id });
    await tx.insert(ticketMessage).values({ ticketId: created!.id, body: input.initialText, sender: 'CLIENT' });
    return created!.id;
  });

  revalidatePath('/suporte');
  revalidatePath('/contador/solicitacoes');
  return { ok: true, message: 'Chamado aberto.', id };
}

export async function sendSupportMessageAction(ticketId: string, text: string): Promise<ActionState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.insert(ticketMessage).values({ ticketId, body: text, sender: 'CLIENT' });
    await tx
      .update(ticket)
      .set({ status: 'OPEN' })
      .where(and(eq(ticket.id, ticketId), eq(ticket.companyId, ctx.companyId)));
  });
  revalidatePath('/suporte');
  revalidatePath('/contador/solicitacoes');
  return { ok: true, message: 'Mensagem enviada.' };
}

export async function scheduleMeetingAction(input: {
  topic: string;
  date: string;
  time: string;
}): Promise<ActionState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    const [created] = await tx
      .insert(ticket)
      .values({
        companyId: ctx.companyId,
        subject: `Reunião: ${input.topic}`,
        category: 'Reunião',
        status: 'OPEN',
      })
      .returning({ id: ticket.id });
    await tx.insert(ticketMessage).values({
      ticketId: created!.id,
      body: `Solicitação de reunião para ${new Date(input.date + 'T00:00:00').toLocaleDateString('pt-BR')} às ${input.time}. Pauta: ${input.topic}`,
      sender: 'CLIENT',
    });
  });
  revalidatePath('/suporte');
  revalidatePath('/contador/solicitacoes');
  return { ok: true, message: 'Solicitação de reunião enviada. A contabilidade vai confirmar o horário por aqui.' };
}
