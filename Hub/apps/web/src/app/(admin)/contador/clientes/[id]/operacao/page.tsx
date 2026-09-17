import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb, eq } from '@hexxa/db';
import { company } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { carregarConfiguracao } from './actions';
import { OperacaoClient } from './OperacaoClient';

export const dynamic = 'force-dynamic';

export default async function OperacaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [comp] = await getDb()
    .select({ id: company.id, nome: company.legalName, fantasia: company.tradeName })
    .from(company)
    .where(eq(company.id, id));

  if (!comp) notFound();

  const cfg = await carregarConfiguracao(id);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href={`/contador/clientes/${id}`}
          className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]"
        >
          ← {comp.fantasia || comp.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#231F20] dark:text-[#F5F6F4]">Operação</h1>
        <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          O que a IA pode fazer com a contabilidade desta empresa.
        </p>
      </div>

      <OperacaoClient inicial={cfg} />
    </div>
  );
}
