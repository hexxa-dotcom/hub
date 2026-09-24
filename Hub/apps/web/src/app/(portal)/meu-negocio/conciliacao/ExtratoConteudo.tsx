import { ConciliacaoClient } from './ConciliacaoClient';
import { getReconciliationData } from './actions';
import { contasDaEmpresa, janelaDeHistorico } from './extrato-actions';
import { SubirExtrato } from './SubirExtrato';
import { CardStatusConciliacao } from './CardStatusConciliacao';
import { FilaDeAcoes } from '@/components/agente/FilaDeAcoes';
import { listarFilas } from '@/lib/server/fila-agente';

/**
 * O EXTRATO DENTRO DO FINANCEIRO.
 *
 * Subir o arquivo do banco, ver o que já bateu com os lançamentos e decidir o
 * que a classificação automática não resolveu. Morava numa tela separada
 * (Conciliação) que o cliente quase não encontrava; agora é a aba Extrato.
 */
export async function ExtratoConteudo() {
  const [data, contas, desde, filas] = await Promise.all([
    getReconciliationData(),
    contasDaEmpresa(),
    janelaDeHistorico(),
    // Só a classificação de lançamento: o fechamento de mês é decidido na
    // tela de Fechamento, não aqui no meio do extrato.
    listarFilas(['CLASSIFICAR_LANCAMENTO']).catch(() => null),
  ]);

  return (
    <div className="space-y-10">
      {/* 2. Importar Extrato e Status / Tudo em Dia (lado a lado em cards separados) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <SubirExtrato contas={contas} desde={desde} />
        <CardStatusConciliacao
          transactions={data.transactions}
          entries={data.entries}
          contas={contas}
        />
      </div>

      {/* Enquanto não há Open Finance: o extrato sobe à mão (ao lado), e a
          conexão direta com o banco é o próximo passo. */}
      <p className="text-xs text-ink-soft">
        Conexão direta com o banco (Open Finance) em breve — o extrato vai chegar sozinho todo dia. Por enquanto, suba o arquivo do banco
        (OFX ou CSV) no cartão acima.
      </p>

      {/* 3. Área de Conciliação e Categorização (com agrupamento por categoria em acordeom) */}
      <ConciliacaoClient
        transactions={data.transactions}
        entries={data.entries}
        categories={data.categories}
      />

      {/* 4. Fila de Ações do Agente */}
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
