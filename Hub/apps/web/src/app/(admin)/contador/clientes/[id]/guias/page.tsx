export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt } from 'lucide-react';
import { getDb, eq, AdminTaxGuideRepository, withDbTimeout } from '@hexxa/db';
import { company } from '@hexxa/db/schema';
import { HubGuiasAdmin } from './HubGuiasAdmin';

export default async function ContadorGuiasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [comp] = await withDbTimeout(db.select().from(company).where(eq(company.id, id)), 8000);
  if (!comp) notFound();

  let guias: Awaited<ReturnType<AdminTaxGuideRepository['listByCompany']>> = [];
  try {
    guias = await withDbTimeout(new AdminTaxGuideRepository().listByCompany(db, id), 8000);
  } catch (err) {
    console.error('[ContadorGuiasPage] falha ao carregar guias:', err);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link href={`/contador/clientes/${id}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            Guias &amp; Parcelamentos — {comp.useTradeName && comp.tradeName ? comp.tradeName : comp.legalName}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
            Envie guias avulsas ou cadastre um parcelamento — aparece automaticamente na Contabilidade do cliente, pra ele baixar e marcar como pago.
          </p>
        </div>
      </div>

      <HubGuiasAdmin companyId={id} initial={guias} />
    </div>
  );
}
