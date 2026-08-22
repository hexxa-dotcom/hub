'use server';

import { revalidatePath } from 'next/cache';
import { DrizzleTaxGuideRepository, type NewTaxGuide } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';

const repo = new DrizzleTaxGuideRepository();

export async function registrarGuiaAction(data: NewTaxGuide) {
  if (!data.taxName.trim()) return { error: 'Informe a descrição.' };
  if (!data.dueDate) return { error: 'Informe o vencimento.' };
  if (!data.amount || data.amount <= 0) return { error: 'Informe um valor válido.' };
  try {
    const ctx = await getTenantContext();
    const { id } = await repo.create(ctx, data);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true, id };
  } catch (error) {
    console.error('Erro ao registrar guia:', error);
    return { error: 'Erro ao registrar a guia.' };
  }
}

export async function marcarGuiaPagaAction(id: string) {
  try {
    const ctx = await getTenantContext();
    await repo.markPaid(ctx, id);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true };
  } catch (error) {
    console.error('Erro ao marcar guia como paga:', error);
    return { error: 'Erro ao marcar como paga.' };
  }
}
