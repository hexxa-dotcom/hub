import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, desc } from '@hexxa/db';
import { monthlyClosure } from '@hexxa/db/schema';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SectionHero } from '@/components/ui/SectionHero';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { Painel, Rodape, pct } from '../_ui';
import { ControlesDoRelatorio } from './ControlesDoRelatorio';
import { FilaDeAcoes } from '@/components/agente/FilaDeAcoes';
import { listarFilas } from '@/lib/server/fila-agente';

const ROTULO_DO_ESTAGIO: Record<string, string> = {
  ABERTO: 'Em aberto',
  FECHADO: 'Fechado, em conferência',
  CONFERIDO: 'Liberado pelo contador',
  ENVIADO: 'Enviado à contabilidade',
  REABERTO: 'Reaberto',
};

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function FechamentoReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await getTenantContext();
  const { month: selectedMonth } = await searchParams;

  // Buscar todos os fechamentos da empresa
  let closures: any[] = [];
  try {
    closures = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select()
        .from(monthlyClosure)
        .where(eq(monthlyClosure.companyId, ctx.companyId))
        .orderBy(desc(monthlyClosure.referenceMonth));
    });
  } catch (error) {
    console.error('[fechamento/page] falha ao listar fechamentos:', error);
  }

  if (!closures || closures.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-16 pb-10">
        <SectionHero subtitulo="O resumo do mês fechado" title="Fechamento do mês" infoTitle="Sobre o Fechamento" infoDescription="O resumo de cada mês fechado, com a situação na contabilidade." />
        <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
          Nenhum mês fechado ainda. O fechamento é feito no começo de cada mês, e o resumo aparece aqui.{' '}
          <Link href="/cliente" className="font-semibold text-ink underline-offset-4 hover:underline">Voltar ao início</Link>
        </p>
      </div>
    );
  }

  // Pegar o fechamento selecionado ou o mais recente
  let closure = closures[0];

  if (selectedMonth) {
    const found = closures.find(c => c.referenceMonth === selectedMonth);
    if (found) closure = found;
  }

  const [year, month] = closure.referenceMonth.split('-');
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const totalRev = Number(closure.totalRevenue);
  const totalExp = Number(closure.totalExpenses);
  const result = totalRev - totalExp;
  const isProfit = result >= 0;

  /**
   * O fechamento que o agente quer dar por encerrado e está travado.
   *
   * Fica aqui, e não numa tela própria de "o que a IA fez": a decisão é sobre
   * este mês, e quem decide precisa ver o mês na frente. A classificação de
   * lançamento, que é o outro tipo de pendência, mora na Conciliação.
   */
  const fila = await listarFilas(['FECHAR_MES']).catch(() => null);

  return (
    <div className="mx-auto max-w-4xl space-y-16 pb-10">
      {fila && fila.aprovacao.length > 0 && (
        <div className="print:hidden">
          <FilaDeAcoes
            inicial={fila}
            titulos={{
              aprovacao: {
                titulo: 'Esperando você decidir',
                descricao:
                  'O fechamento só é concluído depois da sua aprovação — nada é enviado à contabilidade antes disso.',
                vazio: 'Nenhum fechamento esperando decisão.',
              },
              revisao: {
                titulo: 'Fechamentos concluídos sozinhos',
                descricao: 'Concluídos dentro do que o agente pode fazer sem perguntar.',
                vazio: 'Nenhum.',
              },
            }}
          />
        </div>
      )}

      <SectionHero
        subtitulo="O resumo do mês fechado"
        title={`Fechamento · ${monthName}`}
        infoTitle="Sobre o Fechamento"
        infoDescription="O resumo de cada mês fechado e a situação dele na contabilidade: em conferência, liberado pelo contador ou enviado."
        className="print:hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-ink-soft">
          Situação: <strong className={closure.stage === 'ENVIADO' || closure.stage === 'CONFERIDO' ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink'}>{ROTULO_DO_ESTAGIO[closure.stage as string] ?? 'Em aberto'}</strong>
        </p>
        <ControlesDoRelatorio
          atual={closure.referenceMonth}
          meses={closures.map((c) => {
            const [y, m] = String(c.referenceMonth).split('-');
            return {
              valor: c.referenceMonth,
              rotulo: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            };
          })}
        />
      </div>

      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo="Resultado do mês" valor={BRL.format(result)} nota={totalRev > 0 ? `Margem de ${pct((result / totalRev) * 100)}` : 'Sem receita no mês'} tom={isProfit ? 'padrao' : 'alerta'} />
        <CardResumo rotulo="Entradas" valor={BRL.format(totalRev)} nota="Receitas do mês" />
        <CardResumo rotulo="Saídas" valor={BRL.format(totalExp)} nota="Despesas do mês" />
      </GradeDeResumo>

      <Painel titulo="O que chamou atenção">
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          <li className="flex items-center justify-between gap-4 py-3">
            <span className="text-ink">Contratos novos no mês</span>
            <span className="font-serif font-bold tabular text-ink">{closure.newContractsCount || 0}</span>
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <span className="text-ink">
              Recebimentos em atraso
              {closure.defaultsCount > 0 && (
                <span className="text-ink-soft">
                  {' '}— veja em{' '}
                  <Link href="/meu-negocio/hub-financeiro" className="font-semibold text-ink underline-offset-4 hover:underline">Meu mês</Link>
                </span>
              )}
            </span>
            <span className={`font-serif font-bold tabular ${closure.defaultsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink'}`}>{closure.defaultsCount || 0}</span>
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <span className="text-ink">
              Guias de imposto do mês — chegam na{' '}
              <Link href="/minha-contabilidade/guias" className="font-semibold text-ink underline-offset-4 hover:underline">Central de Guias</Link>
            </span>
            <span />
          </li>
        </ul>
      </Painel>

      <Rodape>
        Hexx Digital · fechamento registrado em {new Date(closure.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        {closure.stage === 'ENVIADO' ? ' · a contabilidade já recebeu estes dados' : ''}
      </Rodape>
    </div>
  );
}
