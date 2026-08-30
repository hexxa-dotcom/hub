'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, desc } from '@hexxa/db';
import { inArray } from 'drizzle-orm';
import { ticket, ticketMessage } from '@hexxa/db/schema';

export type SolicitacaoStatus = 'solicitado' | 'em_analise' | 'em_andamento' | 'concluido' | 'cancelado';

const STATUS_DB_TO_UI: Record<string, SolicitacaoStatus> = {
  OPEN: 'solicitado',
  WAITING_CLIENT: 'em_analise',
  IN_PROGRESS: 'em_andamento',
  RESOLVED: 'concluido',
  CLOSED: 'cancelado',
};

export type SolicitacaoRow = {
  id: string;
  servico: string;
  descricao: string;
  prioridade: 'normal' | 'urgente';
  status: SolicitacaoStatus;
  criadaEm: string;
  atualizadaEm: string;
  resposta: string | null;
};

/** As solicitações reais viram `ticket` — a mesma fila que o painel do contador (`/contador/solicitacoes`) já lê. */
export async function listSolicitacoesAction(): Promise<SolicitacaoRow[]> {
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
    const primeira = msgs[0];
    const ultima = msgs[msgs.length - 1];
    return {
      id: t.id,
      servico: t.subject,
      descricao: primeira?.body ?? '',
      prioridade: t.priority === 'URGENT' || t.priority === 'HIGH' ? 'urgente' : 'normal',
      status: STATUS_DB_TO_UI[t.status] ?? 'solicitado',
      criadaEm: t.createdAt.toISOString().slice(0, 10),
      atualizadaEm: (ultima?.createdAt ?? t.createdAt).toISOString().slice(0, 10),
      resposta: msgs.length > 1 ? (ultima!.body ?? null) : null,
    };
  });
}

export type SaveSolicitacaoState = { ok: boolean; message: string };

export async function criarSolicitacaoAction(input: {
  servico: string;
  descricao: string;
  prioridade: 'normal' | 'urgente';
}): Promise<SaveSolicitacaoState> {
  const ctx = await getTenantContext();

  await withTenant(ctx.companyId, async (tx) => {
    const [created] = await tx
      .insert(ticket)
      .values({
        companyId: ctx.companyId,
        subject: input.servico,
        priority: input.prioridade === 'urgente' ? 'URGENT' : 'MEDIUM',
        status: 'OPEN',
      })
      .returning({ id: ticket.id });

    await tx.insert(ticketMessage).values({ ticketId: created!.id, body: input.descricao, sender: 'CLIENT' });
  });

  revalidatePath('/mais/servicos');
  revalidatePath('/contador/solicitacoes');
  return { ok: true, message: 'Solicitação enviada para a contabilidade.' };
}

export async function cancelarSolicitacaoAction(id: string): Promise<SaveSolicitacaoState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.update(ticket).set({ status: 'CLOSED' }).where(and(eq(ticket.id, id), eq(ticket.companyId, ctx.companyId)));
  });
  revalidatePath('/mais/servicos');
  return { ok: true, message: 'Solicitação cancelada.' };
}
