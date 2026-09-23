import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { TenantContext } from '@hexxa/core';
import { getDb, company, appUser, membership, eq, and, withDbTimeout } from '@hexxa/db';
import { isNull } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from './admin-guard';

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

/**
 * O id de usuário serve de AUTORIA? Só se for um usuário de verdade.
 *
 * `ctx.userId` vale 'dev-skip-auth' com o login contornado — que é como a
 * produção roda hoje, com `SKIP_AUTH_TEMP` —, 'cron' nos crons e 'mcp' no
 * servidor MCP. Gravar isso numa coluna de autoria (UUID, com chave para
 * `app_user`) faz a gravação inteira falhar: marcar guia paga, lançar no
 * financeiro, decidir na fila da IA. Autoria desconhecida é nula, não um
 * texto que o banco recusa.
 */
export function autorOuNulo(userId: string | null | undefined): string | null {
  return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}

const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';
/**
 * TEMPORÁRIO: rede de segurança da migração Clerk → Supabase Auth. Enquanto
 * ligado, ignora a sessão do Supabase e assume a primeira empresa do banco —
 * mesmo padrão que já existia para estabilizar o login antes. Desligar
 * (SKIP_AUTH_TEMP=false no Vercel) só depois do corte validado em produção.
 */
const SKIP_AUTH_TEMP = (process.env.SKIP_AUTH_TEMP ?? '').trim().toLowerCase() === 'true';

/** `true` enquanto o sistema roda sem login (acesso por código). */
export function modoSemLogin(): boolean {
  return DEV_SKIP_AUTH || SKIP_AUTH_TEMP;
}

/**
 * EMPRESA ABERTA NO MODO SEM LOGIN.
 *
 * Sem sessão não há de quem perguntar "qual é a sua empresa", então quem
 * escolhe é um cookie, gravado pela tela `/auth/empresa` ou ao terminar o
 * passo 1 do cadastro. Sem ele, abre a HEXX — a empresa da própria
 * contabilidade, que é onde o sistema é usado de verdade hoje. Antes abria
 * sempre a mais antiga do banco, que era uma empresa de teste.
 */
export const EMPRESA_SEM_LOGIN_COOKIE = 'hexx_empresa_sem_login';
const CNPJ_EMPRESA_PADRAO = '62.414.421/0001-16';

async function getDevTenantContext(): Promise<TenantContext> {
  const db = getDb();
  const escolhida = (await cookies()).get(EMPRESA_SEM_LOGIN_COOKIE)?.value;
  const campos = { id: company.id, type: company.type };
  const candidatas = [
    // O cookie só vale para empresa que existe e não foi encerrada.
    escolhida && /^[0-9a-f-]{36}$/i.test(escolhida)
      ? () => db.select(campos).from(company).where(and(eq(company.id, escolhida), isNull(company.closedAt))).limit(1)
      : null,
    process.env.DEV_ACTIVE_COMPANY_ID
      ? () => db.select(campos).from(company).where(eq(company.id, process.env.DEV_ACTIVE_COMPANY_ID!)).limit(1)
      : null,
    () => db.select(campos).from(company).where(eq(company.cnpj, CNPJ_EMPRESA_PADRAO)).limit(1),
    // Sem ORDER BY o Postgres não garante qual linha volta primeiro.
    () => db.select(campos).from(company).orderBy(company.createdAt).limit(1),
  ];

  for (const consulta of candidatas) {
    if (!consulta) continue;
    let linha: { id: string; type: 'SERVICE' | 'HOLDING' } | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        [linha] = await withDbTimeout(consulta(), 8000);
        break;
      } catch (err) {
        if (attempt === 2) throw err;
      }
    }
    if (linha) return { companyId: linha.id, companyType: linha.type, userId: 'dev-skip-auth' };
  }
  throw new NoActiveOrganizationError();
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
  if (modoSemLogin()) {
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

  // O contador entra na área de qualquer cliente pela área do contador, que
  // grava a empresa no cookie. Ele não é membro de cada empresa, então a
  // permissão vem da lista de administradores, conferida a cada requisição.
  const escolhidaPeloContador = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  if (escolhidaPeloContador && !rows.some((r) => r.companyId === escolhidaPeloContador) && (await isAdminUser())) {
    const [alvo] = await db
      .select({ companyId: company.id, companyType: company.type })
      .from(company)
      .where(eq(company.id, escolhidaPeloContador));
    if (alvo) return { companyId: alvo.companyId, companyType: alvo.companyType, userId: appUserRow.id };
  }

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
