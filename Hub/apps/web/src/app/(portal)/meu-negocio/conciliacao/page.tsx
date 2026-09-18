import { ConciliacaoClient } from './ConciliacaoClient';
import { getReconciliationData } from './actions';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const metadata = {
  title: 'Conciliação Bancária | Hexxa Hub',
};

export default async function Page() {
  const data = await getReconciliationData();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex flex-col gap-3">
          <Link 
            href="/meu-negocio/hub-financeiro"
            className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors w-fit rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-3.5 py-1.5 shadow-(--elev-1)"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Hub Financeiro
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">Conciliação Bancária</h1>
            <SectionInfo
              title="Sobre a Conciliação Bancária"
              description="Vincule as transações do extrato bancário com os lançamentos pendentes no Hub com inteligência artificial."
            />
          </div>
        </div>
      </Card>

      <ConciliacaoClient transactions={data.transactions} entries={data.entries} />
    </div>
  );
}
