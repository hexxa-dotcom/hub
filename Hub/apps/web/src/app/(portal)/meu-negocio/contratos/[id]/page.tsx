import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getContractDetailAction } from '../actions';
import { ContratoDetailClient } from './ContratoDetailClient';

import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function ContratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getContractDetailAction(id);
  if (!detail) notFound();

  return (
    <div className="mx-auto max-w-4xl w-full space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex items-center gap-4">
          <Link
            href="/meu-negocio/contratos"
            className="tap-target pressable focusable grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-card border border-black/5 dark:border-white/5 text-ink-soft hover:text-ink shadow-(--elev-1) transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              {detail.contract.title}
            </h1>
          </div>
        </div>
      </Card>

      <ContratoDetailClient detail={detail} />
    </div>
  );
}
