'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, desc, sql } from '@hexxa/db';
import { inArray, ne, or, isNull } from 'drizzle-orm';
import { ticket, ticketMessage } from '@hexxa/db/schema';
import { ANEXO_VALIDO, CATEGORIA_DO_PEDIDO } from '@/lib/server/servicos';

/**
 * ATENDIMENTO — a conversa com a contabilidade.
 *
 * Mesma fila `ticket`/`ticket_message` que o contador responde em
 * Solicitações. Os pedidos de Serviços Adicionais (categoria SERVICO) têm a
 * tela deles e não entram aqui.
 */

type Anexo = { dataUrl: string; nome: string } | null;

export type ChatMessage = {
  id: string;
  sender: 'client' | 'accounting';
  text: string;
  em: string;
  anexo: { nome: string; href: string } | null;
};

export type SupportTicketRow = {
  id: string;
  subject: string;
  category: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CLIENT' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  lastMessageAt: string;
  /** A última mensagem é da contabilidade (resposta nova para ler). */
  respondido: boolean;
  messages: ChatMessage[];
};

export async function listSupportTicketsAction(): Promise<SupportTicketRow[]> {
  const ctx = await getTenantContext();
  const { tickets, messages } = await withTenant(ctx.companyId, async (tx) => {
    const t = await tx
      .select()
      .from(ticket)
      .where(and(eq(ticket.companyId, ctx.companyId), or(isNull(ticket.category), ne(ticket.category, CATEGORIA_DO_PEDIDO))))
      .orderBy(desc(ticket.createdAt));
    const all =
      t.length === 0
        ? []
        : await tx
            .select({
              id: ticketMessage.id,
              ticketId: ticketMessage.ticketId,
              sender: ticketMessage.sender,
              body: ticketMessage.body,
              createdAt: ticketMessage.createdAt,
              attachmentName: ticketMessage.attachmentName,
              temAnexo: sql<boolean>`${ticketMessage.attachment} IS NOT NULL`,
            })
            .from(ticketMessage)
            .where(inArray(ticketMessage.ticketId, t.map((row) => row.id)))
            .orderBy(ticketMessage.createdAt);
    return { tickets: t, messages: all };
  });

  return tickets
    .map((t) => {
      const msgs = messages.filter((m) => m.ticketId === t.id);
      const last = msgs[msgs.length - 1];
      return {
        id: t.id,
        subject: t.subject,
        category: t.category,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        lastMessageAt: (last?.createdAt ?? t.createdAt).toISOString(),
        respondido: last?.sender === 'ACCOUNTING' && t.status !== 'CLOSED',
        messages: msgs.map((m) => ({
          id: m.id,
          sender: m.sender === 'ACCOUNTING' ? ('accounting' as const) : ('client' as const),
          text: m.body,
          em: m.createdAt.toISOString(),
          anexo: m.temAnexo ? { nome: m.attachmentName ?? 'anexo', href: `/api/chamados/anexo/${m.id}` } : null,
        })),
      };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export type ActionState = { ok: boolean; message: string };

function atualizar() {
  revalidatePath('/suporte');
  revalidatePath('/contador/solicitacoes');
}

export async function createSupportTicketAction(input: {
  subject: string;
  category: string;
  initialText: string;
  anexo: Anexo;
}): Promise<ActionState & { id?: string }> {
  const ctx = await getTenantContext();
  const assunto = input.subject.trim();
  const texto = input.initialText.trim();
  if (!assunto) return { ok: false, message: 'Dê um assunto à conversa.' };
  if (!texto) return { ok: false, message: 'Escreva o que você precisa.' };
  if (input.anexo && !ANEXO_VALIDO.test(input.anexo.dataUrl)) return { ok: false, message: 'O anexo precisa ser PDF ou imagem.' };

  const id = await withTenant(ctx.companyId, async (tx) => {
    const [created] = await tx
      .insert(ticket)
      .values({ companyId: ctx.companyId, subject: assunto.slice(0, 160), category: input.category || 'Outros', status: 'OPEN' })
      .returning({ id: ticket.id });
    await tx.insert(ticketMessage).values({
      ticketId: created!.id,
      body: texto,
      sender: 'CLIENT',
      attachment: input.anexo?.dataUrl ?? null,
      attachmentName: input.anexo?.nome ?? null,
    });
    return created!.id;
  });

  atualizar();
  return { ok: true, message: 'Conversa aberta. A contabilidade responde por aqui.', id };
}

/** Responde numa conversa. Conversa concluída que recebe mensagem volta a ficar aberta. */
export async function sendSupportMessageAction(ticketId: string, text: string, anexo: Anexo): Promise<ActionState> {
  const ctx = await getTenantContext();
  if (!text.trim() && !anexo) return { ok: false, message: 'Escreva uma mensagem ou anexe um arquivo.' };
  if (anexo && !ANEXO_VALIDO.test(anexo.dataUrl)) return { ok: false, message: 'O anexo precisa ser PDF ou imagem.' };
  const ok = await withTenant(ctx.companyId, async (tx) => {
    const [t] = await tx
      .select({ id: ticket.id })
      .from(ticket)
      .where(and(eq(ticket.id, ticketId), eq(ticket.companyId, ctx.companyId)));
    if (!t) return false;
    await tx.insert(ticketMessage).values({
      ticketId,
      body: text.trim() || '(arquivo anexado)',
      sender: 'CLIENT',
      attachment: anexo?.dataUrl ?? null,
      attachmentName: anexo?.nome ?? null,
    });
    await tx.update(ticket).set({ status: 'OPEN' }).where(eq(ticket.id, ticketId));
    return true;
  });
  if (!ok) return { ok: false, message: 'Conversa não encontrada.' };
  atualizar();
  return { ok: true, message: 'Mensagem enviada.' };
}

/** O cliente dá a conversa por resolvida. */
export async function concluirConversaAction(ticketId: string): Promise<ActionState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, (tx) =>
    tx.update(ticket).set({ status: 'RESOLVED' }).where(and(eq(ticket.id, ticketId), eq(ticket.companyId, ctx.companyId))),
  );
  atualizar();
  return { ok: true, message: 'Conversa concluída.' };
}

export async function scheduleMeetingAction(input: { topic: string; date: string; time: string; formato: string }): Promise<ActionState & { id?: string }> {
  const ctx = await getTenantContext();
  const pauta = input.topic.trim();
  if (!pauta) return { ok: false, message: 'Conte o assunto da reunião.' };
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (!input.date || input.date < hoje) return { ok: false, message: 'Escolha uma data a partir de hoje.' };
  const [y, m, d] = input.date.split('-');
  const id = await withTenant(ctx.companyId, async (tx) => {
    const [created] = await tx
      .insert(ticket)
      .values({ companyId: ctx.companyId, subject: `Reunião: ${pauta}`.slice(0, 160), category: 'Reunião', status: 'OPEN' })
      .returning({ id: ticket.id });
    await tx.insert(ticketMessage).values({
      ticketId: created!.id,
      body: `Gostaria de uma reunião ${input.formato === 'PRESENCIAL' ? 'presencial' : 'por vídeo'} em ${d}/${m}/${y}, às ${input.time}. Assunto: ${pauta}`,
      sender: 'CLIENT',
    });
    return created!.id;
  });
  atualizar();
  return { ok: true, message: 'Pedido de reunião enviado. A contabilidade confirma o horário nesta conversa.', id };
}
