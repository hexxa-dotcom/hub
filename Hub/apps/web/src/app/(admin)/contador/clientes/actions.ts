'use server';

import { revalidatePath } from 'next/cache';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { company, membership, subscription, plan } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/admin-guard';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { modoSemLogin, CONTADOR_NA_AREA_COOKIE } from '@/lib/server/tenant';
import { gravarEmpresaSemLogin } from '@/lib/server/company-switch';
import { habilitarClienteDoNibo } from '@/lib/server/clientes-do-nibo';

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

    const atualizadas = await withDbTimeout(
      db.update(subscription).set({ planId: p.id }).where(eq(subscription.id, subscriptionId))
        .returning({ id: subscription.id }),
      8000,
    );

    /**
     * Empresa sem assinatura chega aqui com o id DA EMPRESA — é o que a lista
     * usa como chave quando não há assinatura. O UPDATE acima não acha nada
     * e, antes, a função respondia sucesso assim mesmo: a tela mostrava o
     * plano trocado, e nada tinha sido gravado. Agora a assinatura nasce.
     */
    if (!atualizadas.length) {
      const [empresa] = await withDbTimeout(
        db.select({ id: company.id }).from(company).where(eq(company.id, subscriptionId)),
        8000,
      );
      if (!empresa) return { error: 'Assinatura ou empresa não encontrada.' };
      await withDbTimeout(
        db.insert(subscription).values({ companyId: empresa.id, planId: p.id, status: 'ACTIVE' }),
        8000,
      );
    }

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

/**
 * Abre a área do cliente como o cliente a vê. Sem login, troca a empresa
 * aberta (o cookie do modo sem login); com login, grava a empresa ativa, que
 * o tenant aceita porque quem pede é administrador.
 */
export async function entrarNaAreaDoClienteAction(companyId: string) {
  await requireAdmin();
  (await cookies()).set(CONTADOR_NA_AREA_COOKIE, companyId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  });
  if (modoSemLogin()) {
    await gravarEmpresaSemLogin(companyId);
  } else {
    (await cookies()).set('hexx_active_company', companyId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    });
  }
  redirect('/cliente' as never);
}

export async function habilitarClienteDoNiboAction(document: string): Promise<{ ok: boolean; message: string; companyId?: string }> {
  await requireAdmin();
  try {
    const r = await habilitarClienteDoNibo(document);
    revalidatePath('/contador/clientes');
    revalidatePath('/contador/clientes/nova');
    return { ok: true, message: `${r.nome} habilitada na Hexx.`, companyId: r.companyId };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Não consegui habilitar.' };
  }
}
