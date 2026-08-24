'use server';

import { revalidatePath } from 'next/cache';
import { getDb, eq } from '@hexxa/db';
import { taxGuide } from '@hexxa/db/schema';
import { AdminTaxGuideRepository, type NewTaxGuide, type NewInstallmentPlan } from '@hexxa/db';

const repo = new AdminTaxGuideRepository();

export async function enviarGuiaAction(companyId: string, data: NewTaxGuide) {
  if (!data.taxName.trim()) return { error: 'Informe a descrição.' };
  if (!data.dueDate) return { error: 'Informe o vencimento.' };
  if (!data.amount || data.amount <= 0) return { error: 'Informe um valor válido.' };
  try {
    const db = getDb();
    const { id } = await repo.create(db, companyId, data);
    revalidatePath(`/contador/clientes/${companyId}/guias`);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true, id };
  } catch (error) {
    console.error('Erro ao enviar guia:', error);
    return { error: 'Erro ao enviar a guia.' };
  }
}

export async function criarParcelamentoAction(companyId: string, data: NewInstallmentPlan) {
  if (!data.description.trim()) return { error: 'Informe a descrição do parcelamento.' };
  if (!data.firstDueDate) return { error: 'Informe o vencimento da 1ª parcela.' };
  if (!data.installmentCount || data.installmentCount < 2) return { error: 'Um parcelamento precisa de ao menos 2 parcelas.' };
  if (!data.installmentAmount || data.installmentAmount <= 0) return { error: 'Informe o valor da parcela.' };
  try {
    const db = getDb();
    const { groupId } = await repo.createInstallmentPlan(db, companyId, data);
    revalidatePath(`/contador/clientes/${companyId}/guias`);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true, groupId };
  } catch (error) {
    console.error('Erro ao criar parcelamento:', error);
    return { error: 'Erro ao criar o parcelamento.' };
  }
}

export async function excluirGuiaAction(companyId: string, id: string) {
  try {
    const db = getDb();
    await db.delete(taxGuide).where(eq(taxGuide.id, id));
    revalidatePath(`/contador/clientes/${companyId}/guias`);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir guia:', error);
    return { error: 'Erro ao excluir a guia.' };
  }
}
