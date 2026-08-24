'use server';

import { revalidatePath } from 'next/cache';
import { withTenant, eq, and, desc, sql, customer } from '@hexxa/db';
import { sale, financialEntry } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export type PaymentMethod = 'PIX' | 'CARTAO' | 'BOLETO' | 'DINHEIRO' | 'OUTRO';

export type SaleRow = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  saleDate: string;
  received: boolean;
  notes: string | null;
  createdAt: string;
  /** id do financial_entry gerado por esta venda — usado pra cobrar via Pix (Asaas). */
  financialEntryId: string | null;
};

export type SaleFormState = { ok: boolean; message: string };

/** Lista as vendas avulsas do tenant, mais recentes primeiro. */
export async function listSalesAction(): Promise<SaleRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        id: sale.id,
        customerId: sale.customerId,
        customerName: customer.name,
        description: sale.description,
        amount: sale.amount,
        paymentMethod: sale.paymentMethod,
        saleDate: sale.saleDate,
        received: sale.received,
        notes: sale.notes,
        createdAt: sale.createdAt,
        financialEntryId: financialEntry.id,
      })
      .from(sale)
      .leftJoin(customer, eq(sale.customerId, customer.id))
      .leftJoin(financialEntry, and(eq(financialEntry.source, 'VENDA'), eq(financialEntry.sourceId, sale.id)))
      .where(eq(sale.companyId, ctx.companyId))
      .orderBy(desc(sale.saleDate), desc(sale.createdAt));
  });

  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: r.customerName,
    description: r.description,
    amount: Number(r.amount),
    paymentMethod: (r.paymentMethod as PaymentMethod) ?? 'OUTRO',
    saleDate: r.saleDate,
    received: r.received,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    financialEntryId: r.financialEntryId,
  }));
}

/** Clientes do tenant, pra alimentar o select do formulário de venda. */
export async function listCustomersForSaleAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await getTenantContext();
  return withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({ id: customer.id, name: customer.name })
      .from(customer)
      .where(eq(customer.companyId, ctx.companyId));
  });
}

/**
 * Registra uma venda avulsa (sem NFSe) — segunda fonte de faturamento além
 * da nota fiscal. Sempre gera um financial_entry RECEIVABLE (source='VENDA')
 * pra entrar no mesmo fluxo de caixa/DRE que uma nota gerava sozinha até aqui.
 */
export async function createSaleAction(input: {
  customerId: string | null;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  saleDate: string;
  received: boolean;
  notes: string | null;
}): Promise<SaleFormState> {
  if (!input.description.trim() || !(input.amount > 0) || !input.saleDate) {
    return { ok: false, message: 'Preencha descrição, valor e data da venda.' };
  }

  const ctx = await getTenantContext();
  const referenceMonth = input.saleDate.slice(0, 8) + '01';

  await withTenant(ctx.companyId, async (tx) => {
    const [created] = await tx
      .insert(sale)
      .values({
        companyId: ctx.companyId,
        customerId: input.customerId,
        description: input.description.trim(),
        amount: String(input.amount),
        paymentMethod: input.paymentMethod,
        saleDate: input.saleDate,
        referenceMonth,
        received: input.received,
        notes: input.notes,
      })
      .returning({ id: sale.id });

    await tx.execute(sql`
      INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source, source_id, paid_at)
      VALUES (
        ${ctx.companyId}, 'RECEIVABLE', ${'Venda: ' + input.description.trim()}, ${String(input.amount)},
        ${input.saleDate}, ${referenceMonth}, ${input.received ? 'PAID' : 'PENDING'}, 'VENDA', ${created!.id},
        ${input.received ? input.saleDate : null}
      )
    `);
  });

  revalidatePath('/meu-negocio/vendas');
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');
  return { ok: true, message: 'Venda registrada e lançada no financeiro.' };
}

/** Exclui a venda e o lançamento financeiro vinculado. */
export async function deleteSaleAction(id: string): Promise<SaleFormState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      DELETE FROM financial_entry WHERE company_id = ${ctx.companyId} AND source = 'VENDA' AND source_id = ${id}
    `);
    await tx.delete(sale).where(eq(sale.id, id));
  });

  revalidatePath('/meu-negocio/vendas');
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');
  return { ok: true, message: 'Venda excluída.' };
}
