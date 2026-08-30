import { ConciliacaoClient } from './ConciliacaoClient';
import { getReconciliationData } from './actions';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Conciliação Bancária | Hexxa Hub',
};

export default async function Page() {
  const data = await getReconciliationData();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-in fade-in">
      <header className="flex flex-col gap-4">
        <Link 
          href="/meu-negocio/hub-financeiro"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Hub Financeiro
        </Link>
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">Conciliação Bancária</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Vincule as transações do extrato bancário com os lançamentos pendentes no Hub.
          </p>
        </div>
      </header>

      <ConciliacaoClient transactions={data.transactions} entries={data.entries} />
    </div>
  );
}
