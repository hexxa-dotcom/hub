'use server';

import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';

/** Tira o contato do site da lista do painel. */
export async function marcarContatoAtendido(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await getDb().execute(sql`UPDATE contato_do_site SET atendido_em = now() WHERE id = ${id}`);
  revalidatePath('/contador');
}
