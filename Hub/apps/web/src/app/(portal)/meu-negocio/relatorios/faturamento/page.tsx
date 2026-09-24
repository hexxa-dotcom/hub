import { getTenantContext } from '@/lib/server/tenant';
import { getFaturamentoData } from '@/lib/server/reports';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import { ReportToolbar } from '../ReportToolbar';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';

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
    <div className="mx-auto max-w-4xl space-y-16 pb-10 animate-fade-up">
      <SectionHero
        subtitulo="Receita bruta das notas fiscais emitidas"
        title={visao === 'mensal' ? `Faturamento Mensal · ${ano}` : 'Faturamento Anual'}
        infoTitle="Sobre o Faturamento"
        infoDescription="Receita bruta reconhecida via nota fiscal (própria ou sincronizada do Emissor Nacional)."
        className="print:hidden"
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <FiltrosEmTexto
              filtros={[
                { id: 'mensal', label: 'Mensal', href: `/meu-negocio/relatorios/faturamento?visao=mensal&ano=${ano}` },
                { id: 'anual', label: 'Anual', href: '/meu-negocio/relatorios/faturamento?visao=anual' },
              ]}
              ativo={visao}
            />
            {visao === 'mensal' && (
              <form method="get" className="flex items-center gap-1.5">
                <input type="hidden" name="visao" value="mensal" />
                <select
                  name="ano"
                  defaultValue={ano}
                  className="appearance-none rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3.5 py-1.5 text-xs font-bold text-ink outline-none cursor-pointer"
                >
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <button type="submit" className="tap-target pressable focusable rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer">
                  Ver
                </button>
              </form>
            )}
            <ReportToolbar
              reportType="faturamento"
              query={{ visao, ...(visao === 'mensal' ? { ano } : {}) }}
              documentTitle={visao === 'mensal' ? `Faturamento Mensal — ${ano}` : 'Faturamento Anual'}
            />
          </div>
        }
      />

      {visao === 'mensal' ? (
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish overflow-hidden">
          <div className="bg-hexxa-forest px-8 py-6 text-hexxa-cream">
            <p className="rotulo text-hexxa-lime">Total do Ano</p>
            <p className="font-serif text-3xl font-bold text-hexxa-lime tabular">{BRL.format(totalAnoMensal)}</p>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-end gap-2 h-48">
              {meses.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-ink-soft tabular">
                    {m.valor > 0 ? BRL.format(m.valor).replace('R$', '').trim() : ''}
                  </span>
                  <div
                    title={`${m.label}: ${BRL.format(m.valor)}`}
                    className="w-full rounded-t-lg bg-hexxa-forest dark:bg-hexxa-lime transition-all"
                    style={{ height: `${m.valor ? Math.max((m.valor / maxMes) * 100, 3) : 2}%` }}
                  />
                  <span className="text-[11px] font-bold text-ink">{m.label}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-caption font-bold text-ink-soft uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 pl-4 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/10">
                  {meses.map((m) => (
                    <tr key={m.label}>
                      <td className="py-2.5 pr-4 text-ink font-medium">{m.label}</td>
                      <td className="py-2.5 pl-4 text-right font-serif font-bold text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(m.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish overflow-hidden">
          <div className="bg-hexxa-forest px-8 py-6 text-hexxa-cream">
            <p className="rotulo text-hexxa-lime">Comparativo entre anos</p>
          </div>
          <div className="p-6 sm:p-8 space-y-4">
            {anual.length === 0 ? (
              <p className="text-center text-sm text-ink-soft py-12">Nenhum lançamento encontrado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-caption font-bold text-ink-soft uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                      <th className="py-2 pr-4">Ano</th>
                      <th className="py-2 px-4 text-right">Receita</th>
                      <th className="py-2 px-4 text-right">Despesas</th>
                      <th className="py-2 pl-4 text-right">Lucro Estimado</th>
                      <th className="py-2 pl-4 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/10">
                    {anual.map((a) => (
                      <tr key={a.ano}>
                        <td className="py-2.5 pr-4 font-bold text-ink">{a.ano}</td>
                        <td className="py-2.5 px-4 text-right font-serif font-bold text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(a.receita)}</td>
                        <td className="py-2.5 px-4 text-right font-serif text-ink-soft tabular">{BRL.format(a.despesas + a.impostoEstimado)}</td>
                        <td className={`py-2.5 pl-4 text-right font-serif font-bold tabular ${a.lucroLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {BRL.format(a.lucroLiquido)}
                        </td>
                        <td className={`py-2.5 pl-4 text-right font-serif font-bold tabular ${a.margem >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {pct(a.margem)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="flex items-start gap-1.5 text-caption text-ink-soft pt-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Imposto estimado pela alíquota efetiva ATUAL do Simples Nacional aplicada a cada ano — não recalcula a faixa histórica de cada período. Para o valor exato já pago, use as guias (DAS) de cada mês.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
