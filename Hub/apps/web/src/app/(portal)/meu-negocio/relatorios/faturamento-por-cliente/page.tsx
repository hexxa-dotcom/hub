import { getTenantContext } from '@/lib/server/tenant';
import { getFaturamentoPorClienteData, SEM_CLIENTE } from '@/lib/server/reports';
import { Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import { ReportToolbar } from '../ReportToolbar';

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default async function FaturamentoPorClientePage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const { ano, anos, receitaTotal, margemLiquidaAno, clientes } = await getFaturamentoPorClienteData(ctx, { ano: params.ano });

  return (
    <div className="mx-auto max-w-4xl space-y-16 pb-10 animate-fade-up">
      <SectionHero
        subtitulo="Quanto cada cliente representa no seu faturamento"
        title={`Faturamento por Cliente · ${ano}`}
        infoTitle="Sobre Faturamento por Cliente"
        infoDescription="Quanto cada cliente representou no faturamento da empresa no ano fiscal selecionado."
        className="print:hidden"
        rightSlot={
          <div className="flex items-center gap-2">
            <form method="get" className="flex items-center gap-1.5">
              <select
                name="ano"
                defaultValue={ano}
                className="appearance-none rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3.5 py-1.5 text-xs font-bold text-ink outline-none cursor-pointer"
              >
                {anos.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                type="submit"
                className="tap-target pressable focusable rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                Ver
              </button>
            </form>
            <ReportToolbar
              reportType="faturamento-por-cliente"
              query={{ ano }}
              documentTitle={`Faturamento por Cliente — ${ano}`}
            />
          </div>
        }
      />

      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish overflow-hidden">
        <div className="bg-hexxa-forest px-8 py-6 text-hexxa-cream grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-caption text-hexxa-lime uppercase tracking-wide font-bold">Receita Total</p>
            <p className="font-serif text-xl font-bold text-hexxa-lime tabular">{BRL.format(receitaTotal)}</p>
          </div>
          <div>
            <p className="text-caption text-hexxa-lime uppercase tracking-wide font-bold">Margem Líquida do Ano</p>
            <p className="font-serif text-xl font-bold text-hexxa-lime tabular">{pct(margemLiquidaAno * 100)}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-caption text-hexxa-lime uppercase tracking-wide font-bold">Clientes com Nota</p>
            <p className="font-serif text-xl font-bold text-hexxa-lime tabular">{clientes.filter((c) => c.nome !== SEM_CLIENTE).length}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-4">
          {clientes.length === 0 ? (
            <p className="text-center text-sm text-ink-soft py-12">Nenhum faturamento encontrado em {ano}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-caption font-bold text-ink-soft uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 px-4 text-right">Receita</th>
                    <th className="py-2 px-4 text-right">Participação</th>
                    <th className="py-2 pl-4 text-right">Margem Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/10">
                  {clientes.map((c) => (
                    <tr key={c.nome}>
                      <td className="py-2.5 pr-4 text-ink font-medium">
                        {c.nome}
                        {c.nome === SEM_CLIENTE && <span className="ml-2 text-[10px] text-ink-soft">(contratos, repasses etc.)</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-serif font-bold text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(c.receita)}</td>
                      <td className="py-2.5 px-4 text-right text-ink-soft tabular">{pct(c.participacao)}</td>
                      <td className={`py-2.5 pl-4 text-right font-serif font-bold tabular ${c.margemEstimada >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {BRL.format(c.margemEstimada)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-ink-soft pt-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Margem estimada</strong> = participação do cliente na receita × margem líquida da empresa no ano ({pct(margemLiquidaAno * 100)}).
              O sistema não rastreia custo direto por cliente — isso é um rateio proporcional, não o lucro real daquele cliente específico.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
