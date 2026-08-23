'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and } from '@hexxa/db';
import { partner, financialEntry } from '@hexxa/db/schema';

export type PartnerRow = {
  id: string;
  nome: string;
  cpf: string | null;
  participacao: number;
  prolabore: number;
};

export async function listPartnersAction(): Promise<PartnerRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(partner).where(eq(partner.companyId, ctx.companyId));
  });
  return rows.map((r) => ({
    id: r.id,
    nome: r.name,
    cpf: r.cpf,
    participacao: Number(r.ownershipPct),
    prolabore: Number(r.proLabore),
  }));
}

export type SavePartnerState = { ok: boolean; message: string };

export async function savePartnerAction(input: {
  id?: string;
  nome: string;
  cpf: string;
  participacao: number;
  prolabore: number;
}): Promise<SavePartnerState> {
  const ctx = await getTenantContext();

  await withTenant(ctx.companyId, async (tx) => {
    if (input.id) {
      await tx
        .update(partner)
        .set({
          name: input.nome,
          cpf: input.cpf || null,
          ownershipPct: String(input.participacao),
          proLabore: String(input.prolabore),
        })
        .where(and(eq(partner.id, input.id), eq(partner.companyId, ctx.companyId)));
    } else {
      await tx.insert(partner).values({
        companyId: ctx.companyId,
        name: input.nome,
        cpf: input.cpf || null,
        ownershipPct: String(input.participacao),
        proLabore: String(input.prolabore),
      });
    }
  });

  revalidatePath('/minha-contabilidade/socios');
  revalidatePath('/minha-contabilidade/termometro-tributario');
  revalidatePath('/cliente');
  return { ok: true, message: 'Sócio salvo.' };
}

export async function deletePartnerAction(id: string): Promise<SavePartnerState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.delete(partner).where(and(eq(partner.id, id), eq(partner.companyId, ctx.companyId)));
  });
  revalidatePath('/minha-contabilidade/socios');
  revalidatePath('/minha-contabilidade/termometro-tributario');
  return { ok: true, message: 'Sócio removido.' };
}

/** Lança o pró-labore do mês como conta a pagar real no Hub Financeiro (não fica só no cadastro). */
export async function lancarProLaboreMesAction(partnerId: string): Promise<SavePartnerState> {
  const ctx = await getTenantContext();

  const [p] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(partner).where(and(eq(partner.id, partnerId), eq(partner.companyId, ctx.companyId)));
  });
  if (!p) return { ok: false, message: 'Sócio não encontrado.' };
  if (Number(p.proLabore) <= 0) return { ok: false, message: 'Cadastre um valor de pró-labore antes de lançar.' };

  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 5).toISOString().split('T')[0]!;
  const refMonth = dueDate.substring(0, 8) + '01';

  await withTenant(ctx.companyId, async (tx) => {
    const already = await tx
      .select({ id: financialEntry.id })
      .from(financialEntry)
      .where(
        and(
          eq(financialEntry.companyId, ctx.companyId),
          eq(financialEntry.source, 'PROLABORE'),
          eq(financialEntry.sourceId, p.id),
          eq(financialEntry.referenceMonth, refMonth),
        ),
      );
    if (already.length > 0) return;

    await tx.insert(financialEntry).values({
      companyId: ctx.companyId,
      type: 'PAYABLE',
      description: `Pró-labore — ${p.name}`,
      amount: p.proLabore,
      dueDate,
      referenceMonth: refMonth,
      status: 'PENDING',
      source: 'PROLABORE',
      sourceId: p.id,
    });
  });

  revalidatePath('/minha-contabilidade/socios');
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');
  return { ok: true, message: `Pró-labore de ${p.name} lançado no Hub Financeiro.` };
}
