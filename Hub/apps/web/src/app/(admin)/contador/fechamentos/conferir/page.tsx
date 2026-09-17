import Link from 'next/link';
import { requireAdmin } from '@/lib/server/admin-guard';
import { listarAguardando } from './actions';
import { ConferirClient } from './ConferirClient';

export const dynamic = 'force-dynamic';

export default async function ConferirPage() {
  await requireAdmin();

  let itens: Awaited<ReturnType<typeof listarAguardando>> = [];
  try {
    itens = await listarAguardando();
  } catch (err) {
    console.error('[contador/fechamentos/conferir] falha ao listar:', err);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/contador/fechamentos" className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
          ← Fechamentos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#231F20] dark:text-[#F5F6F4]">Conferir e liberar</h1>
        <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          A IA já apurou, conferiu e trancou o mês para o cliente. Aqui você bate o olho e libera
          para a contabilidade.
        </p>
      </div>

      <ConferirClient inicial={itens} />
    </div>
  );
}
