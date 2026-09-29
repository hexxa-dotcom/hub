import { redirect } from 'next/navigation';
import { getDb, appUser, eq } from '@hexxa/db';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { createClient } from '@/lib/supabase/server';
import { TecladoDoCodigo } from './TecladoDoCodigo';
import { entrarComCodigoAction, sairAction } from './actions';

export const dynamic = 'force-dynamic';

/** Login rápido: o aparelho já sabe quem é — só os 4 números. */
export default async function RapidoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next || '/cliente';
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect('/auth/login' as never);

  const [u] = await getDb().select({ name: appUser.name, hash: appUser.codigoRapidoHash }).from(appUser).where(eq(appUser.authUid, user!.id));
  if (!u?.hash) redirect(`/auth/login?next=${encodeURIComponent(next)}` as never);
  const primeiroNome = u!.name.split(' ')[0];

  async function entrar(codigo: string) {
    'use server';
    return entrarComCodigoAction(codigo, next);
  }

  return (
    <AuthLayout type={next.startsWith('/contador') ? 'contador' : 'cliente'} title={`Olá, ${primeiroNome}`} subtitle="Digite seu código de acesso">
      <div className="flex w-full flex-col items-center gap-6">
        <TecladoDoCodigo enviar={entrar} />
        <form action={sairAction} className="text-center">
          <p className="text-xs text-white/50">{user!.email}</p>
          <button type="submit" className="mt-1 text-xs font-medium text-[#DFFFAE] hover:underline">
            Não é você? Entrar com outra conta
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
