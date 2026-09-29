'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, appUser, eq } from '@hexxa/db';
import { createClient } from '@/lib/supabase/server';
import { resolveAppUser } from '@/lib/server/tenant';
import { TRAVA_COOKIE, lerTrava } from '@/lib/auth/trava';
import { cifrarCodigo, conferirCodigo, desbloquear, ERROS_ATE_LOGIN_COMPLETO } from '@/lib/server/codigo-rapido';

export type ResultadoDoCodigo = { error: string } | null;

const destino = (next: string) => (next.startsWith('/') && !next.startsWith('//') ? next : '/cliente');

async function usuarioDaSessao() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect('/auth/login' as never);
  return user!;
}

/** Sai de vez: encerra a sessão e esquece este aparelho. */
export async function sairAction() {
  await (await createClient()).auth.signOut();
  (await cookies()).delete(TRAVA_COOKIE);
  redirect('/auth/login' as never);
}

export async function entrarComCodigoAction(codigo: string, next: string): Promise<ResultadoDoCodigo> {
  const user = await usuarioDaSessao();
  const trava = await lerTrava((await cookies()).get(TRAVA_COOKIE)?.value);
  if (!trava || trava.u !== user.id) redirect('/auth/login' as never);

  const db = getDb();
  const [u] = await db
    .select({ id: appUser.id, hash: appUser.codigoRapidoHash, erros: appUser.codigoRapidoErros })
    .from(appUser)
    .where(eq(appUser.authUid, user.id));
  if (!u?.hash) redirect('/auth/login' as never);

  if (!/^\d{4}$/.test(codigo) || !conferirCodigo(codigo, u!.hash!)) {
    const erros = u!.erros + 1;
    if (erros >= ERROS_ATE_LOGIN_COMPLETO) {
      // Tentativas esgotadas: só volta com o login completo, pelo e-mail.
      await db.update(appUser).set({ codigoRapidoErros: 0 }).where(eq(appUser.id, u!.id));
      await (await createClient()).auth.signOut();
      (await cookies()).delete(TRAVA_COOKIE);
      redirect('/auth/login?bloqueado=1' as never);
    }
    await db.update(appUser).set({ codigoRapidoErros: erros }).where(eq(appUser.id, u!.id));
    const restam = ERROS_ATE_LOGIN_COMPLETO - erros;
    return { error: `Código incorreto. ${restam === 1 ? 'Resta 1 tentativa' : `Restam ${restam} tentativas`} antes de pedir o login pelo e-mail.` };
  }

  await db.update(appUser).set({ codigoRapidoErros: 0 }).where(eq(appUser.id, u!.id));
  await desbloquear(user.id, true);
  redirect(destino(next) as never);
}

const FRACOS = new Set(['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210']);

export async function criarCodigoAction(codigo: string, next: string): Promise<ResultadoDoCodigo> {
  const user = await usuarioDaSessao();
  // Criar/trocar o código só com o aparelho desbloqueado — senão trocar o
  // código viraria um jeito de pular a trava.
  const trava = await lerTrava((await cookies()).get(TRAVA_COOKIE)?.value);
  if (!trava || trava.u !== user.id || (trava.p && Date.now() > trava.d)) redirect('/auth/login' as never);

  if (!/^\d{4}$/.test(codigo)) return { error: 'O código tem 4 números.' };
  if (/^(\d)\1{3}$/.test(codigo) || FRACOS.has(codigo)) return { error: 'Fácil demais de adivinhar — escolha outro.' };

  const { id } = await resolveAppUser(user.id, user.email);
  await getDb().update(appUser).set({ codigoRapidoHash: cifrarCodigo(codigo), codigoRapidoErros: 0 }).where(eq(appUser.id, id));
  await desbloquear(user.id, true);
  redirect(destino(next) as never);
}
