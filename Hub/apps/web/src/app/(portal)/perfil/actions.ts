'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { getDb, withTenant, appUser, partner, membership, eq } from '@hexxa/db';

export interface UpdateUserProfileInput {
  name: string;
  phone?: string | null;
  cpf?: string | null;
  avatarUrl?: string | null;
}

export async function updateUserProfileAction(input: UpdateUserProfileInput) {
  const ctx = await getTenantContext();
  const db = getDb();

  let targetUserId = ctx.userId && /^[0-9a-f-]{36}$/i.test(ctx.userId) ? ctx.userId : null;

  if (!targetUserId) {
    // Modo dev / bypass: encontra o usuário associado à membership ativa
    const [member] = await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(eq(membership.companyId, ctx.companyId))
      .limit(1);

    if (member?.userId) {
      targetUserId = member.userId;
    }
  }

  if (!targetUserId) {
    throw new Error('Não foi possível identificar o usuário para atualização.');
  }

  // Atualiza app_user
  await db
    .update(appUser)
    .set({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      cpf: input.cpf?.trim() || null,
      avatarUrl: input.avatarUrl || null,
    })
    .where(eq(appUser.id, targetUserId));

  // Se este usuário for também um sócio cadastrado na empresa (QSA), mantém sincronizado
  try {
    await withTenant(ctx.companyId, async (tx) => {
      await tx
        .update(partner)
        .set({
          avatarUrl: input.avatarUrl || null,
        })
        .where(eq(partner.userId, targetUserId!));
    });
  } catch (err) {
    // Sócio pode não estar vinculado via foreign key ainda, não bloqueia
    console.warn('Vínculo de sócio não encontrado para sincronização:', err);
  }

  revalidatePath('/perfil');
  revalidatePath('/minha-empresa');
  revalidatePath('/configuracoes');
  revalidatePath('/minha-contabilidade/socios');

  return { ok: true };
}

export async function updateUserAvatarAction(avatarUrl: string | null) {
  const ctx = await getTenantContext();
  const db = getDb();

  let targetUserId = ctx.userId && /^[0-9a-f-]{36}$/i.test(ctx.userId) ? ctx.userId : null;

  if (!targetUserId) {
    const [member] = await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(eq(membership.companyId, ctx.companyId))
      .limit(1);

    if (member?.userId) {
      targetUserId = member.userId;
    }
  }

  if (!targetUserId) {
    throw new Error('Não foi possível identificar o usuário.');
  }

  await db
    .update(appUser)
    .set({ avatarUrl: avatarUrl || null })
    .where(eq(appUser.id, targetUserId));

  // Sincroniza sócio se aplicável
  try {
    await withTenant(ctx.companyId, async (tx) => {
      await tx
        .update(partner)
        .set({ avatarUrl: avatarUrl || null })
        .where(eq(partner.userId, targetUserId!));
    });
  } catch (err) {
    console.warn('Erro ao sincronizar avatar do sócio:', err);
  }

  revalidatePath('/perfil');
  revalidatePath('/minha-empresa');
  revalidatePath('/configuracoes');

  return { ok: true };
}
