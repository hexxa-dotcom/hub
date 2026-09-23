'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, appUser, membership, company, eq, and } from '@hexxa/db';
import { modoSemLogin, EMPRESA_SEM_LOGIN_COOKIE } from '@/lib/server/tenant';
import { createClient } from '@/lib/supabase/server';

const ACTIVE_COMPANY_COOKIE = 'hexx_active_company';

/**
 * Troca a empresa ativa do usuário logado. Revalida que ele realmente tem
 * membership nela antes de gravar o cookie — nunca confia no companyId cru
 * vindo do form.
 */
export async function setActiveCompanyAction(companyId: string, next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login' as never);

  const db = getDb();
  const [appUserRow] = await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.authUid, user!.id));
  if (!appUserRow) redirect('/auth/login' as never);

  const [allowed] = await db
    .select({ id: membership.id })
    .from(membership)
    .where(and(eq(membership.userId, appUserRow!.id), eq(membership.companyId, companyId)));

  if (!allowed) {
    throw new Error('Você não tem acesso a esta empresa.');
  }

  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  redirect(next as never);
}

/**
 * Troca a empresa aberta no modo sem login (acesso por código). Não há
 * membership a conferir — o código de acesso já é toda a proteção desse
 * modo —, então a guarda é o próprio modo: desligado o bypass, isto recusa.
 */
export async function escolherEmpresaSemLoginAction(companyId: string, next: string) {
  if (!modoSemLogin()) throw new Error('Disponível só com o login desligado.');

  const db = getDb();
  const [existe] = await db.select({ id: company.id }).from(company).where(eq(company.id, companyId));
  if (!existe) throw new Error('Empresa não encontrada.');

  await gravarEmpresaSemLogin(companyId);
  redirect(next as never);
}

/**
 * Grava o cookie da empresa aberta no modo sem login. Todo export deste
 * arquivo vira server action chamável pelo navegador, por isso a guarda
 * do modo se repete aqui.
 */
export async function gravarEmpresaSemLogin(companyId: string) {
  if (!modoSemLogin()) throw new Error('Disponível só com o login desligado.');
  const jar = await cookies();
  // Uma server action pode ser chamada de qualquer página, inclusive das
  // públicas, que o proxy não barra. O código de acesso é conferido aqui.
  const temCodigo =
    (process.env.ACCESS_CODE_CLIENTE && jar.get('hexx_access_cliente')?.value === process.env.ACCESS_CODE_CLIENTE) ||
    (process.env.ACCESS_CODE_CONTADOR && jar.get('hexx_access_contador')?.value === process.env.ACCESS_CODE_CONTADOR);
  if (process.env.NODE_ENV === 'production' && !temCodigo) throw new Error('Informe o código de acesso.');
  jar.set(EMPRESA_SEM_LOGIN_COOKIE, companyId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}
