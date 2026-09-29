import Link from 'next/link';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { TecladoDoCodigo } from '../TecladoDoCodigo';
import { criarCodigoAction } from '../actions';

export const dynamic = 'force-dynamic';

/** Depois do login completo: cria (ou troca) o código rápido. Opcional. */
export default async function CriarCodigoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next || '/cliente';
  const seguro = next.startsWith('/') && !next.startsWith('//') ? next : '/cliente';

  async function criar(codigo: string) {
    'use server';
    return criarCodigoAction(codigo, seguro);
  }

  return (
    <AuthLayout
      type={seguro.startsWith('/contador') ? 'contador' : 'cliente'}
      title="Código de acesso rápido"
      subtitle="Nos próximos acessos deste aparelho, é só digitar os 4 números. O login pelo e-mail volta a cada 30 dias."
    >
      <div className="flex w-full flex-col items-center gap-6">
        <TecladoDoCodigo enviar={criar} confirmar />
        <Link href={seguro as never} className="text-xs font-medium text-white/60 hover:text-[#DFFFAE]">
          Agora não
        </Link>
      </div>
    </AuthLayout>
  );
}
