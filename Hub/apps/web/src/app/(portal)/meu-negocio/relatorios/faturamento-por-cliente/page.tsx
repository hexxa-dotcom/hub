import { getTenantContext } from '@/lib/server/tenant';
import { getFaturamentoPorClienteData, SEM_CLIENTE } from '@/lib/server/reports';
import { Users, Info } from 'lucide-react';
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
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Users className="h-3.5 w-3.5" />
              Faturamento por Cliente
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            {ano}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Quanto cada cliente representou no faturamento do ano.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <form method="get" className="flex items-center gap-2">
            <select name="ano" defaultValue={ano} className="appearance-none rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]">
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button type="submit" className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] transition-all shadow-sm">
              Ver
            </button>
          </form>
          <ReportToolbar
            reportType="faturamento-por-cliente"
            query={{ ano }}
            documentTitle={`Faturamento por Cliente — ${ano}`}
          />
        </div>
      </header>

      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="bg-[#1E3328] px-8 py-6 text-[#FEFDF3] grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-[#DFFFAE]/70 uppercase tracking-wide font-bold">Receita Total</p>
            <p className="font-serif text-xl font-bold text-[#DFFFAE]">{BRL.format(receitaTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#DFFFAE]/70 uppercase tracking-wide font-bold">Margem Líquida do Ano</p>
            <p className="font-serif text-xl font-bold text-[#DFFFAE]">{pct(margemLiquidaAno * 100)}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] text-[#DFFFAE]/70 uppercase tracking-wide font-bold">Clientes com Nota</p>
            <p className="font-serif text-xl font-bold text-[#DFFFAE]">{clientes.filter((c) => c.nome !== SEM_CLIENTE).length}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-4">
          {clientes.length === 0 ? (
            <p className="text-center text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12">Nenhum faturamento encontrado em {ano}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 px-4 text-right">Receita</th>
                    <th className="py-2 px-4 text-right">Participação</th>
                    <th className="py-2 pl-4 text-right">Margem Estimada</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.nome} className="border-b border-black/5 dark:border-white/10 last:border-0">
                      <td className="py-2.5 pr-4 text-[#231F20] dark:text-[#FEFDF3]">
                        {c.nome}
                        {c.nome === SEM_CLIENTE && <span className="ml-2 text-[10px] text-[#6E6A61] dark:text-[#A8A49C]">(contratos, repasses etc.)</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400">{BRL.format(c.receita)}</td>
                      <td className="py-2.5 px-4 text-right text-[#6E6A61] dark:text-[#A8A49C]">{pct(c.participacao)}</td>
                      <td className={`py-2.5 pl-4 text-right font-bold ${c.margemEstimada >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {BRL.format(c.margemEstimada)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C] pt-2">
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
