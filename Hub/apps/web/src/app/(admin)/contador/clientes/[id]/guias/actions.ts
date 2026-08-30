'use server';

import { revalidatePath } from 'next/cache';
import { getDb, eq, and, withDbTimeout } from '@hexxa/db';
import { taxGuide } from '@hexxa/db/schema';
import { AdminTaxGuideRepository, type NewTaxGuide, type NewInstallmentPlan } from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';

const repo = new AdminTaxGuideRepository();

export async function enviarGuiaAction(companyId: string, data: NewTaxGuide) {
  await requireAdmin();
  if (!data.taxName.trim()) return { error: 'Informe a descrição.' };
  if (!data.dueDate) return { error: 'Informe o vencimento.' };
  if (!data.amount || data.amount <= 0) return { error: 'Informe um valor válido.' };
  try {
    const db = getDb();
    const { id } = await withDbTimeout(repo.create(db, companyId, data), 8000);
    revalidatePath(`/contador/clientes/${companyId}/guias`);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true, id };
  } catch (error) {
    console.error('Erro ao enviar guia:', error);
    return { error: 'Erro ao enviar a guia.' };
  }
}

export async function criarParcelamentoAction(companyId: string, data: NewInstallmentPlan) {
  await requireAdmin();
  if (!data.description.trim()) return { error: 'Informe a descrição do parcelamento.' };
  if (!data.firstDueDate) return { error: 'Informe o vencimento da 1ª parcela.' };
  if (!data.installmentCount || data.installmentCount < 2) return { error: 'Um parcelamento precisa de ao menos 2 parcelas.' };
  if (!data.installmentAmount || data.installmentAmount <= 0) return { error: 'Informe o valor da parcela.' };
  try {
    const db = getDb();
    const { groupId } = await withDbTimeout(repo.createInstallmentPlan(db, companyId, data), 8000);
    revalidatePath(`/contador/clientes/${companyId}/guias`);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true, groupId };
  } catch (error) {
    console.error('Erro ao criar parcelamento:', error);
    return { error: 'Erro ao criar o parcelamento.' };
  }
}

export async function excluirGuiaAction(companyId: string, id: string) {
  await requireAdmin();
  try {
    const db = getDb();
    // Faltava filtrar por companyId — sem isso, o id da guia sozinho já
    // bastava pra apagar a guia de QUALQUER empresa.
    await withDbTimeout(db.delete(taxGuide).where(and(eq(taxGuide.id, id), eq(taxGuide.companyId, companyId))), 8000);
    revalidatePath(`/contador/clientes/${companyId}/guias`);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir guia:', error);
    return { error: 'Erro ao excluir a guia.' };
  }
}
