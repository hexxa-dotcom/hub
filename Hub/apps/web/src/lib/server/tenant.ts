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
const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';

/**
 * Bypass de login só para desenvolvimento local (DEV_SKIP_AUTH=true no
 * .env.local, nunca em produção): assume a primeira empresa cadastrada no
 * banco como tenant, sem passar pelo Clerk. Exige que já exista pelo menos
 * uma empresa — se o banco estiver vazio, cai no fluxo normal de onboarding.
 */
async function getDevTenantContext(): Promise<TenantContext> {
  const db = getDb();
  const [first] = await db.select({ id: company.id, type: company.type }).from(company).limit(1);
  if (!first) throw new NoActiveOrganizationError();
  return { companyId: first.id, companyType: first.type, userId: 'dev-skip-auth' };
}

export async function getTenantContext(): Promise<TenantContext> {
  if (DEV_SKIP_AUTH) {
    return getDevTenantContext();
  }

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
