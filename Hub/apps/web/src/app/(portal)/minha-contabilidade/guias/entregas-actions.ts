'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getTenantContext, CONTADOR_NA_AREA_COOKIE } from '@/lib/server/tenant';
import { registrarEventoDoCliente } from '@/lib/server/entregas';

/**
 * "Recebi": a confirmação do cliente. Opcional — a abertura já fica
 * registrada —, mas é a prova mais forte. O contador olhando pela área do
 * cliente não pode confirmar no lugar dele.
 */
export async function confirmarRecebimentoAction(id: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  if ((await cookies()).get(CONTADOR_NA_AREA_COOKIE)?.value === ctx.companyId) {
    return { ok: false, message: 'Você está na área do cliente como contador: só o cliente pode confirmar.' };
  }
  await registrarEventoDoCliente(ctx, id, 'CONFIRMADO');
  revalidatePath('/minha-contabilidade/guias');
  return { ok: true, message: 'Recebimento confirmado.' };
}
