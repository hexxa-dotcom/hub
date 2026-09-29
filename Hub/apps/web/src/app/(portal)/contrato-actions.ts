'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { registrarAceite } from '@/lib/server/contrato-hexx';

/** Aceite do contrato na tela de entrada: grava a prova (quem, quando, IP, navegador). */
export async function aceitarContratoAction(): Promise<{ ok: boolean; mensagem: string }> {
  const ctx = await getTenantContext();
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || h.get('x-real-ip') || null;

  // Quem aceitou: o usuário da sessão; sem login (fase atual), o primeiro membro da empresa.
  const real = /^[0-9a-f-]{36}$/i.test(ctx.userId);
  const [u] = (await getDb().execute(
    real
      ? sql`SELECT id::text, name, email FROM app_user WHERE id = ${ctx.userId}`
      : sql`SELECT u.id::text, u.name, u.email FROM membership m JOIN app_user u ON u.id = m.user_id WHERE m.company_id = ${ctx.companyId} LIMIT 1`,
  )) as unknown as { id: string; name: string; email: string }[];

  const r = await registrarAceite(
    ctx.companyId,
    { id: u?.id ?? ctx.userId, nome: u?.name ?? null, email: u?.email ?? null },
    { ip, navegador: h.get('user-agent') },
  );
  revalidatePath('/', 'layout');
  return r;
}
