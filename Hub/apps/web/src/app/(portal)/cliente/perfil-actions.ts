'use server';

import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { BLOCOS, ehPerfil, type PerfilDoInicio } from './blocos';

/** Grava o perfil da Início (e os blocos, no Personalizado) da empresa ativa. */
export async function salvarPerfilDoInicioAction(perfil: PerfilDoInicio, blocos?: string[]): Promise<{ ok: boolean }> {
  if (!ehPerfil(perfil)) return { ok: false };
  const ctx = await getTenantContext();
  const validos = (blocos ?? []).filter((id) => BLOCOS.some((b) => b.id === id));
  await getDb().execute(sql`
    UPDATE company
       SET inicio_perfil = ${perfil},
           inicio_blocos = CASE WHEN ${perfil} = 'PERSONALIZADO' THEN ${JSON.stringify(validos)}::jsonb ELSE inicio_blocos END
     WHERE id = ${ctx.companyId}
  `);
  revalidatePath('/cliente');
  return { ok: true };
}
