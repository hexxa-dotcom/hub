'use server';

import { getDb } from '@hexxa/db/client';
import { accountingContract } from '@hexxa/db/schema';
import { revalidatePath } from 'next/cache';

export async function salvarContratoGeradoAction(input: {
  companyId: string;
  plano: string;
  valor: number;
  inicio: string;
  vigenciaMeses: number | null;
  servicos: string[];
  observacao: string;
}) {
  try {
    const db = getDb();
    await db.insert(accountingContract).values({
      companyId: input.companyId,
      plano: input.plano,
      valor: String(input.valor),
      inicio: input.inicio,
      vigenciaMeses: input.vigenciaMeses,
      servicos: input.servicos,
      observacao: input.observacao || null,
    });
    revalidatePath('/contador/contratos');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao salvar contrato gerado:', error);
    return { error: 'Falha ao salvar o registro do contrato. O PDF foi gerado normalmente.' };
  }
}
