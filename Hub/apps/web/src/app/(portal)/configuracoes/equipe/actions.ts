'use server';

import { revalidatePath } from 'next/cache';
import { getDb, appUser, membership, eq, and } from '@hexxa/db';
import { getTenantContext, resolveAppUser } from '@/lib/server/tenant';

export type EquipeState = { ok: boolean; message: string };

const ROLES = ['OWNER', 'ADMIN', 'FINANCE', 'STAFF', 'ACCOUNTANT', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

export async function listMembersAction() {
  const ctx = await getTenantContext();
  const db = getDb();
  return db
    .select({ membershipId: membership.id, userId: appUser.id, name: appUser.name, email: appUser.email, role: membership.role })
    .from(membership)
    .innerJoin(appUser, eq(appUser.id, membership.userId))
    .where(eq(membership.companyId, ctx.companyId));
}

/**
 * Convida um e-mail pra empresa atual. Cria o appUser na hora se o e-mail
 * nunca logou antes — quando essa pessoa fizer o primeiro OTP com esse
 * e-mail, resolveAppUser() (em tenant.ts) religa o auth_uid do Supabase a
 * esta mesma linha, então a membership já criada aqui já vale pro login dela.
 */
export async function inviteMemberAction(_prev: EquipeState, formData: FormData): Promise<EquipeState> {
  const ctx = await getTenantContext();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'VIEWER') as Role;

  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Informe um e-mail válido.' };
  }
  if (!ROLES.includes(role)) {
    return { ok: false, message: 'Papel inválido.' };
  }

  const db = getDb();
  const [existingUser] = await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.email, email));

  const invitedUserId = existingUser
    ? existingUser.id
    // Marcador PENDING- (não é um auth_uid real do Supabase) — vira um
    // auth_uid de verdade no primeiro login OTP desse e-mail, sem perder
    // a membership criada aqui. Mesmo padrão do backfill de tenant.ts.
    : (await resolveAppUser(`PENDING-${email}`, email)).id;

  const [already] = await db
    .select({ id: membership.id })
    .from(membership)
    .where(and(eq(membership.companyId, ctx.companyId), eq(membership.userId, invitedUserId)));

  if (already) {
    return { ok: false, message: 'Este e-mail já tem acesso a esta empresa.' };
  }

  await db.insert(membership).values({ companyId: ctx.companyId, userId: invitedUserId, role, authorized: true });
  revalidatePath('/configuracoes/equipe');
  return { ok: true, message: `Convite criado — ${email} já pode entrar com o e-mail dela.` };
}

export async function removeMemberAction(membershipId: string) {
  const ctx = await getTenantContext();
  const db = getDb();
  // and(companyId) garante que só remove membership da própria empresa do chamador.
  await db.delete(membership).where(and(eq(membership.id, membershipId), eq(membership.companyId, ctx.companyId)));
  revalidatePath('/configuracoes/equipe');
}
