import { getTenantContext } from '@/lib/server/tenant';
import { getFaturamentoPorClienteData, SEM_CLIENTE } from '@/lib/server/reports';
import { SectionHero } from '@/components/ui/SectionHero';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { ReportToolbar } from '../ReportToolbar';
import { BRL, pct, th, num, corDoResultado, Painel, Nota } from '../_ui';

export const dynamic = 'force-dynamic';

export default async function FaturamentoPorClientePage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const { ano, anos, receitaTotal, margemLiquidaAno, clientes } = await getFaturamentoPorClienteData(ctx, { ano: params.ano });
  const comNota = clientes.filter((c) => c.nome !== SEM_CLIENTE);
  const maior = comNota[0];
  // Com faturamento quase nulo a margem vira um número sem sentido (−1.000.000%): melhor não mostrar.
  const margemMedivel = receitaTotal > 0 && Math.abs(margemLiquidaAno) <= 10;

  return (
    <div className="mx-auto max-w-4xl space-y-16 pb-10">
      <SectionHero
        subtitulo="Quanto cada cliente representa no seu faturamento"
        title={`Faturamento por cliente ${ano}`}
        infoTitle="Sobre Faturamento por Cliente"
        infoDescription="Quanto cada cliente representou no faturamento da empresa no ano, pelas notas emitidas para ele."
        className="print:hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        {anos.length > 1 ? (
          <FiltrosEmTexto
            filtros={anos.map((a) => ({ id: String(a), label: String(a), href: `/meu-negocio/relatorios/faturamento-por-cliente?ano=${a}` }))}
            ativo={String(ano)}
          />
        ) : (
          <span />
        )}
        <ReportToolbar reportType="faturamento-por-cliente" query={{ ano }} documentTitle={`Faturamento por Cliente — ${ano}`} />
      </div>

      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo={`Faturado em ${ano}`} valor={BRL.format(receitaTotal)} nota={`${comNota.length} ${comNota.length === 1 ? 'cliente' : 'clientes'} com nota`} />
        <CardResumo
          rotulo="Maior cliente"
          valor={maior ? pct(maior.participacao) : '—'}
          nota={maior ? maior.nome : 'Nenhuma nota no ano'}
          tom={maior && maior.participacao >= 50 ? 'alerta' : 'padrao'}
        />
        <CardResumo rotulo="Margem do ano" valor={margemMedivel ? pct(margemLiquidaAno * 100) : '—'} nota={margemMedivel ? 'Resultado sobre o faturamento' : 'Faturamento pequeno demais para medir'} />
      </GradeDeResumo>

      <Painel titulo="Por cliente">
        {clientes.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft">Nenhuma nota em {ano}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left dark:border-white/10">
                <th className={th}>Cliente</th>
                <th className={`${th} text-right`}>Faturado</th>
                <th className={`${th} text-right`}>Do total</th>
                <th className={`${th} text-right`}>Margem estimada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {clientes.map((c) => (
                <tr key={c.nome}>
                  <td className="py-2.5 pr-4 text-ink">
                    {c.nome}
                    {c.nome === SEM_CLIENTE && <span className="ml-2 text-[11px] text-ink-soft">(sem tomador na nota)</span>}
                  </td>
                  <td className={`py-2.5 text-right ${num} font-bold text-ink`}>{BRL.format(c.receita)}</td>
                  <td className="py-2.5 text-right tabular text-ink-soft">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-black/5 sm:inline-block dark:bg-white/10">
                        <span className="block h-full rounded-full bg-hexxa-forest dark:bg-hexxa-lime" style={{ width: `${Math.min(100, c.participacao)}%` }} />
                      </span>
                      {pct(c.participacao)}
                    </span>
                  </td>
                  <td className={`py-2.5 text-right ${num} ${margemMedivel ? corDoResultado(c.margemEstimada) : 'text-ink-soft'}`}>{margemMedivel ? BRL.format(c.margemEstimada) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Painel>

      <Nota>
        Margem estimada = a parte do cliente no faturamento × a margem da empresa no ano{margemMedivel ? ` (${pct(margemLiquidaAno * 100)})` : ''}. O sistema não sabe o custo
        de atender cada cliente — é um rateio, não o lucro exato daquele cliente. Um cliente com metade ou mais do faturamento aparece em destaque:
        é dependência demais de um só.
      </Nota>
    </div>
  );
}
