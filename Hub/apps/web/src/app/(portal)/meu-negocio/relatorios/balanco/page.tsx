import { getTenantContext } from '@/lib/server/tenant';
import { getBalancoDreData, monthLabel, monthLabelShort } from '@/lib/server/reports';
import { SectionHero } from '@/components/ui/SectionHero';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { PrintButton } from './PrintButton';
import { ReportToolbar } from '../ReportToolbar';
import { BRL, pct, th, num, corDoResultado, Painel, Nota, Rodape } from '../_ui';

export const dynamic = 'force-dynamic';

const seletor = 'cursor-pointer border-b border-black/15 bg-transparent pb-1 text-xs font-semibold capitalize text-ink outline-none dark:border-white/20';

export default async function BalancoInstantaneoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const {
    periodoLabel, deOrdered, ateOrdered, options, hasData,
    receita, outrasEntradas, prolabore, despesasOperacionais, impostoEstimado, lucroLiquido, despesasTotais, margem,
    categorias, monthly, simples, rbt12,
  } = await getBalancoDreData(ctx, params);
  const maiorCategoria = categorias[0]?.[1] ?? 0;
  // Com receita quase nula o percentual vira um número sem sentido (−96.000%): melhor não mostrar.
  const medivel = receita > 0 && Math.abs(margem) <= 1000;
  const margemTexto = medivel ? pct(margem) : '—';

  return (
    <div className="mx-auto max-w-4xl space-y-16 pb-10">
      <style>{`
        @media print {
          .print-scope-balanco #secao-dre { display: none !important; }
          .print-scope-dre #secao-balanco { display: none !important; }
        }
      `}</style>

      <SectionHero
        subtitulo="Resultado do período, linha a linha"
        title={`Balanço e DRE · ${periodoLabel}`}
        infoTitle="Sobre Balanço e DRE"
        infoDescription="Gerado na hora a partir dos lançamentos do sistema. A receita é só a das notas fiscais; o imposto é estimado pela mesma alíquota da Bússola."
        className="print:hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <form method="get" className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
          <span className="rotulo">Período</span>
          <select name="de" defaultValue={deOrdered} className={seletor}>
            {options.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <span>até</span>
          <select name="ate" defaultValue={ateOrdered} className={seletor}>
            {options.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button type="submit" className="font-semibold text-ink underline-offset-4 hover:underline">Aplicar</button>
        </form>
        <ReportToolbar reportType="balanco" query={{ de: deOrdered, ate: ateOrdered }} documentTitle={`Balanço e DRE — ${periodoLabel}`} />
      </div>

      {!hasData ? (
        <SemDadosNoHub periodo={periodoLabel} rbt12={rbt12} oficial={simples.fonte === 'APURADO'} />
      ) : (
        <GradeDeResumo colunas={3}>
          <CardResumo destaque rotulo="Receita bruta" valor={BRL.format(receita)} nota={outrasEntradas > 0 ? `Só notas · + ${BRL.format(outrasEntradas)} sem nota, fora do resultado` : 'Só notas fiscais'} />
          <CardResumo rotulo="Despesas, pró-labore e imposto" valor={BRL.format(despesasTotais)} nota={medivel ? `${pct((despesasTotais / receita) * 100)} da receita` : 'Receita pequena demais para comparar'} />
          <CardResumo rotulo="Resultado" valor={BRL.format(lucroLiquido)} nota={medivel ? `Margem de ${margemTexto}` : 'Margem: —'} tom={lucroLiquido < 0 ? 'alerta' : 'padrao'} />
        </GradeDeResumo>
      )}

      <div id="secao-dre" className="space-y-16">
        {hasData && (
          <Painel titulo="DRE — demonstrativo de resultado" acao={<PrintButton scope="dre" label="Imprimir DRE" />}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                <tr>
                  <td className="py-3.5 font-semibold text-ink">Receita bruta <span className="font-normal text-ink-soft">(notas fiscais)</span></td>
                  <td className={`py-3.5 text-right ${num} font-bold text-ink`}>{BRL.format(receita)}</td>
                </tr>
                <tr>
                  <td className="py-3 pl-4 text-ink-soft">(−) Imposto {simples.fonte === 'APURADO' ? 'pela alíquota apurada' : 'estimado'} · {pct(receita > 0 ? (impostoEstimado / receita) * 100 : 0)} · Anexo {simples.anexo}</td>
                  <td className={`py-3 text-right ${num} text-ink`}>− {BRL.format(impostoEstimado)}</td>
                </tr>
                <tr>
                  <td className="py-3 pl-4 text-ink-soft">(−) Despesas operacionais</td>
                  <td className={`py-3 text-right ${num} text-ink`}>− {BRL.format(despesasOperacionais)}</td>
                </tr>
                <tr>
                  <td className="py-3 pl-4 text-ink-soft">(−) Pró-labore dos sócios</td>
                  <td className={`py-3 text-right ${num} text-ink`}>− {BRL.format(prolabore)}</td>
                </tr>
                <tr>
                  <td className="py-4 font-semibold text-ink">= Resultado do período</td>
                  <td className={`py-4 text-right ${num} text-xl font-bold ${corDoResultado(lucroLiquido)}`}>{BRL.format(lucroLiquido)}</td>
                </tr>
                {outrasEntradas > 0 && (
                  <tr>
                    <td className="py-3 text-xs text-ink-soft">Outras entradas, sem nota — não são faturamento nem entram no resultado</td>
                    <td className={`py-3 text-right ${num} text-xs text-ink-soft`}>{BRL.format(outrasEntradas)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Painel>
        )}

        {hasData && (
          <GradeDeResumo colunas={3}>
            <CardResumo rotulo="Margem líquida" valor={margemTexto} nota={medivel ? 'Resultado sobre a receita' : 'Receita pequena demais para medir'} />
            <CardResumo
              rotulo="Fator R"
              valor={pct(simples.fatorR * 100)}
              nota={simples.fonte === 'APURADO' ? `Anexo ${simples.anexo} (apurado)` : simples.fatorRFavorable ? 'Anexo III — favorável' : 'Anexo V'}
            />
            <CardResumo rotulo="Faturamento em 12 meses" valor={BRL.format(rbt12)} nota="RBT12, base do Simples" />
          </GradeDeResumo>
        )}

        {categorias.length > 0 && (
          <Painel titulo="Para onde foi o dinheiro">
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {categorias.map(([label, value]) => (
                <li key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{label}</span>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-black/5 sm:inline-block dark:bg-white/10">
                    <span className="block h-full rounded-full bg-rose-500/70" style={{ width: `${maiorCategoria ? (value / maiorCategoria) * 100 : 0}%` }} />
                  </span>
                  <span className={`w-32 text-right ${num} font-bold text-ink`}>{BRL.format(value)}</span>
                </li>
              ))}
            </ul>
          </Painel>
        )}
      </div>

      <div id="secao-balanco">
        <Painel titulo="Mês a mês" acao={<PrintButton scope="balanco" label="Imprimir resumo" />}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left dark:border-white/10">
                <th className={th}>Mês</th>
                <th className={`${th} text-right`}>Receita</th>
                <th className={`${th} text-right`}>Imposto</th>
                <th className={`${th} text-right`}>Despesas</th>
                <th className={`${th} text-right`}>Pró-labore</th>
                <th className={`${th} text-right`}>Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {monthly.map((m) => (
                <tr key={m.month}>
                  <td className="py-2.5 capitalize text-ink">{monthLabelShort(m.month)}</td>
                  <td className={`py-2.5 text-right ${num} font-bold text-ink`}>{BRL.format(m.receita)}</td>
                  <td className={`py-2.5 text-right ${num} text-ink-soft`}>{BRL.format(m.impostoEstimado)}</td>
                  <td className={`py-2.5 text-right ${num} text-ink-soft`}>{BRL.format(m.despesasOperacionais)}</td>
                  <td className={`py-2.5 text-right ${num} text-ink-soft`}>{BRL.format(m.prolabore)}</td>
                  <td className={`py-2.5 text-right ${num} font-bold ${corDoResultado(m.lucroLiquido)}`}>{BRL.format(m.lucroLiquido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Painel>
      </div>

      <Nota>
        O imposto é uma estimativa pela mesma alíquota da Bússola Tributária; o valor exato da guia (DAS) é o apurado no PGDAS da Receita. Este é
        um relatório gerencial, feito com os lançamentos do sistema — o balanço oficial é o da contabilidade.
      </Nota>
      <Rodape>Hexx Digital · gerado em {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</Rodape>
    </div>
  );
}

/**
 * Sem lançamento na Hexx, mas com apuração no contábil: a empresa FATURA, só
 * que a nota sai pela prefeitura e chega direto ao OneFlow.
 *
 * "Nenhum lançamento encontrado" é verdade sobre a Hexx e mentira sobre a
 * empresa — lido por um cliente, diz que ele não faturou nada. Onde o
 * contábil tem o faturamento, a tela diz isso e aponta onde está o número.
 */
function SemDadosNoHub({ periodo, rbt12, oficial }: { periodo: string; rbt12: number; oficial: boolean }) {
  if (!oficial) {
    return (
      <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
        Nenhum lançamento encontrado para {periodo}.
      </p>
    );
  }
  return (
    <div className="rounded-[28px] border border-dashed border-black/10 px-6 py-10 text-center dark:border-white/10">
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
