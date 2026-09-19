import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDb, eq, sql, contasDoPlano } from '@hexxa/db';
import { company } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { AberturaClient } from './AberturaClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Saldos de abertura | Hexxa Hub' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = getDb();

  const [comp] = await db.select().from(company).where(eq(company.id, id));
  if (!comp) notFound();

  const [contas, aberturas] = await Promise.all([
    contasDoPlano(db, id),
    db.execute(sql`
      SELECT to_char(entry_date, 'DD/MM/YYYY') AS quando
        FROM journal_entry
       WHERE company_id = ${id} AND source = 'OPENING' AND reversed_by IS NULL
       LIMIT 1
    `) as unknown as Promise<{ quando: string }[]>,
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <Link
          href={`/contador/clientes/${id}`}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6E6A61] transition-colors hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#F5F6F4]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {comp.legalName}
        </Link>
        <h1 className="mt-3 font-serif text-2xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">
          Saldos de abertura
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          A empresa que troca de contabilidade não traz lançamentos — traz um balancete.
          Os lançamentos que produziram aqueles saldos ficaram com quem os fez, e é assim
          que deve ser: reconstruí-los seria inventar detalhe que ninguém verificou.
        </p>
      </div>

      <AberturaClient
        companyId={id}
        razaoSocial={comp.legalName}
        contas={contas}
        jaAberta={aberturas[0]?.quando ?? null}
      />
    </div>
  );
}
