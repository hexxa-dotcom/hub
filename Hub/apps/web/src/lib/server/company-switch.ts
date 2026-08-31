'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, appUser, membership, eq, and } from '@hexxa/db';
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
