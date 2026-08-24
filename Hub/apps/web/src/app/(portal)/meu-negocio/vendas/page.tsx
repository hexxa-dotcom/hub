import { ShoppingBag } from 'lucide-react';
import { VendasView } from './VendasView';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <ShoppingBag className="h-3.5 w-3.5" />
              Faturamento Direto
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Vendas & Recebimentos Avulsos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Registre vendas de produtos ou serviços que não passam por Nota Fiscal — alimentando seu contas a receber e DRE.
          </p>
        </div>
      </header>

      <VendasView />
    </div>
  );
}

