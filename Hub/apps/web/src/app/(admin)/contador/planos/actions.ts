'use server';

import { revalidatePath } from 'next/cache';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { plan } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/admin-guard';

/**
 * O plano tem dois nomes, e eles servem a públicos diferentes.
 *
 * `plan.name` é o nome de controle — "Com movimento", "Sem movimento" — que
 * diz ao escritório em que caixa o cliente está. `nomeComercial` é o que o
 * cliente vê, na fatura e no portal. Sem essa separação, ou a gestão interna
 * fica com nomes de vitrine, ou o cliente recebe um boleto dizendo "Sem
 * movimento", que soa como se ele não estivesse recebendo serviço nenhum.
 */
export type PlanoFeatures = {
  descricao: string;
  cor: string;
  ativo: boolean;
  recursos: string[];
  nomeComercial?: string;
  /**
   * Os adicionais que a fatura soma sozinha. Em branco (ou zero), o plano não
   * cobra adicional nenhum — nada é cobrado por omissão.
   */
  adicionalPorColaborador?: number;
  /** Quantos sócios o plano já inclui. Padrão 2. */
  sociosInclusos?: number;
  /** Valor por admissão. Rescisão não é cobrada — ver `calcularAdicionais`. */
  adicionalPorEvento?: number;
};

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
