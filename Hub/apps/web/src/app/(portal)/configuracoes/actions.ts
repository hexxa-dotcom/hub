'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, company, partner, appUser, eq } from '@hexxa/db';

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
          tradeName: (formData.get('tradeName') as string) || null,
          useTradeName: formData.get('useTradeName') === 'on',
          cnpj: formData.get('cnpj') as string,
          municipalRegistration: (formData.get('municipalRegistration') as string) || null,
          addressLine1: (formData.get('addressLine1') as string) || null,
          addressNumber: (formData.get('addressNumber') as string) || null,
          neighborhood: (formData.get('neighborhood') as string) || null,
          city: (formData.get('city') as string) || null,
          state: (formData.get('state') as string) || null,
          zipcode: (formData.get('zipcode') as string) || null,
          logoUrl: (formData.get('logoUrl') as string) || null,
          website: (formData.get('website') as string) || null,
          instagram: (formData.get('instagram') as string) || null,
          linkedin: (formData.get('linkedin') as string) || null,
          whatsapp: (formData.get('whatsapp') as string) || null,
          email: (formData.get('email') as string) || null,
          phone: (formData.get('phone') as string) || null,
        })
        .where(eq(company.id, ctx.companyId));
    });
  } catch (error: any) {
    console.error('Update company error:', error);
    throw new Error(error.message || 'Falha ao atualizar dados da empresa.');
  }

  revalidatePath('/configuracoes');
  revalidatePath('/minha-empresa');
  revalidatePath('/minha-empresa/editar');
}

export async function updateCompanyLogoAction(logoUrl: string | null) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(company)
      .set({ logoUrl: logoUrl || null })
      .where(eq(company.id, ctx.companyId));
  });
  revalidatePath('/minha-empresa');
  revalidatePath('/minha-empresa/editar');
  return { ok: true };
}

export async function updatePartnerAvatarAction(partnerId: string, avatarUrl: string | null) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(partner)
      .set({ avatarUrl: avatarUrl || null })
      .where(eq(partner.id, partnerId));

    if (ctx.userId && /^[0-9a-f-]{36}$/i.test(ctx.userId)) {
      await tx
        .update(appUser)
        .set({ avatarUrl: avatarUrl || null })
        .where(eq(appUser.id, ctx.userId));
    }
  });
  revalidatePath('/minha-empresa');
  revalidatePath('/minha-empresa/editar');
  revalidatePath('/minha-contabilidade/socios');
  return { ok: true };
}
