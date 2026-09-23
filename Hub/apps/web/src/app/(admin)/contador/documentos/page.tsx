import { getDb, withDbTimeout, company } from '@hexxa/db';
import { isNull } from 'drizzle-orm';
import { requireAdmin } from '@/lib/server/admin-guard';
import { listarEntregasDoEscritorio, TIPOS_DE_DOCUMENTO } from '@/lib/server/entregas';
import { DocumentosDoEscritorio } from './DocumentosDoEscritorio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Documentos | Hexxa Hub' };

export default async function Page({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await requireAdmin();
  const { cliente } = await searchParams;
  const [empresas, entregas] = await Promise.all([
    withDbTimeout(
      getDb()
        .select({ id: company.id, nome: company.legalName })
        .from(company)
        .where(isNull(company.closedAt))
        .orderBy(company.legalName),
      8000,
    ),
    listarEntregasDoEscritorio(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">Documentos</h1>
        <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          O que o escritório entrega aos clientes, com protocolo e histórico de abertura. As guias de imposto do
          OneFlow entram aqui sozinhas.
        </p>
      </div>
      <DocumentosDoEscritorio empresas={empresas} entregas={entregas} tipos={TIPOS_DE_DOCUMENTO} clienteInicial={cliente ?? ''} />
    </div>
  );
}
