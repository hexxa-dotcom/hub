import { getTenantContext } from '@/lib/server/tenant';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento do Mês com número ampliado para maior ênfase */}
        <div data-card="true" className="relative overflow-hidden rounded-[28px] backdrop-blur-xl bg-[#0A0D0B]/85 dark:bg-[#0A0D0B]/75 p-5 sm:p-6 text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-emerald-500/20 ring-1 ring-inset ring-white/10 flex flex-col justify-between group transition-all hover:scale-[1.01]">
          {/* Brilho verde sutil atmosférico no card */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-[#D4FF00]/15 blur-2xl atmospheric-glow" />
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-white/70">Faturamento do Mês</p>
              <p className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#D4FF00] tabular tracking-tight leading-none">
                {BRL.format(faturamento)}
              </p>
            </div>
            <Link
              href="/meu-negocio/notas"
              title="Ver notas fiscais e faturamento"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[#D4FF00] shadow-sm backdrop-blur-sm group-hover:bg-[#D4FF00] group-hover:text-black transition-all cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {tendencia !== null && tendencia !== 0 ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                tendencia >= 0
                  ? 'bg-[#D4FF00]/20 text-[#D4FF00]'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                {tendencia >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {pct(Math.abs(tendencia))}
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white/80">
                Estável
              </span>
            )}
            <span className="text-xs text-white/70">vs. mês anterior</span>
          </div>
        </div>

        {/* Card 2: Ticket Médio */}
        <Card level={1} className="p-5 sm:p-6 flex flex-col justify-between group">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-ink-soft">Ticket Médio</p>
              <p className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-ink tabular tracking-tight">
                {BRL.format(ticketMedio)}
              </p>
            </div>
            <Link
              href="/meu-negocio/contas-a-receber"
              title="Ver recebimentos"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-ink-soft">
            {tendenciaTicket !== null && tendenciaTicket !== 0 ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                tendenciaTicket >= 0
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
              }`}>
                {tendenciaTicket >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {pct(Math.abs(tendenciaTicket))}
              </span>
            ) : (
              <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                {qtdReceitas} entrada{qtdReceitas === 1 ? '' : 's'}
              </span>
            )}
            <span>{qtdReceitas > 0 ? `${qtdReceitas} recebível(is)` : 'Sem entradas'}</span>
          </div>
        </Card>

        {/* Card 3: Total de Despesas Já Pago */}
        <Card level={1} className="p-5 sm:p-6 flex flex-col justify-between group">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-ink-soft">Total de Despesas Já Pago</p>
              <p className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-ink tabular tracking-tight">
                {BRL.format(despesasPagas)}
              </p>
            </div>
            <Link
              href="/meu-negocio/hub-financeiro"
              title="Ver despesas e pagamentos"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Pago no mês
            </span>
            <span title={`Total orçado: ${BRL.format(despesas)}`}>
              {despesasPendentes > 0 ? `${BRL.format(despesasPendentes)} pendente` : 'Tudo quitado'}
            </span>
          </div>
        </Card>

        {/* Card 4: Lucro Líquido com Margem Líquida % e Valor Disponível para Saque dos Sócios */}
        <Card level={1} className="p-5 sm:p-6 flex flex-col justify-between group">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-ink-soft">Lucro Líquido</p>
              <p className={`mt-2 font-serif text-2xl sm:text-3xl font-bold tabular tracking-tight ${saldo >= 0 ? 'text-ink' : 'text-expense'}`}>
                {BRL.format(saldo)}
              </p>
            </div>
            <Link
              href="/minha-contabilidade/socios"
              title="Gerenciar retiradas de sócios"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              Margem {margem}%
            </span>
            <div className="text-right">
              <span className="text-[10px] text-ink-soft block leading-tight">Disponível p/ saque</span>
              <span className="font-serif font-bold text-xs text-hexxa-forest dark:text-hexxa-lime tabular">
                {BRL.format(valorDisponivelSaque)}
              </span>
            </div>
          </div>
        </Card>
      </div>

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
                  <p className="text-caption font-bold text-ink-soft uppercase tracking-wider">Contas Atrasadas</p>
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
                  <p className="text-caption uppercase text-ink-soft">Por tempo de atraso</p>
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
