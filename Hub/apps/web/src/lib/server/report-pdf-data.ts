import 'server-only';
import type { TenantContext } from '@hexxa/core';
import {
  getCompanyIdentity,
  getBalancoDreData,
  getFaturamentoData,
  getFaturamentoPorClienteData,
  monthLabelShort,
} from './reports';
import type { ReportPdfData } from './pdf/report-pdf';

/**
 * Monta o `ReportPdfData` (formato genérico do renderer em pdf/report-pdf.tsx)
 * a partir dos dados reais de cada relatório — usado tanto pelo endpoint de
 * download (/api/reports/[type]) quanto pelo envio pra assinatura, pra não
 * duplicar a formatação em dois lugares.
 */

export type ReportType = 'balanco' | 'faturamento' | 'faturamento-por-cliente';

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export async function buildReportPdfData(
  type: ReportType,
  ctx: TenantContext,
  query: Record<string, string | undefined>,
): Promise<ReportPdfData | null> {
  const company = await getCompanyIdentity(ctx);

  if (type === 'balanco') {
    const d = await getBalancoDreData(ctx, { de: query.de, ate: query.ate });
    const tables: ReportPdfData['tables'] = [
      {
        heading: 'Demonstrativo de Resultado (DRE)',
        headers: ['Linha', 'Valor'],
        rows: [
          ['Receita Bruta', BRL(d.receita)],
          ['(−) Despesas Operacionais', BRL(d.despesasOperacionais)],
          ['(−) Pró-labore dos Sócios', BRL(d.prolabore)],
          [`(−) Imposto Estimado (Simples, ${pct(d.simples.effectiveRate)} efetiva)`, BRL(d.impostoEstimado)],
          ['= Lucro Líquido do Período', BRL(d.lucroLiquido)],
        ],
        highlightRowIndex: 4,
      },
    ];
    if (d.categorias.length > 0) {
      tables.push({
        heading: 'Despesas por Categoria',
        headers: ['Categoria', 'Valor'],
        rows: d.categorias.map(([label, value]) => [label, BRL(value)]),
      });
    }
    tables.push({
      heading: 'Histórico Mensal',
      headers: ['Mês', 'Receita', 'Despesas', 'Resultado'],
      rows: d.monthly.map((m) => [
        monthLabelShort(m.month),
        BRL(m.receita),
        BRL(m.despesasOperacionais + m.prolabore + m.impostoEstimado),
        BRL(m.lucroLiquido),
      ]),
    });

    return {
      reportTitle: 'Balanço e DRE',
      periodLabel: d.periodoLabel,
      company,
      summaryCards: [
        { label: 'Receita Bruta', value: BRL(d.receita) },
        { label: 'Despesas Totais', value: BRL(d.despesasTotais) },
        { label: `Resultado (${pct(d.margem)})`, value: BRL(d.lucroLiquido) },
      ],
      tables,
      note: 'Imposto estimado pela alíquota efetiva ATUAL do Simples Nacional — não é o valor apurado oficialmente. O valor exato de cada guia (DAS) é o do PGDAS-D da Receita Federal.',
    };
  }

  if (type === 'faturamento') {
    const d = await getFaturamentoData(ctx, { ano: query.ano });
    const visao = query.visao === 'anual' ? 'anual' : 'mensal';

    if (visao === 'anual') {
      return {
        reportTitle: 'Faturamento Anual',
        periodLabel: 'Comparativo entre anos',
        company,
        summaryCards: [],
        tables: [
          {
            heading: 'Faturamento por Ano',
            headers: ['Ano', 'Receita', 'Despesas', 'Lucro Estimado', 'Margem'],
            rows: d.anual.map((a) => [a.ano, BRL(a.receita), BRL(a.despesas + a.impostoEstimado), BRL(a.lucroLiquido), pct(a.margem)]),
          },
        ],
        note: 'Imposto estimado pela alíquota efetiva ATUAL do Simples Nacional aplicada a cada ano — não recalcula a faixa histórica de cada período.',
      };
    }

    return {
      reportTitle: 'Faturamento Mensal',
      periodLabel: d.ano,
      company,
      summaryCards: [{ label: 'Total do Ano', value: BRL(d.totalAnoMensal) }],
      tables: [
        {
          heading: `Receita por Mês — ${d.ano}`,
          headers: ['Mês', 'Receita'],
          rows: d.meses.map((m) => [m.label, BRL(m.valor)]),
        },
      ],
    };
  }

  if (type === 'faturamento-por-cliente') {
    const d = await getFaturamentoPorClienteData(ctx, { ano: query.ano });
    return {
      reportTitle: 'Faturamento por Cliente',
      periodLabel: d.ano,
      company,
      summaryCards: [
        { label: 'Receita Total', value: BRL(d.receitaTotal) },
        { label: 'Margem Líquida do Ano', value: pct(d.margemLiquidaAno * 100) },
      ],
      tables: [
        {
          heading: `Faturamento por Cliente — ${d.ano}`,
          headers: ['Cliente', 'Receita', 'Participação', 'Margem Estimada'],
          rows: d.clientes.map((c) => [c.nome, BRL(c.receita), pct(c.participacao), BRL(c.margemEstimada)]),
        },
      ],
      note: 'Margem estimada = participação do cliente na receita × margem líquida da empresa no ano. O sistema não rastreia custo direto por cliente — é um rateio proporcional, não o lucro real daquele cliente específico.',
    };
  }

  return null;
}
