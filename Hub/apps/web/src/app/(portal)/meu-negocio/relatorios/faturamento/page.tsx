import { getTenantContext } from '@/lib/server/tenant';
import { getFaturamentoData } from '@/lib/server/reports';
import { SectionHero } from '@/components/ui/SectionHero';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { ReportToolbar } from '../ReportToolbar';
import { BRL, pct, th, num, corDoResultado, Painel, Nota } from '../_ui';

export const dynamic = 'force-dynamic';

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
  const comNota = meses.filter((m) => m.valor > 0);
  const melhor = comNota.reduce<(typeof meses)[number] | null>((a, m) => (!a || m.valor > a.valor ? m : a), null);

  return (
    <div className="mx-auto max-w-4xl space-y-16 pb-10">
      <SectionHero
        subtitulo="Receita bruta das notas fiscais emitidas"
        title={visao === 'mensal' ? `Faturamento ${ano}` : 'Faturamento por ano'}
        infoTitle="Sobre o Faturamento"
        infoDescription="Receita bruta reconhecida pelas notas fiscais emitidas (Emissor Nacional). É a mesma base da Bússola Tributária e das Notas."
        className="print:hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <FiltrosEmTexto
            filtros={[
              { id: 'mensal', label: 'Mês a mês', href: `/meu-negocio/relatorios/faturamento?visao=mensal&ano=${ano}` },
              { id: 'anual', label: 'Ano a ano', href: '/meu-negocio/relatorios/faturamento?visao=anual' },
            ]}
            ativo={visao}
          />
          {visao === 'mensal' && anosDisponiveis.length > 1 && (
            <FiltrosEmTexto
              filtros={anosDisponiveis.map((a) => ({ id: String(a), label: String(a), href: `/meu-negocio/relatorios/faturamento?visao=mensal&ano=${a}` }))}
              ativo={String(ano)}
            />
          )}
        </div>
        <ReportToolbar
          reportType="faturamento"
          query={{ visao, ...(visao === 'mensal' ? { ano } : {}) }}
          documentTitle={visao === 'mensal' ? `Faturamento Mensal — ${ano}` : 'Faturamento Anual'}
        />
      </div>

      {visao === 'mensal' ? (
        <>
          <GradeDeResumo colunas={3}>
            <CardResumo destaque rotulo={`Faturado em ${ano}`} valor={BRL.format(totalAnoMensal)} nota="Só notas fiscais" />
            <CardResumo rotulo="Média por mês" valor={BRL.format(comNota.length ? totalAnoMensal / comNota.length : 0)} nota={`${comNota.length} ${comNota.length === 1 ? 'mês' : 'meses'} com nota`} />
            <CardResumo rotulo="Melhor mês" valor={melhor ? BRL.format(melhor.valor) : '—'} nota={melhor?.label ?? 'Nenhuma nota no ano'} />
          </GradeDeResumo>

          <Painel titulo="Mês a mês">
            <div className="flex h-48 items-end gap-2 pt-6">
              {meses.map((m) => (
                <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <div
                    title={`${m.label}: ${BRL.format(m.valor)}`}
                    className="w-full rounded-t-md bg-hexxa-forest/85 dark:bg-hexxa-lime/80"
                    style={{ height: `${m.valor ? Math.max((m.valor / maxMes) * 100, 3) : 1}%` }}
                  />
                  <span className="text-[10px] text-ink-soft">{m.label}</span>
                </div>
              ))}
            </div>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left dark:border-white/10">
                  <th className={th}>Mês</th>
                  <th className={`${th} text-right`}>Faturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {meses.map((m) => (
                  <tr key={m.label}>
                    <td className="py-2.5 text-ink">{m.label}</td>
                    <td className={`py-2.5 text-right ${num} ${m.valor ? 'font-bold text-ink' : 'text-ink-soft'}`}>{BRL.format(m.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Painel>
        </>
      ) : (
        <Painel titulo="Ano a ano">
          {anual.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">Nenhuma nota encontrada ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left dark:border-white/10">
                  <th className={th}>Ano</th>
                  <th className={`${th} text-right`}>Faturado</th>
                  <th className={`${th} text-right`}>Despesas e imposto</th>
                  <th className={`${th} text-right`}>Resultado</th>
                  <th className={`${th} text-right`}>Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {anual.map((a) => (
                  <tr key={a.ano}>
                    <td className="py-2.5 font-semibold text-ink">{a.ano}</td>
                    <td className={`py-2.5 text-right ${num} font-bold text-ink`}>{BRL.format(a.receita)}</td>
                    <td className={`py-2.5 text-right ${num} text-ink-soft`}>{BRL.format(a.despesas + a.impostoEstimado)}</td>
                    <td className={`py-2.5 text-right ${num} font-bold ${corDoResultado(a.lucroLiquido)}`}>{BRL.format(a.lucroLiquido)}</td>
                    <td className={`py-2.5 text-right ${num} ${corDoResultado(a.margem)}`}>{pct(a.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Painel>
      )}

      {visao === 'anual' && (
        <Nota>
          O imposto de cada ano é estimado pela alíquota de hoje (a mesma da Bússola) — não refaz a faixa do Simples de cada período. O valor exato
          pago está nas guias de cada mês.
        </Nota>
      )}
    </div>
  );
}
