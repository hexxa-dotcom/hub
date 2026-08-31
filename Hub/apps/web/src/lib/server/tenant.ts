import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { TenantContext } from '@hexxa/core';
import { getDb, company, appUser, membership, eq, and, withDbTimeout } from '@hexxa/db';
import { createClient } from '@/lib/supabase/server';

/**
 * Lançada quando o usuário está autenticado mas ainda não tem nenhuma
 * empresa vinculada (nem como dono, nem convidado). Os chamadores devem
 * tratar isso redirecionando para o onboarding — nunca resolver para um
 * tenant compartilhado.
 */
export class NoActiveOrganizationError extends Error {
  constructor() {
    super('Nenhuma empresa vinculada a este usuário.');
    this.name = 'NoActiveOrganizationError';
  }
}

/** Lançada quando o usuário tem mais de uma empresa e nenhuma foi escolhida como ativa. */
export class NoActiveCompanySelectedError extends Error {
  constructor(public readonly companies: { id: string; legalName: string }[]) {
    super('Mais de uma empresa disponível — escolha qual acessar.');
    this.name = 'NoActiveCompanySelectedError';
  }
}

const ACTIVE_COMPANY_COOKIE = 'hexx_active_company';

const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';
/**
 * TEMPORÁRIO: rede de segurança da migração Clerk → Supabase Auth. Enquanto
 * ligado, ignora a sessão do Supabase e assume a primeira empresa do banco —
 * mesmo padrão que já existia para estabilizar o login antes. Desligar
 * (SKIP_AUTH_TEMP=false no Vercel) só depois do corte validado em produção.
 */
const SKIP_AUTH_TEMP = (process.env.SKIP_AUTH_TEMP ?? '').trim().toLowerCase() === 'true';

async function getDevTenantContext(): Promise<TenantContext> {
  // Sem ORDER BY o Postgres não garante qual linha volta primeiro — precisa
  // ser determinístico aqui, senão o bypass local cai numa empresa aleatória.
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

/** Busca (ou cria) o appUser correspondente ao usuário autenticado no Supabase. */
export async function resolveAppUser(authUid: string, email: string | undefined): Promise<{ id: string }> {
  const db = getDb();
  const [existing] = await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.authUid, authUid));
  if (existing) return existing;

  // Backfill: usuário pré-existente da era Clerk, marcado como PENDING- na
  // migração, ainda não religado a um auth_uid do Supabase. Primeiro login
  // com o e-mail certo reclama a linha (e a membership que já tinha).
  if (email) {
    const [pending] = await db
      .select({ id: appUser.id })
      .from(appUser)
      .where(and(eq(appUser.email, email), eq(appUser.authUid, `PENDING-${email}`)));
    if (pending) {
      await db.update(appUser).set({ authUid }).where(eq(appUser.id, pending.id));
      return pending;
    }
  }

  const [created] = await db
    .insert(appUser)
    .values({ authUid, name: email?.split('@')[0] ?? 'Usuário', email: email ?? `${authUid}@sem-email.invalido` })
    .returning({ id: appUser.id });
  return created!;
}

/**
 * cache() deduplica por request do React — sem isso, cada chamada (layout +
 * page + helpers internos) refazia a checagem de sessão e as queries de
 * tenant do zero.
 */
export const getTenantContext = cache(async function getTenantContext(): Promise<TenantContext> {
  if (DEV_SKIP_AUTH || SKIP_AUTH_TEMP) {
    return getDevTenantContext();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new NoActiveOrganizationError();
  }

  const appUserRow = await resolveAppUser(user.id, user.email);
  const db = getDb();

  const rows = await db
    .select({ companyId: company.id, companyType: company.type, legalName: company.legalName })
    .from(membership)
    .innerJoin(company, eq(company.id, membership.companyId))
    .where(eq(membership.userId, appUserRow.id));

  if (rows.length === 0) {
    throw new NoActiveOrganizationError();
  }

  if (rows.length === 1) {
    const only = rows[0]!;
    return { companyId: only.companyId, companyType: only.companyType, userId: appUserRow.id };
  }

  // Múltiplas empresas (ex.: contador): precisa de uma escolhida como ativa,
  // sempre revalidada contra a lista atual — nunca confia cegamente no cookie.
  const jar = await cookies();
  const activeId = jar.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active = rows.find((r) => r.companyId === activeId);
  if (active) {
    return { companyId: active.companyId, companyType: active.companyType, userId: appUserRow.id };
  }

  throw new NoActiveCompanySelectedError(rows.map((r) => ({ id: r.companyId, legalName: r.legalName })));
});
