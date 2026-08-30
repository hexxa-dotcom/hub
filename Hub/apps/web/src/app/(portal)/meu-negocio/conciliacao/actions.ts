'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, sql } from '@hexxa/db';
import { bankTransaction, financialEntry, reconciliationMatch, bankAccount } from '@hexxa/db/schema';
import { revalidatePath } from 'next/cache';

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

export async function generateMockTransactions() {
  const ctx = await getTenantContext();
  
  await withTenant(ctx.companyId, async (tx) => {
    // Garante que existe uma conta bancária
    let [account] = await tx
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.companyId, ctx.companyId))
      .limit(1);

    if (!account) {
      const [newAcc] = await tx.insert(bankAccount).values({
        companyId: ctx.companyId,
        bankName: 'Banco Mock',
        number: '12345-6'
      }).returning();
      account = newAcc!;
    }

    const today = new Date();
    const mockData = [
      {
        companyId: ctx.companyId,
        bankAccountId: account.id,
        postedAt: today.toISOString().split('T')[0]!,
        amount: '-1500.00',
        description: 'PIX ENVIADO - ALUGUEL SALA 4',
      },
      {
        companyId: ctx.companyId,
        bankAccountId: account.id,
        postedAt: today.toISOString().split('T')[0]!,
        amount: '8500.00',
        description: 'TED RECEBIDA - CLIENTE X',
      },
      {
        companyId: ctx.companyId,
        bankAccountId: account.id,
        postedAt: new Date(today.getTime() - 86400000).toISOString().split('T')[0]!,
        amount: '-120.50',
        description: 'PAGTO TRIBUTO DARF',
      }
    ];

    await tx.insert(bankTransaction).values(mockData);
  });

  revalidatePath('/meu-negocio/conciliacao');
}
