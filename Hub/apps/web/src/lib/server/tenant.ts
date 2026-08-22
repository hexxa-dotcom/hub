import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { TenantContext } from '@hexxa/core';
import { getDb, company, eq } from '@hexxa/db';

/**
 * Lançada quando o usuário está autenticado mas não tem organização ativa
 * selecionada no Clerk. Os chamadores devem tratar isso redirecionando para
 * a seleção/criação de empresa — nunca resolver para um tenant compartilhado.
 */
export class NoActiveOrganizationError extends Error {
  constructor() {
    super('Nenhuma organização ativa selecionada.');
    this.name = 'NoActiveOrganizationError';
  }
}

/**
 * Resolve o tenant a partir da sessão do Clerk:
 *   organização ativa (orgId) → empresa no banco (company.clerk_org_id).
 * Se a organização ainda não tem empresa vinculada, cria uma na hora
 * (o CNPJ real é preenchido depois em Configurações).
 */
export async function getTenantContext(): Promise<TenantContext> {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    throw new NoActiveOrganizationError();
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: company.id, type: company.type })
    .from(company)
    .where(eq(company.clerkOrgId, orgId));

  if (existing) {
    return { companyId: existing.id, companyType: existing.type, userId };
  }

  // Primeira vez desta organização: cria a empresa vinculada.
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  const [created] = await db
    .insert(company)
    .values({
      legalName: org.name,
      // CNPJ real é obrigatório e único — placeholder até o usuário preencher em Configurações.
      cnpj: `PENDENTE-${orgId}`,
      type: 'SERVICE',
      clerkOrgId: orgId,
    })
    .returning({ id: company.id, type: company.type });

  return { companyId: created!.id, companyType: created!.type, userId };
}
