import { getTenantContext } from '@/lib/server/tenant';
import { getBalancoDreData, monthLabel, monthLabelShort } from '@/lib/server/reports';
import { Info, TrendingDown, Scale, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { PrintButton } from './PrintButton';
import { ReportToolbar } from '../ReportToolbar';

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default async function BalancoInstantaneoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const {
    periodoLabel, deOrdered, ateOrdered, options, hasData,
    receita, prolabore, despesasOperacionais, impostoEstimado, lucroLiquido, despesasTotais, margem,
    categorias, monthly, simples, rbt12,
  } = await getBalancoDreData(ctx, params);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <style>{`
        @media print {
          .print-scope-balanco #secao-dre { display: none !important; }
          .print-scope-dre #secao-balanco { display: none !important; }
        }
      `}</style>

      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre Balanço e DRE"
            description="Gerado em tempo real com base nos lançamentos conciliados no sistema."
          />

          <div className="flex flex-col sm:items-end gap-2 shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              Balanço e DRE — <span className="capitalize">{periodoLabel}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <form method="get" className="flex flex-wrap items-center gap-2">
                <select name="de" defaultValue={deOrdered} className="appearance-none rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2 text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime">
                  {options.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
                <span className="text-caption text-ink-soft">até</span>
                <select name="ate" defaultValue={ateOrdered} className="appearance-none rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2 text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime">
                  {options.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
                <button type="submit" className="rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-5 py-2 text-xs font-bold transition-all">
                  Filtrar
                </button>
              </form>
              <ReportToolbar
                reportType="balanco"
                query={{ de: deOrdered, ate: ateOrdered }}
                documentTitle={`Balanço e DRE — ${periodoLabel}`}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ===================== Seção: Balanço ===================== */}
      <section id="secao-balanco" className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        <div className="bg-hexxa-forest px-8 py-6 text-hexxa-cream flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="flex items-center gap-2 font-serif font-bold text-xl text-hexxa-lime">
              <Scale className="h-5 w-5" /> Balanço
            </h2>
            <p className="text-caption text-hexxa-lime/80 mt-1 print:text-slate-600">Resumo executivo do resultado do período</p>
          </div>
          <PrintButton scope="balanco" label="Imprimir Balanço" />
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {!hasData ? (
            <SemDadosNoHub periodo={periodoLabel} rbt12={rbt12} oficial={simples.fonte === 'APURADO'} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-1 border-l-2 border-hexxa-forest dark:border-hexxa-lime pl-4">
                <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Receita Bruta</p>
                <p className="font-serif text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(receita)}</p>
              </div>
              <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Despesas Totais</p>
                <p className="font-serif text-2xl font-bold text-ink tabular">{BRL.format(despesasTotais)}</p>
              </div>
              <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Resultado ({pct(margem)})</p>
                <p className={`font-serif text-2xl font-bold tabular ${lucroLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {BRL.format(lucroLiquido)}
                </p>
              </div>
            </div>
          )}

          <div className="h-px w-full bg-black/5 dark:border-white/10" />

          <section className="space-y-3">
            <h3 className="font-serif font-bold text-base text-ink">Histórico Mensal</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-caption font-bold text-ink-soft uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 px-4 text-right">Receita</th>
                    <th className="py-2 px-4 text-right">Despesas</th>
                    <th className="py-2 pl-4 text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/10">
                  {monthly.map((m) => {
                    const despesasM = m.despesasOperacionais + m.prolabore + m.impostoEstimado;
                    return (
                      <tr key={m.month}>
                        <td className="py-2.5 pr-4 capitalize text-ink font-medium">{monthLabelShort(m.month)}</td>
                        <td className="py-2.5 px-4 text-right font-serif font-bold text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(m.receita)}</td>
                        <td className="py-2.5 px-4 text-right font-serif text-ink-soft tabular">{BRL.format(despesasM)}</td>
                        <td className={`py-2.5 pl-4 text-right font-serif font-bold tabular ${m.lucroLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {BRL.format(m.lucroLiquido)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {/* ===================== Seção: DRE ===================== */}
      <section id="secao-dre" className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) card-finish overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        <div className="bg-hexxa-forest px-8 py-6 text-hexxa-cream flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="flex items-center gap-2 font-serif font-bold text-xl text-hexxa-lime">
              <Receipt className="h-5 w-5" /> DRE
            </h2>
            <p className="text-caption text-hexxa-lime/80 mt-1 print:text-slate-600">Demonstrativo de Resultado do Exercício, detalhado por linha</p>
          </div>
          <PrintButton scope="dre" label="Imprimir DRE" />
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {!hasData ? (
            <SemDadosNoHub periodo={periodoLabel} rbt12={rbt12} oficial={simples.fonte === 'APURADO'} />
          ) : (
            <>
              <div className="space-y-2">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-black/5 dark:divide-white/10">
                    <tr>
                      <td className="py-3.5 font-bold text-ink">Receita Bruta</td>
                      <td className="py-3.5 text-right font-serif font-bold text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(receita)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-xs text-ink-soft">(−) Despesas operacionais</td>
                      <td className="py-3 text-right text-xs font-serif font-semibold text-ink tabular">− {BRL.format(despesasOperacionais)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-xs text-ink-soft">(−) Pró-labore dos sócios</td>
                      <td className="py-3 text-right text-xs font-serif font-semibold text-ink tabular">− {BRL.format(prolabore)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-xs text-ink-soft">
                        (−) Imposto {simples.fonte === 'APURADO' ? 'pela alíquota apurada' : 'estimado'} (Simples, {pct(simples.effectiveRate)} efetiva · Anexo {simples.anexo})
                      </td>
                      <td className="py-3 text-right text-xs font-serif font-semibold text-ink tabular">− {BRL.format(impostoEstimado)}</td>
                    </tr>
                    <tr>
                      <td className="py-4 font-serif font-bold text-base text-ink">= Lucro Líquido do Período</td>
                      <td className={`py-4 text-right font-serif text-2xl font-bold tabular ${lucroLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {BRL.format(lucroLiquido)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="flex items-start gap-1.5 text-caption text-ink-soft pt-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Imposto é uma estimativa pela alíquota efetiva atual do Simples Nacional — o valor exato da guia (DAS) é apurado pelo PGDAS oficial da Receita.
                </p>
              </div>

              <div className="h-px w-full bg-black/5 dark:border-white/10" />

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-1 border-l-2 border-hexxa-forest dark:border-hexxa-lime pl-4">
                  <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Margem Líquida</p>
                  <p className={`font-serif text-2xl font-bold tabular ${margem >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{pct(margem)}</p>
                </div>
                <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                  <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">Fator R Atual</p>
                  <p className="font-serif text-2xl font-bold text-ink tabular">{pct(simples.fatorR * 100)}</p>
                  <p className={`text-[11px] font-bold ${simples.fatorRFavorable ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {/* Com apuração, o anexo é o apurado — que pode ser I, II ou IV,
                        onde o Fator R nem entra. Sem ela, a conta só conhece III e V. */}
                    {simples.fonte === 'APURADO'
                      ? `Anexo ${simples.anexo} (apurado)`
                      : simples.fatorRFavorable ? 'Anexo III (favorável)' : 'Anexo V'}
                  </p>
                </div>
                <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                  <p className="text-caption font-bold text-ink-soft uppercase tracking-wide">RBT12 (12 meses)</p>
                  <p className="font-serif text-2xl font-bold text-ink tabular">{BRL.format(rbt12)}</p>
                </div>
              </div>

              {categorias.length > 0 && (
                <>
                  <div className="h-px w-full bg-black/5 dark:bg-white/10" />
                  <section className="space-y-3">
                    <h3 className="flex items-center gap-2 font-serif font-bold text-base text-ink">
                      <TrendingDown className="h-4 w-4 text-red-600" /> Despesas por Categoria
                    </h3>
                    <ul className="space-y-2">
                      {categorias.map(([label, value]) => (
                        <li key={label} className="flex items-center justify-between text-sm py-1 border-b border-black/5 dark:border-white/10 last:border-0">
                          <span className="text-ink-soft">{label}</span>
                          <span className="font-serif font-bold text-ink tabular">{BRL.format(value)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </>
          )}

          <div className="h-px w-full bg-black/5 dark:bg-white/10" />

          <section className="space-y-3">
            <h3 className="font-serif font-bold text-base text-ink">Histórico Mensal do DRE</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-caption font-bold text-ink-soft uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 px-4 text-right">Receita</th>
                    <th className="py-2 px-4 text-right">Despesas Op.</th>
                    <th className="py-2 px-4 text-right">Pró-labore</th>
                    <th className="py-2 px-4 text-right">Imposto</th>
                    <th className="py-2 pl-4 text-right">Lucro Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/10">
                  {monthly.map((m) => (
                    <tr key={m.month}>
                      <td className="py-2.5 pr-4 capitalize text-ink font-medium">{monthLabelShort(m.month)}</td>
                      <td className="py-2.5 px-4 text-right font-serif font-bold text-emerald-600 dark:text-emerald-400 tabular">{BRL.format(m.receita)}</td>
                      <td className="py-2.5 px-4 text-right font-serif text-ink-soft tabular">{BRL.format(m.despesasOperacionais)}</td>
                      <td className="py-2.5 px-4 text-right font-serif text-ink-soft tabular">{BRL.format(m.prolabore)}</td>
                      <td className="py-2.5 px-4 text-right font-serif text-ink-soft tabular">{BRL.format(m.impostoEstimado)}</td>
                      <td className={`py-2.5 pl-4 text-right font-serif font-bold tabular ${m.lucroLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {BRL.format(m.lucroLiquido)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <div className="text-center text-xs text-ink-soft print:pt-4">
        <p>Hexxa Hub — relatórios gerados automaticamente em {new Date().toLocaleString('pt-BR')}, a partir dos dados já lançados no sistema.</p>
      </div>
    </div>
  );
}

/**
 * Sem lançamento no Hub, mas com apuração no contábil: a empresa FATURA, só
 * que a nota sai pela prefeitura e chega direto ao OneFlow.
 *
 * "Nenhum lançamento encontrado" é verdade sobre o Hub e mentira sobre a
 * empresa — lido por um cliente, diz que ele não faturou nada. Onde o
 * contábil tem o faturamento, a tela diz isso e aponta onde está o número.
 */
function SemDadosNoHub({ periodo, rbt12, oficial }: { periodo: string; rbt12: number; oficial: boolean }) {
  if (!oficial) {
    return (
      <p className="text-center text-sm text-ink-soft py-12">
        Nenhum lançamento encontrado para {periodo}.
      </p>
    );
  }
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <p className="text-sm font-bold text-ink">O faturamento desta empresa está no sistema contábil.</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        As notas saem pela prefeitura e vão direto para a contabilidade — por isso não aparecem como
        lançamentos aqui em {periodo}. Faturamento dos últimos 12 meses, pela apuração oficial:{' '}
        <strong className="font-serif tabular text-ink">
          {rbt12.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>
        . Veja a posição tributária completa na Bússola Tributária.
      </p>
    </div>
  );
}
