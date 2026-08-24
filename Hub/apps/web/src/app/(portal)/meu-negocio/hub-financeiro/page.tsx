import { TrendingUp, Sparkles } from 'lucide-react';
import { HubFinanceiro } from './HubFinanceiro';

export default function Page() {
  return (
    <div className="mx-auto w-full space-y-7 animate-fade-up">
      <header className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Gestão Financeira
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              Hub Financeiro
            </h1>
            <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-xl">
              Contas a pagar, a receber, conciliação bancária e fluxo de caixa — tudo integrado com a sua contabilidade.
              O Balanço e o DRE ficam na aba Contabilidade.
            </p>
          </div>
        </div>
      </header>

      <HubFinanceiro />
    </div>
  );
}
