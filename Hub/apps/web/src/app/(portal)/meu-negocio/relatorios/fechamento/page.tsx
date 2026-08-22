import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, desc } from '@hexxa/db';
import { monthlyClosure } from '@hexxa/db/schema';
import { redirect } from 'next/navigation';
import {  FileText, Printer, CheckCircle, TrendUp, TrendDown, Clock, Users, ArrowRight  } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

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
  } catch (error) {}

  if (!closures || closures.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 text-center py-20">
        <Clock className="h-12 w-12 mx-auto text-ink-soft opacity-50 mb-4" />
        <h1 className="text-2xl font-bold text-ink">Nenhum fechamento encontrado</h1>
        <p className="text-ink-soft">
          O fechamento é gerado automaticamente no dia 1º de cada mês.<br/>
          Quando o próximo mês iniciar, seu relatório estará disponível aqui.
        </p>
        <Link href="/dashboard" className="inline-flex mt-4 items-center gap-2 text-brand-600 font-semibold hover:underline">
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-brand-500" />
            <span className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Relatório de Fechamento</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink capitalize">
            {monthName}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              className="appearance-none bg-surface-card border border-line rounded-xl px-4 py-2 pr-8 text-sm font-medium outline-none focus:border-brand-500"
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
            className="flex items-center gap-2 rounded-xl border border-line bg-surface-card px-4 py-2 text-sm font-semibold hover:bg-black/5 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </header>

      {/* Relatório (Printable Area) */}
      <div className="bg-surface-card rounded-3xl border border-line shadow-xl overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        
        {/* Banner do Status */}
        <div className="bg-brand-600 px-8 py-6 text-white flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="text-xl font-bold">Resumo do Mês</h2>
            <p className="text-brand-100 text-sm mt-1 print:text-slate-600">
              Dados consolidados para contabilidade
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm print:border print:bg-transparent">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-bold tracking-wide">ENVIADO À CONTABILIDADE</span>
          </div>
        </div>

        {/* Corpo do Relatório */}
        <div className="p-8 space-y-8">
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1 border-l-2 border-ok pl-4">
              <p className="text-sm text-ink-soft font-medium">Entradas (Receitas)</p>
              <p className="text-2xl font-bold text-ink">{BRL.format(totalRev)}</p>
            </div>
            
            <div className="space-y-1 border-l-2 border-critical pl-4">
              <p className="text-sm text-ink-soft font-medium">Saídas (Despesas)</p>
              <p className="text-2xl font-bold text-ink">{BRL.format(totalExp)}</p>
            </div>
            
            <div className="space-y-1 border-l-2 border-brand-500 pl-4">
              <p className="text-sm text-ink-soft font-medium">Resultado Líquido</p>
              <p className={`text-2xl font-bold ${isProfit ? 'text-ok' : 'text-critical'}`}>
                {BRL.format(result)}
              </p>
            </div>

            <div className="space-y-1 border-l-2 border-warn pl-4">
              <p className="text-sm text-ink-soft font-medium">Inadimplência (Atrasos)</p>
              <p className="text-2xl font-bold text-ink">{closure.defaults_count || 0}</p>
            </div>
          </div>

          <div className="h-px w-full bg-line" />

          {/* Destaques e alertas calculados a partir do fechamento real */}
          <div className="grid md:grid-cols-2 gap-8">
            
            <section className="space-y-4">
              <h3 className="flex items-center gap-2 font-bold text-lg text-ink">
                <TrendUp className="h-5 w-5 text-ok" />
                Destaques Positivos
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-surface-card border border-line dark:bg-white/5 p-4 rounded-2xl">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ok/20 text-ok shrink-0">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Novos Contratos</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Você fechou <strong>{closure.new_contracts_count || 0} contratos novos</strong> neste mês.
                    </p>
                  </div>
                </li>
                {isProfit && (
                  <li className="flex items-start gap-3 bg-surface-card border border-line dark:bg-white/5 p-4 rounded-2xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-brand-600 shrink-0">
                      <TrendUp className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">Margem Positiva</p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        Sua margem de lucro neste fechamento foi de <strong>{totalRev > 0 ? ((result / totalRev) * 100).toFixed(1) : 0}%</strong>.
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="flex items-center gap-2 font-bold text-lg text-ink">
                <Clock className="h-5 w-5 text-warn" />
                Atenção Contábil
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-critical/5 p-4 rounded-2xl">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-critical/20 text-critical shrink-0">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Notas Fiscais</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      As notas fiscais deste período já foram computadas para a geração da DAS/Impostos, que estará disponível na aba <strong>Guias de Impostos</strong>.
                    </p>
                  </div>
                </li>
                {closure.defaults_count > 0 && (
                  <li className="flex items-start gap-3 bg-warn/10 p-4 rounded-2xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warn/20 text-warn shrink-0">
                      <TrendDown className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">Inadimplentes</p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        Existem faturas não pagas neste mês. Recomendamos acessar o Hub Financeiro para acionar a régua de cobrança automática.
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>

          </div>

          <div className="mt-8 text-center pt-8 border-t border-line text-xs text-ink-soft print:pt-4">
            <p>Hexxa Hub — Documento auxiliar gerado automaticamente em {new Date(closure.created_at).toLocaleString('pt-BR')}.</p>
            <p>A contabilidade já recebeu estes dados para processamento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
