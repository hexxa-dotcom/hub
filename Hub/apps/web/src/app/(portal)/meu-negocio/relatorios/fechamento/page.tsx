import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, desc } from '@hexxa/db';
import { monthlyClosure } from '@hexxa/db/schema';
import { redirect } from 'next/navigation';
import { FileText, Printer, CheckCircle2, TrendingUp, TrendingDown, Clock, Users, ArrowRight } from 'lucide-react';
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
  } catch (error) {
    console.error('[fechamento/page] falha ao listar fechamentos:', error);
  }

  if (!closures || closures.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 text-center py-20">
        <Clock className="h-12 w-12 mx-auto text-[#6E6A61] opacity-50 mb-4" />
        <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3]">Nenhum fechamento encontrado</h1>
        <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          O fechamento é gerado automaticamente no dia 1º de cada mês.<br/>
          Quando o próximo mês iniciar, seu relatório estará disponível aqui.
        </p>
        <Link href="/dashboard" className="inline-flex mt-4 items-center gap-2 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline">
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
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <FileText className="h-3.5 w-3.5" />
              Fechamento Mensal
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight capitalize">
            Relatório de Fechamento — {monthName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Dados consolidados e enviados para a rotina contábil mensal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              className="appearance-none rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]"
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
            className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all shadow-sm"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </header>

      {/* Relatório (Printable Area) */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-xl overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        {/* Banner do Status */}
        <div className="bg-[#1E3328] px-8 py-6 text-[#FEFDF3] flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="font-serif font-bold text-xl text-[#DFFFAE]">Resumo do Mês</h2>
            <p className="text-xs text-[#DFFFAE]/80 mt-1 print:text-slate-600">
              Dados consolidados para contabilidade
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] px-4 py-1.5 rounded-full shadow-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-bold tracking-wide">ENVIADO À CONTABILIDADE</span>
          </div>
        </div>

        {/* Corpo do Relatório */}
        <div className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1 border-l-2 border-emerald-600 pl-4">
              <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Entradas (Receitas)</p>
              <p className="font-serif text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(totalRev)}</p>
            </div>
            
            <div className="space-y-1 border-l-2 border-red-600 pl-4">
              <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Saídas (Despesas)</p>
              <p className="font-serif text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(totalExp)}</p>
            </div>
            
            <div className="space-y-1 border-l-2 border-[#1E3328] dark:border-[#DFFFAE] pl-4">
              <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Resultado Líquido</p>
              <p className={`font-serif text-2xl font-bold ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {BRL.format(result)}
              </p>
            </div>

            <div className="space-y-1 border-l-2 border-amber-600 pl-4">
              <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Inadimplência (Atrasos)</p>
              <p className="font-serif text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">{closure.defaults_count || 0}</p>
            </div>
          </div>

          <div className="h-px w-full bg-black/5 dark:bg-white/10" />

          {/* Destaques e alertas calculados a partir do fechamento real */}
          <div className="grid md:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h3 className="flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Destaques Positivos
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 rounded-2xl shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] shrink-0">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Novos Contratos</p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
                      Você fechou <strong>{closure.new_contracts_count || 0} contratos novos</strong> neste mês.
                    </p>
                  </div>
                </li>
                {isProfit && (
                  <li className="flex items-start gap-3 bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 rounded-2xl shadow-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3328] text-[#DFFFAE] shrink-0">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Margem Positiva</p>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
                        Sua margem de lucro neste fechamento foi de <strong>{totalRev > 0 ? ((result / totalRev) * 100).toFixed(1) : 0}%</strong>.
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                <Clock className="h-5 w-5 text-amber-600" />
                Atenção Contábil
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 rounded-2xl shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 shrink-0">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Notas Fiscais</p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
                      As notas fiscais deste período já foram computadas para a geração da DAS/Impostos, disponível na aba <strong>Guias de Impostos</strong>.
                    </p>
                  </div>
                </li>
                {closure.defaults_count > 0 && (
                  <li className="flex items-start gap-3 bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 rounded-2xl shadow-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                      <TrendingDown className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Inadimplentes</p>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
                        Existem faturas não pagas neste mês. Recomendamos acessar o Hub Financeiro para acionar a régua de cobrança automática.
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>
          </div>

          <div className="mt-8 text-center pt-8 border-t border-black/5 dark:border-white/10 text-xs text-[#6E6A61] dark:text-[#A8A49C] print:pt-4">
            <p>Hexxa Hub — Documento auxiliar gerado automaticamente em {new Date(closure.created_at).toLocaleString('pt-BR')}.</p>
            <p>A contabilidade já recebeu estes dados para processamento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
