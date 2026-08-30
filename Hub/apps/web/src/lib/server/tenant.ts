import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { TenantContext } from '@hexxa/core';
import { getDb, company, eq, withDbTimeout } from '@hexxa/db';

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
 * TEMPORÁRIO: liga o mesmo bypass do DEV_SKIP_AUTH em PRODUÇÃO também,
 * enquanto o login do Clerk está sendo estabilizado. Pedido explícito do
 * dono do produto em 2026-08-24 — remover SKIP_AUTH_TEMP=true do Vercel
 * (env de Production) assim que o login voltar a ser exigido.
 */
const SKIP_AUTH_TEMP = (process.env.SKIP_AUTH_TEMP ?? '').trim().toLowerCase() === 'true';

/**
 * Bypass de login (dev local via DEV_SKIP_AUTH, ou temporariamente em
 * produção via SKIP_AUTH_TEMP — ver comentário acima): assume a primeira
 * empresa cadastrada no banco como tenant, sem passar pelo Clerk. Exige que
 * já exista pelo menos uma empresa — se o banco estiver vazio, cai no fluxo
 * normal de onboarding.
 */
async function getDevTenantContext(): Promise<TenantContext> {
  // Sem ORDER BY o Postgres não garante qual linha volta primeiro — precisa
  // ser determinístico aqui, senão o bypass local cai numa empresa aleatória
  // (já pegou uma HOLDING vazia em vez da empresa de serviço com dados reais).
  //
  // Com SKIP_AUTH_TEMP, TODA navegação roda essa query — uma conexão presa
  // no pooler do Supabase (visto em produção: ClientRead indefinido, sem
  // reagir a statement_timeout) já travou o app inteiro por até 5 minutos.
  // withDbTimeout desiste rápido E descarta o singleton, então a PRÓXIMA
  // requisição abre conexão nova em vez de ficar presa atrás da mesma.
  let first: { id: string; type: 'SERVICE' | 'HOLDING' } | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      [first] = await withDbTimeout(
        getDb().select({ id: company.id, type: company.type }).from(company).orderBy(company.createdAt).limit(1),
        8000,
      );
      break;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  if (!first) throw new NoActiveOrganizationError();
  return { companyId: first.id, companyType: first.type, userId: 'dev-skip-auth' };
}

export async function getTenantContext(): Promise<TenantContext> {
  if (DEV_SKIP_AUTH || SKIP_AUTH_TEMP) {
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
