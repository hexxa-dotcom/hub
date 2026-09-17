import { ConciliacaoClient } from './ConciliacaoClient';
import { getReconciliationData } from './actions';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Conciliação Bancária | Hexxa Hub',
};

export default async function Page() {
  const data = await getReconciliationData();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-in fade-in">
      <Card level={2} tone="deep" className="card-finish">
        <div className="flex flex-col gap-4">
          <Link 
            href="/meu-negocio/hub-financeiro"
            className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors w-fit rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-3.5 py-1.5 shadow-(--elev-1)"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Hub Financeiro
          </Link>
          <div>
            <h1 className="text-display font-serif text-ink tracking-tight">Conciliação Bancária</h1>
            <p className="mt-1 text-footnote text-ink-soft">
              Vincule as transações do extrato bancário com os lançamentos pendentes no Hub com inteligência artificial.
            </p>
          </div>
        </div>
      </Card>

      <ConciliacaoClient transactions={data.transactions} entries={data.entries} />
    </div>
  );
}
