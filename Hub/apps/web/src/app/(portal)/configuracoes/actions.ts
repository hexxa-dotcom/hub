'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, company, eq } from '@hexxa/db';

export async function updateCompanyAction(formData: FormData) {
  // companyId sempre vem da sessão — nunca de argumento passado pelo cliente,
  // para não permitir que uma Server Action seja chamada com o companyId de
  // outra empresa.
  const ctx = await getTenantContext();

  try {
    await withTenant(ctx.companyId, async (tx) => {
      await tx
        .update(company)
        .set({
          legalName: formData.get('legalName') as string,
          tradeName: formData.get('tradeName') as string,
          useTradeName: formData.get('useTradeName') === 'on',
          cnpj: formData.get('cnpj') as string,
          municipalRegistration: formData.get('municipalRegistration') as string,
          addressLine1: formData.get('addressLine1') as string,
          addressNumber: formData.get('addressNumber') as string,
          neighborhood: formData.get('neighborhood') as string,
          city: formData.get('city') as string,
          state: formData.get('state') as string,
          zipcode: formData.get('zipcode') as string,
        })
        .where(eq(company.id, ctx.companyId));
    });
  } catch (error: any) {
    console.error('Update company error:', error);
    throw new Error(error.message || 'Falha ao atualizar dados da empresa.');
  }

  revalidatePath('/configuracoes');
}
