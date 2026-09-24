import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDb, eq, acessosDaEmpresa } from '@hexxa/db';
import { company } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { AcessosClient } from './AcessosClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Acessos | Hexx Digital' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = getDb();

  const [comp] = await db.select().from(company).where(eq(company.id, id));
  if (!comp) notFound();

  const acessos = await acessosDaEmpresa(db, id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link
          href={`/contador/clientes/${id}`}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6E6A61] transition-colors hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#F5F6F4]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {comp.legalName}
        </Link>
        <h1 className="mt-3 font-serif text-2xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">
          Acessos
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          A empresa vem do OneFlow completa — cadastro, sócios, plano de contas — e sem
          ninguém que possa entrar nela. Quem convida é você: sabe qual e-mail é o do
          dono, e o cliente não deveria precisar se cadastrar sozinho para depois esperar
          sua autorização.
        </p>
      </div>

      <AcessosClient companyId={id} razaoSocial={comp.legalName} iniciais={acessos} />
    </div>
  );
}
