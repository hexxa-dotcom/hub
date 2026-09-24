'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, sql } from '@hexxa/db';
import { proposal, proposalItem } from '@hexxa/db/schema';
import { novoToken, proximoNumero } from '@/lib/server/propostas';
import { origemPublica } from '@/lib/server/origem';

export type Resultado = { ok: boolean; message: string; id?: string; link?: string };

function atualizar() {
  revalidatePath('/meu-negocio/propostas');
  revalidatePath('/relacionamento');
}

/** Cria ou atualiza a proposta. Proposta já respondida pelo cliente não muda. */
export async function salvarPropostaAction(input: {
  id?: string;
  customerId: string;
  titulo: string;
  itens: { descricao: string; qtd: number; valor: number }[];
  recorrencia: 'MENSAL' | 'UNICA';
  prazoMeses: number | null;
  validade: string;
  observacoes: string;
}): Promise<Resultado> {
  const ctx = await getTenantContext();
  const itens = input.itens.filter((i) => i.descricao.trim() && i.valor > 0 && i.qtd > 0);
  if (!input.customerId) return { ok: false, message: 'Escolha o cliente.' };
  if (!input.titulo.trim()) return { ok: false, message: 'Dê um título à proposta.' };
  if (!itens.length) return { ok: false, message: 'Inclua pelo menos um item com valor.' };
  if (!input.validade) return { ok: false, message: 'Informe até quando a proposta vale.' };

  const numero = input.id ? null : await proximoNumero(ctx);
  const id = await withTenant(ctx.companyId, async (tx) => {
    const [cli] = (await tx.execute(sql`SELECT name FROM customer WHERE id = ${input.customerId}::uuid AND company_id = ${ctx.companyId}`)) as unknown as { name: string }[];
    if (!cli) return null;
    const valores = {
      customerId: input.customerId,
      cliente: cli.name,
      titulo: input.titulo.trim(),
      validade: input.validade,
      observacoes: input.observacoes.trim() || null,
      recorrencia: input.recorrencia,
      prazoMeses: input.recorrencia === 'MENSAL' ? input.prazoMeses : null,
    };
    let pid = input.id;
    if (pid) {
      const [atual] = await tx.select({ status: proposal.status }).from(proposal).where(and(eq(proposal.id, pid), eq(proposal.companyId, ctx.companyId)));
      if (!atual || atual.status === 'aprovada' || atual.status === 'rejeitada') return null;
      await tx.update(proposal).set(valores).where(eq(proposal.id, pid));
      await tx.delete(proposalItem).where(eq(proposalItem.proposalId, pid));
    } else {
      const [p] = await tx.insert(proposal).values({ ...valores, companyId: ctx.companyId, numero: numero! }).returning({ id: proposal.id });
      pid = p!.id;
    }
    await tx.insert(proposalItem).values(itens.map((i) => ({ proposalId: pid!, descricao: i.descricao.trim(), qtd: String(i.qtd), valor: String(i.valor) })));
    return pid!;
  });
  if (!id) return { ok: false, message: 'Não dá para alterar: a proposta não existe ou já foi respondida pelo cliente.' };
  atualizar();
  return { ok: true, message: input.id ? 'Proposta atualizada.' : `Proposta ${numero} criada.`, id };
}

/** Gera (ou devolve) o link para o cliente ver e responder, e marca como enviada. */
export async function enviarPropostaAction(id: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  const token = await withTenant(ctx.companyId, async (tx) => {
    const [p] = await tx.select({ token: proposal.publicToken, status: proposal.status }).from(proposal).where(and(eq(proposal.id, id), eq(proposal.companyId, ctx.companyId)));
    if (!p) return null;
    const t = p.token ?? novoToken();
    await tx
      .update(proposal)
      .set({ publicToken: t, ...(p.status === 'rascunho' || p.status === 'expirada' ? { status: 'enviada', sentAt: new Date() } : {}) })
      .where(eq(proposal.id, id));
    return t;
  });
  if (!token) return { ok: false, message: 'Proposta não encontrada.' };
  atualizar();
  return { ok: true, message: 'Link pronto para enviar.', link: `${await origemPublica()}/p/${token}` };
}

export async function excluirPropostaAction(id: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, (tx) => tx.delete(proposal).where(and(eq(proposal.id, id), eq(proposal.companyId, ctx.companyId))));
  atualizar();
  return { ok: true, message: 'Proposta excluída.' };
}

/** Liga a proposta aceita ao contrato que nasceu dela. */
export async function ligarContratoAction(id: string, contratoId: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, (tx) => tx.update(proposal).set({ contractId: contratoId }).where(and(eq(proposal.id, id), eq(proposal.companyId, ctx.companyId))));
  atualizar();
  return { ok: true, message: 'Contrato criado a partir da proposta.' };
}
