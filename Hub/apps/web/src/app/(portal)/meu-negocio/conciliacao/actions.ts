'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and } from '@hexxa/db';
import { bankTransaction, financialEntry, category } from '@hexxa/db/schema';

export async function getReconciliationData() {
  const ctx = await getTenantContext();
  
  return await withTenant(ctx.companyId, async (tx) => {
    // Busca transações não conciliadas
    const transactions = await tx
      .select()
      .from(bankTransaction)
      .where(
        and(
          eq(bankTransaction.companyId, ctx.companyId),
          eq(bankTransaction.reconciliationStatus, 'UNMATCHED')
        )
      )
      .orderBy(bankTransaction.postedAt);

    // Busca lançamentos pendentes
    const entries = await tx
      .select({
        id: financialEntry.id,
        type: financialEntry.type,
        description: financialEntry.description,
        amount: financialEntry.amount,
        dueDate: financialEntry.dueDate,
        status: financialEntry.status,
      })
      .from(financialEntry)
      .where(
        and(
          eq(financialEntry.companyId, ctx.companyId),
          eq(financialEntry.status, 'PENDING')
        )
      )
      .orderBy(financialEntry.dueDate);

    // Busca categorias da empresa para permitir edição e exibição correta
    const categories = await tx
      .select({
        id: category.id,
        name: category.name,
        kind: category.kind,
      })
      .from(category)
      .where(eq(category.companyId, ctx.companyId))
      .orderBy(category.name);

    return {
      transactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      })),
      entries: entries.map(e => ({
        ...e,
        amount: Number(e.amount)
      })),
      categories,
    };
  });
}
