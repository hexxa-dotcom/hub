'use server';

import { revalidatePath } from 'next/cache';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export type DistState = { ok: boolean; message: string };

/** Lança uma distribuição de lucro — grava no banco (chega à contabilidade). */
export async function addDistribution(_prev: DistState, formData: FormData): Promise<DistState> {
  try {
    const partner = String(formData.get('partner') ?? '').trim();
    const amount = Number(String(formData.get('amount') ?? '').replace(/\./g, '').replace(',', '.'));
    const date = String(formData.get('date') ?? '');
    const notes = String(formData.get('notes') ?? '').trim() || null;

    if (!partner || !(amount > 0) || !date) {
      return { ok: false, message: 'Preencha sócio, valor e data.' };
    }

    const ctx = await getTenantContext();
    const supabase = await createRawClient();
    const { error } = await supabase.from('profit_distribution').insert({
      company_id: ctx.companyId,
      partner_name: partner,
      amount,
      distributed_at: date,
      reference_year: Number(date.slice(0, 4)),
      notes,
    });

    if (error) return { ok: false, message: `Não foi possível salvar: ${error.message}` };

    revalidatePath('/minha-contabilidade/distribuicao-lucros');
    return { ok: true, message: 'Distribuição lançada e enviada à contabilidade.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}
