import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileSignature } from 'lucide-react';
import { getContractDetailAction } from '../actions';
import { ContratoDetailClient } from './ContratoDetailClient';

export const dynamic = 'force-dynamic';

export default async function ContratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getContractDetailAction(id);
  if (!detail) notFound();

  return (
    <div className="mx-auto max-w-4xl w-full space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link
          href="/meu-negocio/contratos"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <FileSignature className="h-3.5 w-3.5" />
              Vínculo
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3] leading-tight">
            {detail.contract.title}
          </h1>
        </div>
      </div>

      <ContratoDetailClient detail={detail} />
    </div>
  );
}
