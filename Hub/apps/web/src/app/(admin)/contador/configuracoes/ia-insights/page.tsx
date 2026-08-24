import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAiInsightSettingsAction } from './actions';
import { IaInsightsClient } from './IaInsightsClient';

export const dynamic = 'force-dynamic';

export default async function IaInsightsPage() {
  const settings = await getAiInsightSettingsAction();

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link
          href="/contador/configuracoes"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3] leading-tight">Hexxa Insights</h1>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
            Dicas contextuais por IA nas telas dos clientes — gerencie a chave, ligue/desligue globalmente ou por seção.
          </p>
        </div>
      </div>

      <IaInsightsClient initial={settings} />
    </div>
  );
}
