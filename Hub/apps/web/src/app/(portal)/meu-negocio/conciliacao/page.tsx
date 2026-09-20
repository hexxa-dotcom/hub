import { ConciliacaoClient } from './ConciliacaoClient';
import { getReconciliationData } from './actions';
import { contasDaEmpresa, janelaDeHistorico } from './extrato-actions';
import { SubirExtrato } from './SubirExtrato';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const metadata = {
  title: 'Conciliação Bancária | Hexxa Hub',
};

export default async function Page() {
  const [data, contas, desde] = await Promise.all([
    getReconciliationData(), contasDaEmpresa(), janelaDeHistorico(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <Link 
              href="/meu-negocio/hub-financeiro"
              className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors w-fit rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-3.5 py-1.5 shadow-(--elev-1)"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Link>
            <SectionInfo
              title="Sobre a Conciliação Bancária"
              description="Vincule as transações do extrato bancário com os lançamentos pendentes no Hub com inteligência artificial."
            />
          </div>
          <div className="shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              Conciliação Bancária
            </h1>
          </div>
        </div>
      </Card>

      <SubirExtrato contas={contas} desde={desde} />

      <ConciliacaoClient transactions={data.transactions} entries={data.entries} />
    </div>
  );
}
