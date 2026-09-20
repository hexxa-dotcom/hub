'use server';

import { getDb, eq } from '@hexxa/db';
import { company, subscription } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Encerrar e reativar um cliente.
 *
 * Encerrar tira a empresa de toda a operação automática — fechamento,
 * classificação, escrituração, envio e volta do OneFlow, despesas fixas,
 * faturamento de contratos, sincronização com o Nibo, honorários — e cancela
 * a assinatura. Não apaga nada: o histórico contábil é guardado por lei.
 */
export async function encerrarCliente(
  companyId: string,
  motivo: string,
): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  if (motivo.trim().length < 3) return { ok: false, mensagem: 'Diga o motivo do encerramento.' };

  const db = getDb();
  await db.update(company).set({ closedAt: new Date(), closedReason: motivo.trim() }).where(eq(company.id, companyId));
  await db.update(subscription).set({ status: 'CANCELED' }).where(eq(subscription.companyId, companyId));

  revalidatePath(`/contador/clientes/${companyId}`);
  revalidatePath('/contador/clientes');
  return { ok: true, mensagem: 'Cliente encerrado. Nenhuma rotina automática opera mais sobre ele.' };
}

export async function reativarCliente(companyId: string): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  await getDb().update(company).set({ closedAt: null, closedReason: null }).where(eq(company.id, companyId));
  revalidatePath(`/contador/clientes/${companyId}`);
  revalidatePath('/contador/clientes');
  return {
    ok: true,
    mensagem: 'Cliente reativado. A assinatura continua cancelada — defina os honorários de novo, se for o caso.',
  };
}
