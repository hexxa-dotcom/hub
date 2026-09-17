import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, desc } from '@hexxa/db';
import { monthlyClosure } from '@hexxa/db/schema';
import { redirect } from 'next/navigation';
import { FileText, Printer, CheckCircle2, TrendingUp, TrendingDown, Clock, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

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
        <h1 className="font-serif font-bold text-2xl text-ink">Nenhum fechamento encontrado</h1>
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
    const found = closures.find(c => c.reference_month === selectedMonth);
    if (found) closure = found;
  }

  const [year, month] = closure.reference_month.split('-');
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const totalRev = Number(closure.total_revenue);
  const totalExp = Number(closure.total_expenses);
  const result = totalRev - totalExp;
  const isProfit = result >= 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      {/* Header com botões */}
      <Card level={2} tone="deep" className="card-finish print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-display font-serif text-ink tracking-tight capitalize">
              Relatório de Fechamento — {monthName}
            </h1>
            <p className="mt-1 text-footnote text-ink-soft">
              Dados consolidados e enviados para a rotina contábil mensal.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select 
                className="appearance-none rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2 text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
                defaultValue={closure.reference_month}
                onChange={(e) => {
                  if (typeof window !== 'undefined') {
                    window.location.href = `/meu-negocio/relatorios/fechamento?month=${e.target.value}`;
                  }
                }}
              >
                {closures.map(c => {
                  const [y, m] = c.reference_month.split('-');
                  const n = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                  return <option key={c.reference_month} value={c.reference_month}>{n}</option>;
                })}
              </select>
            </div>
            
            <button 
              onClick={() => { if (typeof window !== 'undefined') window.print(); }}
              className="flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </div>
        </div>
      </Card>

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
          <div className="flex items-center gap-2 bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) border border-hexxa-lime/20 px-4 py-1.5 rounded-full">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-bold tracking-wide">ENVIADO À CONTABILIDADE</span>
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
              <p className="font-serif text-2xl font-bold text-ink tabular">{closure.defaults_count || 0}</p>
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
                      Você fechou <strong className="text-ink">{closure.new_contracts_count || 0} contratos novos</strong> neste mês.
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
                {closure.defaults_count > 0 && (
                  <li className="flex items-start gap-3 bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4 rounded-2xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      <TrendingDown className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink">Inadimplentes</p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        Existem faturas não pagas neste mês. Recomendamos acessar o Hub Financeiro para acionar a régua de cobrança automática.
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>
          </div>

          <div className="mt-8 text-center pt-8 border-t border-black/5 dark:border-white/10 text-xs text-ink-soft print:pt-4">
            <p>Hexxa Hub — Documento auxiliar gerado automaticamente em {new Date(closure.created_at).toLocaleString('pt-BR')}.</p>
            <p>A contabilidade já recebeu estes dados para processamento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
