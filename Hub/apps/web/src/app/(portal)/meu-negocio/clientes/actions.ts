'use server';

import { revalidatePath } from 'next/cache';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export type CustomerState = { ok: boolean; message: string };

export async function addCustomerAction(_prev: CustomerState, formData: FormData): Promise<CustomerState> {
  try {
    const nome = String(formData.get('nome') ?? '').trim();
    const documento = String(formData.get('documento') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim() || null;

    if (!nome || !documento) {
      return { ok: false, message: 'Preencha nome e documento.' };
    }

    const ctx = await getTenantContext();
    const supabase = await createRawClient();

    // Verifica se cliente já existe (mesmo documento).
    const { data: existing } = await supabase
      .from('customer')
      .select('id')
      .eq('company_id', ctx.companyId)
      .eq('document', documento)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: 'Cliente com este documento já existe.' };
    }

    const telefone = String(formData.get('telefone') ?? '').trim() || null;
    const endereco = [
      String(formData.get('endereco') ?? '').trim(),
      String(formData.get('cidade') ?? '').trim(),
      String(formData.get('uf') ?? '').trim(),
      String(formData.get('cep') ?? '').trim(),
    ]
      .filter(Boolean)
      .join(', ') || null;
    const tipo = String(formData.get('tipo') ?? 'PJ');

    const { error } = await supabase.from('customer').insert({
      company_id: ctx.companyId,
      name: nome,
      document: documento,
      email,
      phone: telefone,
      address: endereco,
      type: tipo,
    });

    if (error) return { ok: false, message: `Erro ao salvar: ${error.message}` };

    revalidatePath('/meu-negocio/clientes');
    revalidatePath('/relacionamento');
    return { ok: true, message: 'Cliente cadastrado com sucesso!' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}
