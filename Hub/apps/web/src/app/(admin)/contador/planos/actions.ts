'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@hexxa/db/client';
import { plan } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';

export type PlanoFeatures = { descricao: string; cor: string; ativo: boolean; recursos: string[] };

export async function updatePlanoAction(id: string, data: { nome: string; preco: number; features: PlanoFeatures }) {
  try {
    const db = getDb();
    await db
      .update(plan)
      .set({ name: data.nome, monthlyValue: String(data.preco), features: data.features })
      .where(eq(plan.id, id));
    revalidatePath('/contador/planos');
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar plano:', error);
    return { error: 'Erro ao salvar o plano.' };
  }
}
