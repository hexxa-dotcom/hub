'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, sql } from '@hexxa/db';
import { ticket, ticketMessage } from '@hexxa/db/schema';
import { ANEXO_VALIDO, CATEGORIA_DO_PEDIDO, protocoloDoPedido } from '@/lib/server/servicos';

type Anexo = { dataUrl: string; nome: string } | null;
export type Resultado = { ok: boolean; message: string };

function atualizar() {
  revalidatePath('/mais/servicos');
  revalidatePath('/contador/solicitacoes');
  revalidatePath('/minha-contabilidade/arquivos');
}

/** Pede um serviço: vira um chamado SERVICO, com a descrição (e o anexo) como primeira mensagem. */
export async function pedirServicoAction(input: { servico: string; descricao: string; urgente: boolean; anexo: Anexo }): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!input.servico.trim()) return { ok: false, message: 'Escolha o serviço.' };
  if (input.descricao.trim().length < 5) return { ok: false, message: 'Conte em poucas palavras o que você precisa.' };
  if (input.anexo && !ANEXO_VALIDO.test(input.anexo.dataUrl)) return { ok: false, message: 'O anexo precisa ser PDF ou imagem.' };

  const id = await withTenant(ctx.companyId, async (tx) => {
    const [t] = await tx
      .insert(ticket)
      .values({
        companyId: ctx.companyId,
        subject: input.servico.trim().slice(0, 160),
        category: CATEGORIA_DO_PEDIDO,
        priority: input.urgente ? 'URGENT' : 'MEDIUM',
        status: 'OPEN',
      })
      .returning({ id: ticket.id });
    await tx.insert(ticketMessage).values({
      ticketId: t!.id,
      sender: 'CLIENT',
      body: input.descricao.trim(),
      attachment: input.anexo?.dataUrl ?? null,
      attachmentName: input.anexo?.nome ?? null,
    });
    return t!.id;
  });
  atualizar();
  return { ok: true, message: `Pedido ${protocoloDoPedido(id)} enviado. A contabilidade responde por aqui.` };
}

/** O cliente responde no pedido. Pedido concluído que recebe resposta volta a ficar aberto. */
export async function responderPedidoAction(pedidoId: string, texto: string, anexo: Anexo): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!texto.trim() && !anexo) return { ok: false, message: 'Escreva uma mensagem ou anexe um arquivo.' };
  if (anexo && !ANEXO_VALIDO.test(anexo.dataUrl)) return { ok: false, message: 'O anexo precisa ser PDF ou imagem.' };
  const ok = await withTenant(ctx.companyId, async (tx) => {
    const [t] = await tx
      .select({ status: ticket.status })
      .from(ticket)
      .where(and(eq(ticket.id, pedidoId), eq(ticket.companyId, ctx.companyId), eq(ticket.category, CATEGORIA_DO_PEDIDO)));
    if (!t || t.status === 'CLOSED') return false;
    await tx.insert(ticketMessage).values({
      ticketId: pedidoId,
      sender: 'CLIENT',
      body: texto.trim() || '(arquivo anexado)',
      attachment: anexo?.dataUrl ?? null,
      attachmentName: anexo?.nome ?? null,
    });
    // Respondeu o que a contabilidade pediu, ou reabriu um concluído: volta para a fila.
    if (t.status === 'WAITING_CLIENT' || t.status === 'RESOLVED') {
      await tx.execute(sql`UPDATE ticket SET status = 'OPEN' WHERE id = ${pedidoId}`);
    }
    return true;
  });
  if (!ok) return { ok: false, message: 'Pedido não encontrado ou cancelado.' };
  atualizar();
  return { ok: true, message: 'Mensagem enviada.' };
}

export async function cancelarPedidoAction(pedidoId: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, (tx) =>
    tx
      .update(ticket)
      .set({ status: 'CLOSED' })
      .where(and(eq(ticket.id, pedidoId), eq(ticket.companyId, ctx.companyId), eq(ticket.category, CATEGORIA_DO_PEDIDO))),
  );
  atualizar();
  return { ok: true, message: 'Pedido cancelado.' };
}
