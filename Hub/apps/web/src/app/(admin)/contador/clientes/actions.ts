'use server';

import { revalidatePath } from 'next/cache';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { company, membership, subscription, plan } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/admin-guard';

export async function authorizeClientByCnpjAction(cnpj: string) {
  await requireAdmin();
  try {
    const db = getDb();

    // 1. Achar a empresa pelo CNPJ
    const companyRecord = await withDbTimeout(db.select().from(company).where(eq(company.cnpj, cnpj)).limit(1), 8000);
    
    if (companyRecord.length === 0) {
      return { error: 'Empresa com este CNPJ não encontrada. Peça para o cliente fazer o cadastro inicial primeiro.' };
    }
    
    const cRecord = companyRecord[0];
    if (!cRecord) return { error: 'Empresa com este CNPJ não encontrada.' };
    
    const companyId = cRecord.id;
    
    // 2. Achar o membro principal (OWNER) desta empresa
    const memberRecord = await withDbTimeout(
      db.select().from(membership).where(
        and(
          eq(membership.companyId, companyId),
          eq(membership.role, 'OWNER')
        )
      ).limit(1),
      8000,
    );
    
    if (memberRecord.length === 0) {
      return { error: 'Nenhum usuário dono (OWNER) vinculado a esta empresa.' };
    }
    
    const mRecord = memberRecord[0];
    if (!mRecord) return { error: 'Nenhum usuário dono vinculado a esta empresa.' };

    // 3. Liberar acesso — marca a membership como autorizada.
    await withDbTimeout(db.update(membership).set({ authorized: true }).where(eq(membership.id, mRecord.id)), 8000);

    return { success: true, message: 'Acesso liberado com sucesso para ' + cRecord.legalName };
  } catch (error: any) {
    console.error('Erro ao autorizar manualmente:', error);
    return { error: 'Ocorreu um erro interno ao autorizar o CNPJ.' };
  }
}

export async function changeSubscriptionPlanAction(subscriptionId: string, planName: string) {
  await requireAdmin();
  try {
    const db = getDb();
    const planRecord = await withDbTimeout(db.select().from(plan).where(eq(plan.name, planName)).limit(1), 8000);
    const p = planRecord[0];
    if (!p) return { error: `Plano "${planName}" não encontrado.` };

    await withDbTimeout(db.update(subscription).set({ planId: p.id }).where(eq(subscription.id, subscriptionId)), 8000);
    revalidatePath('/contador/clientes');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao alterar plano:', error);
    return { error: 'Erro ao alterar o plano da assinatura.' };
  }
}

export async function changeSubscriptionStatusAction(subscriptionId: string, status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL') {
  await requireAdmin();
  try {
    const db = getDb();
    const [row] = await withDbTimeout(
      db
        .update(subscription)
        .set({ status })
        .where(eq(subscription.id, subscriptionId))
        .returning({ companyId: subscription.companyId }),
      8000,
    );
    revalidatePath('/contador/clientes');
    revalidatePath('/contador/renovacoes');
    if (row) revalidatePath(`/contador/clientes/${row.companyId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao alterar status da assinatura:', error);
    return { error: 'Erro ao alterar o status da assinatura.' };
  }
}

export async function linkAsaasSubscriptionAction(subscriptionId: string, asaasCustomerId: string, asaasSubscriptionId: string) {
  await requireAdmin();
  try {
    const db = getDb();
    await withDbTimeout(
      db
        .update(subscription)
        .set({ asaasCustomerId, asaasSubscriptionId, status: 'ACTIVE' })
        .where(eq(subscription.id, subscriptionId)),
      8000,
    );
    revalidatePath('/contador/clientes');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao vincular assinatura Asaas:', error);
    return { error: 'Erro ao salvar o vínculo com o Asaas.' };
  }
}

export async function unlinkAsaasSubscriptionAction(subscriptionId: string) {
  await requireAdmin();
  try {
    const db = getDb();
    await withDbTimeout(
      db
        .update(subscription)
        .set({ asaasCustomerId: null, asaasSubscriptionId: null, status: 'CANCELED' })
        .where(eq(subscription.id, subscriptionId)),
      8000,
    );
    revalidatePath('/contador/clientes');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao desvincular assinatura Asaas:', error);
    return { error: 'Erro ao cancelar o vínculo com o Asaas.' };
  }
}
