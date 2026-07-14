'use server';

import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from '@hexxa/db/client';
import { company, appUser, membership } from '@hexxa/db/schema/tenancy';
import { eq, and } from 'drizzle-orm';

export async function authorizeClientByCnpjAction(cnpj: string) {
  try {
    const db = getDb();
    
    // 1. Achar a empresa pelo CNPJ
    const companyRecord = await db.select().from(company).where(eq(company.cnpj, cnpj)).limit(1);
    
    if (companyRecord.length === 0) {
      return { error: 'Empresa com este CNPJ não encontrada. Peça para o cliente fazer o cadastro inicial primeiro.' };
    }
    
    const cRecord = companyRecord[0];
    if (!cRecord) return { error: 'Empresa com este CNPJ não encontrada.' };
    
    const companyId = cRecord.id;
    
    // 2. Achar o membro principal (OWNER) desta empresa
    const memberRecord = await db.select().from(membership).where(
      and(
        eq(membership.companyId, companyId),
        eq(membership.role, 'OWNER')
      )
    ).limit(1);
    
    if (memberRecord.length === 0) {
      return { error: 'Nenhum usuário dono (OWNER) vinculado a esta empresa.' };
    }
    
    const mRecord = memberRecord[0];
    if (!mRecord) return { error: 'Nenhum usuário dono vinculado a esta empresa.' };
    
    const userId = mRecord.userId;
    
    // 3. Achar o authUid do usuário no Clerk
    const userRecord = await db.select().from(appUser).where(eq(appUser.id, userId)).limit(1);
    
    if (userRecord.length === 0) {
      return { error: 'Usuário não encontrado no banco de dados.' };
    }
    
    const uRecord = userRecord[0];
    if (!uRecord) return { error: 'Usuário não encontrado.' };
    
    const authUid = uRecord.authUid;
    
    // 4. Liberar acesso no Clerk
    const client = await clerkClient();
    await client.users.updateUserMetadata(authUid, {
      publicMetadata: {
        authorized: true,
      }
    });
    
    return { success: true, message: 'Acesso liberado com sucesso para ' + cRecord.legalName };
  } catch (error: any) {
    console.error('Erro ao autorizar manualmente:', error);
    return { error: 'Ocorreu um erro interno ao autorizar o CNPJ.' };
  }
}
