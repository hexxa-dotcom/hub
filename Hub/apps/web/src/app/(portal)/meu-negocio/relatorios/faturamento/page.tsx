import { getTenantContext } from '@/lib/server/tenant';
import { getFaturamentoData } from '@/lib/server/reports';
import { BarChart3, Info } from 'lucide-react';
import Link from 'next/link';
import { ReportToolbar } from '../ReportToolbar';

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

type Visao = 'mensal' | 'anual';

export default async function FaturamentoReportPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; ano?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const visao: Visao = params.visao === 'anual' ? 'anual' : 'mensal';

  const { ano, anosDisponiveis, meses, totalAnoMensal, anual } = await getFaturamentoData(ctx, { ano: params.ano });
  const maxMes = Math.max(...meses.map((m) => m.valor), 1);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <BarChart3 className="h-3.5 w-3.5" />
              Faturamento
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            {visao === 'mensal' ? `Faturamento Mensal · ${ano}` : 'Faturamento Anual'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Receita bruta reconhecida via nota fiscal (própria ou sincronizada do Emissor Nacional).
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-1">
              <Link
                href={{ pathname: '/meu-negocio/relatorios/faturamento', query: { visao: 'mensal', ano } } as never}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${visao === 'mensal' ? 'bg-[#1E3328] text-[#DFFFAE]' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}
              >
                Mensal
              </Link>
              <Link
                href={{ pathname: '/meu-negocio/relatorios/faturamento', query: { visao: 'anual' } } as never}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${visao === 'anual' ? 'bg-[#1E3328] text-[#DFFFAE]' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}
              >
                Anual
              </Link>
            </div>
            {visao === 'mensal' && (
              <form method="get" className="flex items-center gap-2">
                <input type="hidden" name="visao" value="mensal" />
                <select name="ano" defaultValue={ano} className="appearance-none rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]">
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <button type="submit" className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] transition-all shadow-sm">
                  Ver
                </button>
              </form>
            )}
          </div>
          <ReportToolbar
            reportType="faturamento"
            query={visao === 'mensal' ? { visao: 'mensal', ano } : { visao: 'anual' }}
            documentTitle={visao === 'mensal' ? `Faturamento Mensal — ${ano}` : 'Faturamento Anual'}
          />
        </div>
      </header>

      {visao === 'mensal' ? (
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="bg-[#1E3328] px-8 py-6 text-[#FEFDF3]">
            <p className="text-xs text-[#DFFFAE]/80 uppercase tracking-wide font-bold">Total do Ano</p>
            <p className="font-serif text-3xl font-bold text-[#DFFFAE]">{BRL.format(totalAnoMensal)}</p>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-end gap-2 h-48">
              {meses.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">
                    {m.valor > 0 ? BRL.format(m.valor).replace('R$', '').trim() : ''}
                  </span>
                  <div
                    title={`${m.label}: ${BRL.format(m.valor)}`}
                    className="w-full rounded-t-lg bg-[#2F4A3C] dark:bg-[#DFFFAE] transition-all"
                    style={{ height: `${m.valor ? Math.max((m.valor / maxMes) * 100, 3) : 2}%` }}
                  />
                  <span className="text-[11px] font-bold text-[#231F20] dark:text-[#FEFDF3]">{m.label}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 pl-4 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr key={m.label} className="border-b border-black/5 dark:border-white/10 last:border-0">
                      <td className="py-2.5 pr-4 text-[#231F20] dark:text-[#FEFDF3]">{m.label}</td>
                      <td className="py-2.5 pl-4 text-right font-bold text-emerald-700 dark:text-emerald-400">{BRL.format(m.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="bg-[#1E3328] px-8 py-6 text-[#FEFDF3]">
            <p className="text-xs text-[#DFFFAE]/80 uppercase tracking-wide font-bold">Comparativo entre anos</p>
          </div>
          <div className="p-6 sm:p-8 space-y-4">
            {anual.length === 0 ? (
              <p className="text-center text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12">Nenhum lançamento encontrado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                      <th className="py-2 pr-4">Ano</th>
                      <th className="py-2 px-4 text-right">Receita</th>
                      <th className="py-2 px-4 text-right">Despesas</th>
                      <th className="py-2 pl-4 text-right">Lucro Estimado</th>
                      <th className="py-2 pl-4 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anual.map((a) => (
                      <tr key={a.ano} className="border-b border-black/5 dark:border-white/10 last:border-0">
                        <td className="py-2.5 pr-4 font-bold text-[#231F20] dark:text-[#FEFDF3]">{a.ano}</td>
                        <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400">{BRL.format(a.receita)}</td>
                        <td className="py-2.5 px-4 text-right text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(a.despesas + a.impostoEstimado)}</td>
                        <td className={`py-2.5 pl-4 text-right font-bold ${a.lucroLiquido >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {BRL.format(a.lucroLiquido)}
                        </td>
                        <td className={`py-2.5 pl-4 text-right font-bold ${a.margem >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {pct(a.margem)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="flex items-start gap-1.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C] pt-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Imposto estimado pela alíquota efetiva ATUAL do Simples Nacional aplicada a cada ano — não recalcula a faixa histórica de cada período. Para o valor exato já pago, use as guias (DAS) de cada mês.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
