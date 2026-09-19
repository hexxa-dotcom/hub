'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, sql } from '@hexxa/db';
import { bankTransaction, financialEntry, reconciliationMatch, bankAccount, category } from '@hexxa/db/schema';
import { revalidatePath } from 'next/cache';
import { AIReconciliationService, type AIReconciliationResult } from '@hexxa/core';

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

    return {
      transactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      })),
      entries: entries.map(e => ({
        ...e,
        amount: Number(e.amount)
      }))
    };
  });
}

export async function matchTransaction(
  bankTransactionId: string,
  financialEntryId: string,
): Promise<{ ok: boolean; message?: string }> {
  const ctx = await getTenantContext();

  const result = await withTenant(ctx.companyId, async (tx) => {
    // A tela só EXIBIA um aviso visual quando tipo/valor divergiam, mas o
    // clique em "conciliar" continuava indo direto pro banco — dava pra
    // casar uma transação de R$120 (DARF) com uma conta de R$8.500
    // (aluguel) sem nenhuma trava no servidor. Revalida aqui antes de
    // gravar qualquer coisa.
    const [txn] = await tx
      .select({ amount: bankTransaction.amount, companyId: bankTransaction.companyId })
      .from(bankTransaction)
      .where(eq(bankTransaction.id, bankTransactionId));
    const [entry] = await tx
      .select({ amount: financialEntry.amount, type: financialEntry.type, companyId: financialEntry.companyId })
      .from(financialEntry)
      .where(eq(financialEntry.id, financialEntryId));

    if (!txn || !entry || txn.companyId !== ctx.companyId || entry.companyId !== ctx.companyId) {
      return { ok: false, message: 'Transação ou lançamento não encontrado.' };
    }

    const txAmount = Number(txn.amount);
    const entryAmount = Number(entry.amount);
    const expectedType = txAmount > 0 ? 'RECEIVABLE' : 'PAYABLE';
    if (entry.type !== expectedType) {
      return { ok: false, message: 'Tipo divergente: essa transação não pode ser conciliada com esse lançamento.' };
    }
    if (Math.abs(Math.abs(txAmount) - entryAmount) >= 0.01) {
      return { ok: false, message: 'Valor divergente: o valor da transação não bate com o do lançamento.' };
    }

    // Cria o match
    await tx.insert(reconciliationMatch).values({
      companyId: ctx.companyId,
      bankTransactionId,
      financialEntryId,
    });

    // Atualiza a transação bancária
    await tx
      .update(bankTransaction)
      .set({ reconciliationStatus: 'MATCHED' })
      .where(eq(bankTransaction.id, bankTransactionId));

    // Atualiza o lançamento (marca como pago hoje)
    const today = new Date().toISOString().split('T')[0]!;
    await tx
      .update(financialEntry)
      .set({ status: 'PAID', paidAt: today })
      .where(eq(financialEntry.id, financialEntryId));

    return { ok: true };
  });

  if (result.ok) {
    revalidatePath('/meu-negocio/conciliacao');
    revalidatePath('/meu-negocio/hub-financeiro');
  }
  return result;
}

export async function ignoreTransaction(bankTransactionId: string) {
  const ctx = await getTenantContext();
  
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(bankTransaction)
      .set({ reconciliationStatus: 'IGNORED' })
      .where(eq(bankTransaction.id, bankTransactionId));
  });

  revalidatePath('/meu-negocio/conciliacao');
}

/**
 * Sugestões de conciliação por IA — usa o AIReconciliationService (já
 * implementado, mas nunca tinha sido chamado por nenhuma tela). Não aplica
 * nada sozinho: só sugere categoria + possível lançamento correspondente
 * pra cada transação não conciliada; quem confirma é o usuário, via
 * applyAiMatchAction/applyAiNewEntryAction.
 */
export async function suggestAiMatchesAction(): Promise<{
  ok: boolean;
  message?: string;
  suggestions?: AIReconciliationResult[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, message: 'IA não configurada (GEMINI_API_KEY ausente no ambiente).' };
  }

  const ctx = await getTenantContext();
  return withTenant(ctx.companyId, async (tx) => {
    const transactions = await tx
      .select()
      .from(bankTransaction)
      .where(and(eq(bankTransaction.companyId, ctx.companyId), eq(bankTransaction.reconciliationStatus, 'UNMATCHED')));
    if (transactions.length === 0) return { ok: true, suggestions: [] };

    const categories = await tx.select().from(category).where(eq(category.companyId, ctx.companyId));
    const entries = await tx
      .select({ id: financialEntry.id, amount: financialEntry.amount, type: financialEntry.type, dueDate: financialEntry.dueDate })
      .from(financialEntry)
      .where(and(eq(financialEntry.companyId, ctx.companyId), eq(financialEntry.status, 'PENDING')));

    try {
      const service = new AIReconciliationService(apiKey);
      const suggestions = await service.reconcileBatch(
        transactions.map((t) => ({ id: t.id, date: t.postedAt, description: t.description, amount: Number(t.amount) })),
        categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind === 'INCOME' ? 'REVENUE' : 'EXPENSE' })),
        entries.map((e) => ({ id: e.id, amount: Number(e.amount), type: e.type, dueDate: e.dueDate })),
      );
      return { ok: true, suggestions };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Falha ao consultar a IA.' };
    }
  });
}

/** Aplica uma sugestão MATCH_EXISTING: concilia e também grava a categoria sugerida no lançamento. */
export async function applyAiMatchAction(
  bankTransactionId: string,
  financialEntryId: string,
  categoryId: string,
): Promise<{ ok: boolean; message?: string }> {
  const result = await matchTransaction(bankTransactionId, financialEntryId);
  if (!result.ok) return result;

  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(financialEntry)
      .set({ categoryId })
      .where(and(eq(financialEntry.id, financialEntryId), eq(financialEntry.companyId, ctx.companyId)));
  });
  return { ok: true };
}

/** Aplica uma sugestão CREATE_NEW: cria o lançamento já pago e categorizado, direto a partir da transação bancária. */
export async function applyAiNewEntryAction(
  bankTransactionId: string,
  categoryId: string,
): Promise<{ ok: boolean; message?: string }> {
  const ctx = await getTenantContext();

  const result = await withTenant(ctx.companyId, async (tx) => {
    const [txn] = await tx
      .select()
      .from(bankTransaction)
      .where(and(eq(bankTransaction.id, bankTransactionId), eq(bankTransaction.companyId, ctx.companyId)));
    if (!txn) return { ok: false as const, message: 'Transação não encontrada.' };

    const amount = Number(txn.amount);
    const [entry] = await tx
      .insert(financialEntry)
      .values({
        companyId: ctx.companyId,
        bankAccountId: txn.bankAccountId,
        categoryId,
        type: amount > 0 ? 'RECEIVABLE' : 'PAYABLE',
        status: 'PAID',
        description: txn.description,
        amount: String(Math.abs(amount)),
        dueDate: txn.postedAt,
        referenceMonth: `${txn.postedAt.slice(0, 7)}-01`,
        paidAt: txn.postedAt,
        source: 'RECONCILIATION',
      })
      .returning({ id: financialEntry.id });

    await tx.insert(reconciliationMatch).values({
      companyId: ctx.companyId,
      bankTransactionId,
      financialEntryId: entry!.id,
    });
    await tx.update(bankTransaction).set({ reconciliationStatus: 'MATCHED' }).where(eq(bankTransaction.id, bankTransactionId));

    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath('/meu-negocio/conciliacao');
    revalidatePath('/meu-negocio/hub-financeiro');
  }
  return result;
}

