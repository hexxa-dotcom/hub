'use server';

import { revalidatePath } from 'next/cache';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { plan } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/admin-guard';

export type PlanoFeatures = { descricao: string; cor: string; ativo: boolean; recursos: string[] };

export async function updatePlanoAction(id: string, data: { nome: string; preco: number; features: PlanoFeatures }) {
  await requireAdmin();
  try {
    const db = getDb();
    await withDbTimeout(
      db
        .update(plan)
        .set({ name: data.nome, monthlyValue: String(data.preco), features: data.features })
        .where(eq(plan.id, id)),
      8000,
    );
    revalidatePath('/contador/planos');
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar plano:', error);
    return { error: 'Erro ao salvar o plano.' };
  }
}
