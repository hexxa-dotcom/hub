import { ConciliacaoClient } from './ConciliacaoClient';
import { getReconciliationData } from './actions';
import { contasDaEmpresa, janelaDeHistorico } from './extrato-actions';
import { SubirExtrato } from './SubirExtrato';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { FilaDeAcoes } from '@/components/agente/FilaDeAcoes';
import { listarFilas } from '@/lib/server/fila-agente';

export const metadata = {
  title: 'Conciliação Bancária | Hexxa Hub',
};

export default async function Page() {
  const [data, contas, desde, filas] = await Promise.all([
    getReconciliationData(),
    contasDaEmpresa(),
    janelaDeHistorico(),
    // Só a classificação de lançamento: o fechamento de mês é decidido na
    // tela de Fechamento, não aqui no meio do extrato.
    listarFilas(['CLASSIFICAR_LANCAMENTO']).catch(() => null),
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

      {filas && (filas.aprovacao.length > 0 || filas.revisao.length > 0) && (
        <FilaDeAcoes
          inicial={filas}
          titulos={{
            aprovacao: {
              titulo: 'Esperando você decidir',
              descricao:
                'Lançamentos que a classificação automática não teve confiança para resolver sozinha.',
              vazio: 'Nenhum lançamento esperando decisão.',
            },
            revisao: {
              titulo: 'Classificado automaticamente',
              descricao:
                'Já lançado na conta indicada. Confirmar ou corrigir aqui melhora as próximas classificações.',
              vazio: 'Tudo o que foi classificado sozinho já passou pela sua conferência.',
            },
          }}
        />
      )}
    </div>
  );
}
