import 'server-only';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb, appUser, eq } from '@hexxa/db';
import { resolveAppUser } from '@/lib/server/tenant';
import { TRAVA_COOKIE, DESBLOQUEIO_VALE_MS, assinarTrava, lerTrava, opcoesDaTrava } from '@/lib/auth/trava';

export const ERROS_ATE_LOGIN_COMPLETO = 5;

export function cifrarCodigo(codigo: string): string {
  const sal = randomBytes(16);
  return `${sal.toString('hex')}:${scryptSync(codigo, sal, 32).toString('hex')}`;
}

export function conferirCodigo(codigo: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(':');
  if (!sal || !hash) return false;
  return timingSafeEqual(scryptSync(codigo, Buffer.from(sal, 'hex'), 32), Buffer.from(hash, 'hex'));
}

/** Login completo acabou de acontecer: marca o aparelho e a data. */
export async function registrarLoginCompleto(authUid: string, email: string | undefined) {
  const db = getDb();
  // Religa convite pendente ou conta antiga antes de marcar o login.
  const { id } = await resolveAppUser(authUid, email);
  const [u] = await db
    .update(appUser)
    .set({ ultimoLoginCompleto: new Date(), codigoRapidoErros: 0 })
    .where(eq(appUser.id, id))
    .returning({ hash: appUser.codigoRapidoHash });
  const temCodigo = !!u?.hash;
  const agora = Date.now();
  (await cookies()).set(TRAVA_COOKIE, await assinarTrava({ u: authUid, f: agora, d: agora + DESBLOQUEIO_VALE_MS, p: temCodigo }), opcoesDaTrava);
  return { temCodigo };
}

/** Renova a trava deste aparelho (depois do código rápido ou ao criar o código). */
export async function desbloquear(authUid: string, temCodigo: boolean) {
  const jar = await cookies();
  const atual = await lerTrava(jar.get(TRAVA_COOKIE)?.value);
  if (!atual || atual.u !== authUid) return false;
  jar.set(TRAVA_COOKIE, await assinarTrava({ ...atual, d: Date.now() + DESBLOQUEIO_VALE_MS, p: temCodigo }), opcoesDaTrava);
  return true;
}
