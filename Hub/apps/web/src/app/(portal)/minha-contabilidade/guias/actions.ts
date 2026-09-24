'use server';

import { revalidatePath } from 'next/cache';
import { DrizzleTaxGuideRepository, type NewTaxGuide } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { escriturar } from '@/lib/server/ledger';

const repo = new DrizzleTaxGuideRepository();

const MAX_ANEXO_BYTES = 4 * 1024 * 1024; // 4MB — mesmo limite do comprovante em Financeiro

export async function registrarGuiaAction(data: Omit<NewTaxGuide, 'fileUrl'> & { anexo?: File | null }) {
  if (!data.taxName.trim()) return { error: 'Informe a descrição.' };
  if (!data.dueDate) return { error: 'Informe o vencimento.' };
  if (!data.amount || data.amount <= 0) return { error: 'Informe um valor válido.' };

  let fileUrl: string | null = null;
  if (data.anexo && data.anexo.size > 0) {
    if (data.anexo.size > MAX_ANEXO_BYTES) return { error: 'Arquivo muito grande (máx. 4MB).' };
    const buf = Buffer.from(await data.anexo.arrayBuffer());
    const mime = data.anexo.type || 'application/pdf';
    fileUrl = `data:${mime};base64,${buf.toString('base64')}`;
  }

  try {
    const ctx = await getTenantContext();
    const { id } = await repo.create(ctx, { ...data, fileUrl });
    // Provisão do tributo: despesa contra o passivo a recolher.
    await escriturar('guia', ctx.companyId, id, ctx.userId);
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
    // Baixa do passivo contra o banco.
    await escriturar('guia', ctx.companyId, id, ctx.userId);
    revalidatePath('/minha-contabilidade/guias');
    return { success: true };
  } catch (error) {
    console.error('Erro ao marcar guia como paga:', error);
    return { error: 'Erro ao marcar como paga.' };
  }
}
