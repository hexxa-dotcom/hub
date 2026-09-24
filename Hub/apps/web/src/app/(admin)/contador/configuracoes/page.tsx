import Link from 'next/link';
import type { Route } from 'next';
import { Sparkles, ArrowRight } from 'lucide-react';
import { requireAdmin } from '@/lib/server/admin-guard';
import { dadosDoEscritorio } from '@/lib/server/escritorio';
import { DadosDoEscritorio } from './DadosDoEscritorio';

export const dynamic = 'force-dynamic';

export default async function AdminConfiguracoes() {
  await requireAdmin();
  const escritorio = await dadosDoEscritorio();

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">Configurações Gerais</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Os dados do escritório que os clientes veem, e as dicas por IA</p>
      </div>

      <DadosDoEscritorio inicial={escritorio} />

      <Link
        href={'/contador/configuracoes/ia-insights' as Route}
        className="block rounded-3xl border border-black/5 dark:border-white/10 bg-[#1E3328] p-6 shadow-sm relative overflow-hidden group hover:scale-[1.005] transition-transform"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DFFFAE]/15 text-[#DFFFAE]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-base text-[#F5F6F4]">Hexx Insights</h3>
            <p className="text-xs text-[#DFFFAE]/70 mt-0.5">
              Dicas contextuais por IA nas telas dos clientes — chave da API, liga/desliga geral e por seção.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-[#DFFFAE] shrink-0 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  );
}
