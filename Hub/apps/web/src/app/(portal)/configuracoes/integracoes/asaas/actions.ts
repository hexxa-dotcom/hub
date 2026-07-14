'use server';

import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';
import { revalidatePath } from 'next/cache';

export async function saveAsaasToken(accessToken: string) {
  const ctx = await getTenantContext();
  const supabase = await createRawClient();
  
  const { error } = await supabase.from('integration_credential').upsert({
    company_id: ctx.companyId,
    provider: 'asaas',
    secret_ref: { access_token: accessToken },
    active: true,
  }, { onConflict: 'company_id, provider' });

  if (error) {
    throw new Error('Falha ao salvar a integração');
  }

  revalidatePath('/configuracoes/integracoes/asaas');
  return { success: true };
}
