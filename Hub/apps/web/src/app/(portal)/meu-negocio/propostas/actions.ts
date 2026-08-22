'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, desc } from '@hexxa/db';
import { proposal, proposalItem } from '@hexxa/db/schema';

export type PropostaItemInput = { descricao: string; qtd: number; valor: number };

export type PropostaRow = {
  id: string;
  numero: string;
  cliente: string;
  titulo: string;
  validade: string;
  status: 'rascunho' | 'enviada' | 'aprovada' | 'rejeitada' | 'expirada';
  criadaEm: string;
  obs: string | null;
  itens: (PropostaItemInput & { id: string })[];
};

export async function listPropostasAction(): Promise<PropostaRow[]> {
  const ctx = await getTenantContext();
  const { propostas, itensReais } = await withTenant(ctx.companyId, async (tx) => {
    const p = await tx.select().from(proposal).where(eq(proposal.companyId, ctx.companyId)).orderBy(desc(proposal.createdAt));
    const all: (typeof proposalItem.$inferSelect)[] = [];
    for (const row of p) {
      const rows = await tx.select().from(proposalItem).where(eq(proposalItem.proposalId, row.id));
      all.push(...rows);
    }
    return { propostas: p, itensReais: all };
  });

  return propostas.map((p) => ({
    id: p.id,
    numero: p.numero,
    cliente: p.cliente,
    titulo: p.titulo,
    validade: p.validade,
    status: p.status as PropostaRow['status'],
    criadaEm: p.createdAt.toISOString().slice(0, 10),
    obs: p.observacoes,
    itens: itensReais
      .filter((i) => i.proposalId === p.id)
      .map((i) => ({ id: i.id, descricao: i.descricao, qtd: Number(i.qtd), valor: Number(i.valor) })),
  }));
}

export type SavePropostaState = { ok: boolean; message: string };

export async function savePropostaAction(input: {
  id?: string;
  numero: string;
  cliente: string;
  titulo: string;
  validade: string;
  obs: string;
  itens: PropostaItemInput[];
}): Promise<SavePropostaState> {
  const ctx = await getTenantContext();

  await withTenant(ctx.companyId, async (tx) => {
    let proposalId = input.id;
    if (proposalId) {
      await tx
        .update(proposal)
        .set({ cliente: input.cliente, titulo: input.titulo, validade: input.validade, observacoes: input.obs || null })
        .where(and(eq(proposal.id, proposalId), eq(proposal.companyId, ctx.companyId)));
      await tx.delete(proposalItem).where(eq(proposalItem.proposalId, proposalId));
    } else {
      const [created] = await tx
        .insert(proposal)
        .values({
          companyId: ctx.companyId,
          numero: input.numero,
          cliente: input.cliente,
          titulo: input.titulo,
          validade: input.validade,
          observacoes: input.obs || null,
        })
        .returning({ id: proposal.id });
      proposalId = created!.id;
    }

    for (const item of input.itens) {
      if (!item.descricao.trim()) continue;
      await tx.insert(proposalItem).values({
        proposalId: proposalId!,
        descricao: item.descricao,
        qtd: String(item.qtd),
        valor: String(item.valor),
      });
    }
  });

  revalidatePath('/meu-negocio/propostas');
  return { ok: true, message: 'Proposta salva.' };
}

export async function setPropostaStatusAction(id: string, status: PropostaRow['status']): Promise<SavePropostaState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.update(proposal).set({ status }).where(and(eq(proposal.id, id), eq(proposal.companyId, ctx.companyId)));
  });
  revalidatePath('/meu-negocio/propostas');
  return { ok: true, message: 'Status atualizado.' };
}

export async function deletePropostaAction(id: string): Promise<SavePropostaState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.delete(proposal).where(and(eq(proposal.id, id), eq(proposal.companyId, ctx.companyId)));
  });
  revalidatePath('/meu-negocio/propostas');
  return { ok: true, message: 'Proposta excluída.' };
}
