import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, desc } from '@hexxa/db';
import { monthlyClosure } from '@hexxa/db/schema';
import { redirect } from 'next/navigation';
import { FileText, CheckCircle2, TrendingUp, TrendingDown, Clock, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import { ControlesDoRelatorio } from './ControlesDoRelatorio';
import { FilaDeAcoes } from '@/components/agente/FilaDeAcoes';
import { listarFilas } from '@/lib/server/fila-agente';

const ROTULO_DO_ESTAGIO: Record<string, string> = {
  ABERTO: 'EM ABERTO',
  FECHADO: 'FECHADO — EM CONFERÊNCIA',
  CONFERIDO: 'LIBERADO PELO CONTADOR',
  ENVIADO: 'ENVIADO À CONTABILIDADE',
  REABERTO: 'REABERTO',
};

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function FechamentoReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const ctx = await getTenantContext();

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
      <div className="mx-auto max-w-4xl space-y-6 text-center py-20">
        <Clock className="h-12 w-12 mx-auto text-ink-soft opacity-50 mb-4" />
        <h1 className="font-bold text-2xl text-ink">Nenhum fechamento encontrado</h1>
        <p className="text-sm text-ink-soft">
          O fechamento é gerado automaticamente no dia 1º de cada mês.<br/>
          Quando o próximo mês iniciar, seu relatório estará disponível aqui.
        </p>
        <Link href="/dashboard" className="inline-flex mt-4 items-center gap-2 text-xs font-bold text-hexxa-green dark:text-hexxa-lime hover:underline">
          Voltar ao Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // Pegar o fechamento selecionado ou o mais recente
  const selectedMonth = searchParams.month;
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
    <div className="mx-auto max-w-4xl space-y-16 pb-10 animate-fade-up">
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

      {/* Header com botões */}
      <SectionHero
        subtitulo="O resumo contábil do mês fechado"
        title={`Relatório de Fechamento — ${monthName}`}
        infoTitle="Sobre o Fechamento Mensal"
        infoDescription="Dados consolidados e enviados para a rotina contábil mensal."
        className="print:hidden capitalize"
        rightSlot={
          <ControlesDoRelatorio
            atual={closure.referenceMonth}
            meses={closures.map((c) => {
              const [y, m] = String(c.referenceMonth).split('-');
              return {
                valor: c.referenceMonth,
                rotulo: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
              };
            })}
          />
        }
      />

      {/* Relatório (Printable Area) */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        {/* Banner do Status */}
        <div className="bg-hexxa-forest px-8 py-6 text-hexxa-cream flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="font-serif font-bold text-xl text-hexxa-lime">Resumo do Mês</h2>
            <p className="text-caption text-hexxa-lime/80 mt-1 print:text-slate-600">
              Dados consolidados para contabilidade
            </p>
          </div>
          {/*
            O estágio verdadeiro do mês. O selo era fixo em "ENVIADO À
            CONTABILIDADE" para qualquer mês com registro — inclusive os que
            ninguém tinha fechado.
          */}
          <div className="flex items-center gap-2 bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) border border-hexxa-lime/20 px-4 py-1.5 rounded-full">
            {closure.stage === 'ENVIADO' || closure.stage === 'CONFERIDO' ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            <span className="text-xs font-bold tracking-wide">{ROTULO_DO_ESTAGIO[closure.stage as string] ?? 'EM ABERTO'}</span>
          </div>
        </div>

        {/* Corpo do Relatório */}
        <div className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1 border-l-2 border-emerald-600 pl-4">
              <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Entradas (Receitas)</p>
              <p className="font-serif text-2xl font-bold text-ink tabular">{BRL.format(totalRev)}</p>
            </div>
            
            <div className="space-y-1 border-l-2 border-red-600 pl-4">
              <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Saídas (Despesas)</p>
              <p className="font-serif text-2xl font-bold text-ink tabular">{BRL.format(totalExp)}</p>
            </div>
            
            <div className="space-y-1 border-l-2 border-hexxa-forest dark:border-hexxa-lime pl-4">
              <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Resultado Líquido</p>
              <p className={`font-serif text-2xl font-bold tabular ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {BRL.format(result)}
              </p>
            </div>

            <div className="space-y-1 border-l-2 border-amber-600 pl-4">
              <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Inadimplência (Atrasos)</p>
              <p className="font-serif text-2xl font-bold text-ink tabular">{closure.defaultsCount || 0}</p>
            </div>
          </div>

          <div className="h-px w-full bg-black/5 dark:bg-white/10" />

          {/* Destaques e alertas calculados a partir do fechamento real */}
          <div className="grid md:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h3 className="flex items-center gap-2 font-serif font-bold text-base text-ink">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Destaques Positivos
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) shrink-0">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">Novos Contratos</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Você fechou <strong className="text-ink">{closure.newContractsCount || 0} contratos novos</strong> neste mês.
                    </p>
                  </div>
                </li>
                {isProfit && (
                  <li className="flex items-start gap-3 bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) shrink-0">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink">Margem Positiva</p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        Sua margem de lucro neste fechamento foi de <strong className="text-ink tabular">{totalRev > 0 ? ((result / totalRev) * 100).toFixed(1) : 0}%</strong>.
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="flex items-center gap-2 font-serif font-bold text-base text-ink">
                <Clock className="h-5 w-5 text-amber-600" />
                Atenção Contábil
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">Notas Fiscais</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      As notas fiscais deste período já foram computadas para a geração da DAS/Impostos, disponível na aba <strong>Guias de Impostos</strong>.
                    </p>
                  </div>
                </li>
                {closure.defaultsCount > 0 && (
                  <li className="flex items-start gap-3 bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      <TrendingDown className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink">Inadimplentes</p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        Existem faturas não pagas neste mês. Recomendamos acessar Meu mês para acionar a régua de cobrança automática.
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>
          </div>

          <div className="mt-8 text-center pt-8 border-t border-black/5 dark:border-white/10 text-xs text-ink-soft print:pt-4">
            <p>Hexxa Hub — Documento auxiliar gerado automaticamente em {new Date(closure.createdAt).toLocaleString('pt-BR')}.</p>
            {closure.stage === 'ENVIADO' && <p>A contabilidade já recebeu estes dados para processamento.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
