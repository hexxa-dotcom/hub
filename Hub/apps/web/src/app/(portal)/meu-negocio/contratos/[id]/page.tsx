import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SectionHero } from '@/components/ui/SectionHero';
import { getContractDetailAction } from '../actions';
import { ContratoDetailClient } from './ContratoDetailClient';

export const dynamic = 'force-dynamic';

export default async function ContratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getContractDetailAction(id);
  if (!detail) notFound();

  return (
    <div className="w-full space-y-12 pb-20">
      <SectionHero
        title={detail.contract.title}
        subtitulo={`Contrato com ${detail.contract.partyName}`}
        infoTitle="Sobre este contrato"
        infoDescription="As assinaturas das duas partes, o reajuste, a renovação e as parcelas que o contrato lançou no financeiro."
        rightSlot={
          <Link href="/meu-negocio/contratos" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Contratos
          </Link>
        }
      />
      <ContratoDetailClient detail={detail} />
    </div>
  );
}
