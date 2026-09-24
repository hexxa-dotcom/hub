import { getTenantContext } from '@/lib/server/tenant';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { withTenant, sql } from '@hexxa/db';
import { Card } from '@/components/ui/Card';
import { ArrowUpRight, TrendingUp, TrendingDown, CheckCircle2, ArrowRight } from 'lucide-react';
import { CashflowForecast, type CashflowDay } from './CashflowForecast';
import { InadimplenciaChart } from './InadimplenciaChart';
import { ClockCountdown } from '@phosphor-icons/react/dist/ssr';
import { getAvailableProfitAction } from '@/lib/server/profit-distribution';
import Link from 'next/link';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Mês no formato `YYYY-MM-01`, deslocado por `offset` meses a partir de hoje. */
function mesRef(offset: number) {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Bento Grid principal da tela inicial do Hub (/cliente), alinhado ao padrão
 * visual com cards de KPIs atualizados e cards estratégicos de fluxo de caixa e inadimplência.
 */
export async function MesHero({ selectedMonth }: { selectedMonth?: string } = {}) {
  const meses = Array.from({ length: 6 }, (_, i) => {
    if (!selectedMonth) return mesRef(i - 5);
    const parts = selectedMonth.split('-');
    const y = parseInt(parts[0] || '2026', 10);
    const m = parseInt(parts[1] || '9', 10);
    const d = new Date(y, m - 1 + (i - 5), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const atual = meses[5]!;
  const anterior = meses[4]!;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  let serie: number[] = [];
  let despesas = 0;
  let despesasPagas = 0;
  let provisao = 0;
  let qtdReceitas = 0;
  let qtdReceitasAnt = 0;
  let valorDisponivelSaque = 0;

  // Variáveis para Contas Atrasadas & Próximos 14 dias
  let totalInadimplente = 0;
  let qtdInadimplentes = 0;
  let atrasoPorFaixa: { faixa: string; valor: number }[] = [];
  let cashflowDays: CashflowDay[] = [];
  let totalInflow14 = 0;
  let totalOutflow14 = 0;

  try {
    const ctx = await getTenantContext();
    const [dbData, yearlyProfit] = await Promise.all([
      withTenant(ctx.companyId, async (tx) => {
        const [totals, entries] = await Promise.all([
          tx.execute(sql`
            SELECT
              to_char(reference_month, 'YYYY-MM-DD') AS mes,
              COALESCE(SUM(amount) FILTER (WHERE type = 'RECEIVABLE'), 0) AS receita,
              COALESCE(COUNT(*) FILTER (WHERE type = 'RECEIVABLE'), 0) AS qtd_receitas,
              COALESCE(SUM(amount) FILTER (WHERE type = 'PAYABLE'), 0) AS despesa,
              COALESCE(SUM(amount) FILTER (WHERE type = 'PAYABLE' AND status = 'PAID'), 0) AS despesa_paga,
              COALESCE(COUNT(*) FILTER (WHERE type = 'PAYABLE'), 0) AS qtd_despesas,
              COALESCE(SUM(amount) FILTER (
                WHERE type = 'PAYABLE' AND description ILIKE '%Provisão de Imposto%'), 0) AS provisao
            FROM financial_entry
            WHERE company_id = ${ctx.companyId}
              AND status != 'CANCELED'
              AND reference_month >= ${meses[0]!}::date
              AND reference_month <= ${atual}::date
            GROUP BY 1
          `),
          tx.execute(sql`
            SELECT id, amount, type, status, due_date, reference_month
            FROM financial_entry
            WHERE company_id = ${ctx.companyId}
              AND status != 'CANCELED'
          `),
        ]);
        return { totals, entries };
      }),
      getAvailableProfitAction().catch(() => null),
    ]);

    const porMes = new Map(
      (dbData.totals as unknown as Record<string, unknown>[]).map((r) => [
        String(r.mes),
        {
          receita: Number(r.receita ?? 0),
          qtdReceitas: Number(r.qtd_receitas ?? 0),
          despesa: Number(r.despesa ?? 0),
          despesaPaga: Number(r.despesa_paga ?? 0),
          provisao: Number(r.provisao ?? 0),
        },
      ]),
    );

    serie = meses.map((m) => porMes.get(m)?.receita ?? 0);
    const cur = porMes.get(atual);
    const ant = porMes.get(anterior);
    despesas = cur?.despesa ?? 0;
    despesasPagas = cur?.despesaPaga ?? 0;
    provisao = cur?.provisao ?? 0;
    qtdReceitas = cur?.qtdReceitas ?? 0;
    qtdReceitasAnt = ant?.qtdReceitas ?? 0;

    if (yearlyProfit && yearlyProfit.availableToDistribute > 0) {
      valorDisponivelSaque = yearlyProfit.availableToDistribute;
    }

    const entries = dbData.entries as unknown as {
      id: string;
      amount: number | string;
      type: string;
      status: string;
      due_date: string | null;
      reference_month: string;
    }[];

    const receivables = entries.filter((e) => e.type === 'RECEIVABLE');

    // Inadimplência / Contas Atrasadas
    const recebiveisInadimplentes = receivables.filter(
      (e) => e.status === 'PENDING' && e.due_date && e.due_date < todayIso,
    );
    totalInadimplente = recebiveisInadimplentes.reduce((s, e) => s + Number(e.amount), 0);
    qtdInadimplentes = recebiveisInadimplentes.length;

    const diasDeAtraso = (venc: string) =>
      Math.floor((Date.parse(`${todayIso}T00:00:00`) - Date.parse(`${venc}T00:00:00`)) / 86_400_000);
    const FAIXAS = [
      { faixa: 'até 15d', ate: 15 },
      { faixa: '16–30d', ate: 30 },
      { faixa: '31–60d', ate: 60 },
      { faixa: '61–90d', ate: 90 },
      { faixa: '+90d', ate: Infinity },
    ];
    atrasoPorFaixa = FAIXAS.map(({ faixa, ate }, i) => {
      const min = i === 0 ? 0 : FAIXAS[i - 1]!.ate;
      return {
        faixa,
        valor: recebiveisInadimplentes
          .filter((e) => {
            const d = diasDeAtraso(e.due_date!);
            return d > min && d <= ate;
          })
          .reduce((acc, e) => acc + Number(e.amount), 0),
      };
    });

    // Próximos 14 dias
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dIso = d.toISOString().slice(0, 10);
      const dayInflow = receivables
        .filter((e) => e.due_date === dIso && e.status !== 'CANCELED')
        .reduce((s, e) => s + Number(e.amount), 0);
      const dayOutflow = entries
        .filter((e) => e.type === 'PAYABLE' && e.due_date === dIso && e.status !== 'CANCELED')
        .reduce((s, e) => s + Number(e.amount), 0);

      totalInflow14 += dayInflow;
      totalOutflow14 += dayOutflow;

      cashflowDays.push({
        date: dIso,
        dayLabel: dayNames[d.getDay()]!,
        dayNumber: String(d.getDate()).padStart(2, '0'),
        inflow: dayInflow,
        outflow: dayOutflow,
        net: dayInflow - dayOutflow,
        isToday: i === 0,
      });
    }
  } catch (err) {
    console.error('[cliente/MesHero] falha ao carregar totais do mês:', err);
  }

  const faturamento = serie[5] ?? 0;
  const faturamentoAnt = serie[4] ?? 0;
  const saldo = faturamento - despesas;
  if (!valorDisponivelSaque) {
    valorDisponivelSaque = Math.max(0, saldo);
  }

  const ticketMedio = qtdReceitas > 0 ? faturamento / qtdReceitas : 0;
  const ticketMedioAnt = qtdReceitasAnt > 0 ? faturamentoAnt / qtdReceitasAnt : 0;

  const variacao = (atualVal: number, antVal: number) =>
    antVal > 0 ? (atualVal - antVal) / antVal : null;

  const tendencia = variacao(faturamento, faturamentoAnt);
  const tendenciaTicket = variacao(ticketMedio, ticketMedioAnt);
  const margem = faturamento > 0 ? Math.round((saldo / faturamento) * 100) : 0;
  const despesasPendentes = Math.max(0, despesas - despesasPagas);

  return (
    <div className="space-y-6">
      {/* ── 4 Top Cards (Estilo Donezo com Card 1 em destaque escuro) ───────── */}
      {/*
        Os quatro números do mês no padrão CardResumo: sem a seta no canto e
        sem pílulas — a tendência e o contexto vão em texto, na linha de baixo.
      */}
      <GradeDeResumo>
        <CardResumo
          destaque
          rotulo="Faturamento do mês"
          valor={BRL.format(faturamento)}
          nota={tendencia !== null && tendencia !== 0 ? `${tendencia >= 0 ? '+' : '−'}${pct(Math.abs(tendencia))} vs. mês anterior` : 'Estável vs. mês anterior'}
          href="/meu-negocio/notas"
        />
        <CardResumo
          rotulo="Ticket médio"
          valor={BRL.format(ticketMedio)}
          nota={
            tendenciaTicket !== null && tendenciaTicket !== 0
              ? `${tendenciaTicket >= 0 ? '+' : '−'}${pct(Math.abs(tendenciaTicket))} · ${qtdReceitas} recebível(is)`
              : qtdReceitas > 0
                ? `${qtdReceitas} recebível(is)`
                : 'Sem entradas'
          }
          href="/meu-negocio/contas-a-receber"
        />
        <CardResumo
          rotulo="Despesas pagas"
          valor={BRL.format(despesasPagas)}
          nota={despesasPendentes > 0 ? `${BRL.format(despesasPendentes)} ainda pendente` : 'Tudo quitado'}
          href="/meu-negocio/hub-financeiro"
        />
        <CardResumo
          rotulo="Lucro líquido"
          valor={BRL.format(saldo)}
          tom={saldo < 0 ? 'negativo' : 'padrao'}
          nota={`Margem ${margem}% · ${BRL.format(valorDisponivelSaque)} para saque`}
          href="/minha-contabilidade/socios"
        />
      </GradeDeResumo>

      {/* ── Linha Inferior do Hero: Próximos 14 Dias (CashflowForecast) + Contas Atrasadas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2">
          <CashflowForecast days={cashflowDays} totalInflow={totalInflow14} totalOutflow={totalOutflow14} />
        </div>
        <div className="lg:col-span-1">
          <Card level={1} className="card-finish p-6 sm:p-7 flex flex-col justify-between gap-6 h-full">
            <div>
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-full shrink-0 ${
                  totalInadimplente > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-surface shadow-(--elev-inset) text-hexxa-forest dark:text-hexxa-lime'
                }`}>
                  <ClockCountdown className="h-5 w-5" />
                </div>
                <div>
                  <p className="rotulo text-ink-soft">Contas Atrasadas</p>
                  <p className={`font-serif text-2xl sm:text-3xl font-bold tabular mt-0.5 ${
                    totalInadimplente > 0 ? 'text-expense' : 'text-ink'
                  }`}>
                    {totalInadimplente > 0 ? BRL.format(totalInadimplente) : 'Tudo em dia'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-ink-soft mt-3">
                {totalInadimplente > 0
                  ? `${qtdInadimplentes} cobrança(s) em atraso neste mês.`
                  : 'Todos os clientes pagaram no prazo neste mês.'}
              </p>

              {totalInadimplente > 0 && (
                <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5">
                  <p className="rotulo text-ink-soft">Por tempo de atraso</p>
                  <div className="mt-2 h-24">
                    <InadimplenciaChart data={atrasoPorFaixa} />
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/meu-negocio/contas-a-receber"
              className="tap-target pressable focusable inline-flex items-center justify-between gap-2 border-t border-black/5 dark:border-white/5 pt-4 text-xs font-bold text-ink-soft transition-colors hover:text-ink"
            >
              <span>Cobrar clientes</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
