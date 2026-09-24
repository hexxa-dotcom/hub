import { Card, CardHeader, Metric } from '@/components/ui/Card';
import { TaxThermometerService } from '@hexxa/core';
import { AlertTriangle, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, posicaoSimples } from '@/lib/server/fiscal';
import type { TenantContext } from '@hexxa/core';
import { withTenant, sql } from '@hexxa/db';
import { DueDatesTimeline, type TimelineItem } from './DueDatesTimeline';
import { MiniBarChart } from './MiniBarChart';
import { ChunkyBarChart } from './ChunkyBarChart';
import { HalfDonutGauge } from './HalfDonutGauge';
import { TimeTrackerCard } from './TimeTrackerCard';
import { Suspense } from 'react';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import Link from 'next/link';
// `/dist/ssr`, não a raiz: a entrada normal do Phosphor usa Context do React,
// e `createContext` não existe em server component — importar da raiz aqui
// derruba a rota com "createContext is not a function".
import { BellSimple, HandCoins } from '@phosphor-icons/react/dist/ssr';

// Isolado em Suspense pra não travar o dashboard inteiro esperando a
// chamada de IA — o card de dica só aparece quando (e se) ficar pronto.
async function ClienteInsight({ companyId, insightContext }: { companyId: string; insightContext: string }) {
  const insight = await getContextualInsight(companyId, 'cliente', insightContext);
  return <InsightCard pageKey="cliente" insight={insight} />;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number, d = 1) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: d })}%`;
const rate = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

type Entry = {
  id?: string;
  amount: number | string;
  type: string;
  status: string;
  reference_month: string;
  due_date: string | null;
  description?: string;
  category_name?: string | null;
  created_at: string | Date;
};


export async function ResumoView({ selectedMonth }: { selectedMonth?: string } = {}) {
  const now = new Date();
  const curMonth = selectedMonth
    ? (selectedMonth.length === 7 ? `${selectedMonth}-01` : selectedMonth)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const todayIso = now.toISOString().slice(0, 10);

  let entries: Entry[] = [];
  let rbt12 = 0;
  let folha12 = 0;
  let issuingCount = 0;
  let lastClosureDate: string | null = null;
  let openDasGuide: { amount: number; dueDate: string } | null = null;
  let loadError = false;
  let companyId = '';
  let ctxResumo: TenantContext | null = null;
  const [curY, curM] = curMonth.split('-').map(Number);
  const lastMonth = new Date(curY!, curM! - 2, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const ctx = await getTenantContext();
    companyId = ctx.companyId;
    ctxResumo = ctx;
    // getSimplesInputs e o bloco withTenant abaixo só dependem de ctx —
    // independentes entre si, então rodam em paralelo.
    const [simples12, data] = await Promise.all([
      getSimplesInputs(ctx),
      withTenant(ctx.companyId, async (tx) => {
        // As 4 queries abaixo também são independentes entre si.
        const [fe, issuing, closure, dasGuide] = await Promise.all([
          tx.execute(sql`
            SELECT fe.id, fe.amount, fe.type, fe.status, fe.reference_month, fe.due_date, fe.description,
                   fe.created_at, c.name AS category_name
            FROM financial_entry fe
            LEFT JOIN category c ON c.id = fe.category_id
            WHERE fe.company_id = ${ctx.companyId} AND fe.status != 'CANCELED'
          `),
          tx.execute(sql`
            SELECT count(*)::int AS n FROM service_invoice
            WHERE company_id = ${ctx.companyId} AND status = 'ISSUING'
          `),
          tx.execute(sql`
            SELECT id FROM monthly_closure
            WHERE company_id = ${ctx.companyId} AND reference_month = ${lastMonthStr}
            LIMIT 1
          `),
          tx.execute(sql`
            SELECT amount, due_date FROM tax_guide
            WHERE company_id = ${ctx.companyId} AND tax_name IN ('DAS', 'DAS - Simples Nacional') AND status = 'OPEN' AND NOT provisional
            ORDER BY due_date DESC
            LIMIT 1
          `),
        ]);
        return {
          entries: fe as unknown as Entry[],
          issuing: Number(issuing[0]?.n ?? 0),
          hasClosure: closure.length > 0,
          dasGuide: dasGuide[0] ? { amount: Number(dasGuide[0].amount), dueDate: String(dasGuide[0].due_date) } : null,
        };
      }),
    ]);
    rbt12 = simples12.rbt12;
    folha12 = simples12.folha12;
    entries = data.entries;
    issuingCount = data.issuing;
    if (data.hasClosure) lastClosureDate = lastMonthStr;
    openDasGuide = data.dasGuide;
  } catch (err) {
    console.error('[dashboard/page] falha ao carregar dados do dashboard:', err);
    loadError = true;
  }

  // Cálculos financeiros do mês corrente
  const receivables = entries.filter((e) => e.type === 'RECEIVABLE');
  const faturamentoMes = receivables
    .filter((e) => e.reference_month === curMonth)
    .reduce((s, e) => s + Number(e.amount), 0);
  const despesasMes = entries
    .filter((e) => e.type === 'PAYABLE' && e.reference_month === curMonth)
    .reduce((s, e) => s + Number(e.amount), 0);
  const lucro = faturamentoMes - despesasMes;

  // Provisão de Imposto (DAS)
  const provisao = entries
    .filter((e) => e.type === 'PAYABLE' && e.reference_month === curMonth && String(e.description || '').includes('Provisão de Imposto'))
    .reduce((s, e) => s + Number(e.amount), 0);

  // Faturamento Diário (Hoje)
  const faturamentoDiario = receivables
    .filter((e) => e.due_date === todayIso && e.status !== 'CANCELED')
    .reduce((s, e) => s + Number(e.amount), 0);

  // Faturamento Semanal (últimos 7 dias até hoje)
  const sevenDaysAgoDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const sevenDaysAgoIso = sevenDaysAgoDate.toISOString().slice(0, 10);
  const faturamentoSemanal = receivables
    .filter((e) => e.due_date && e.due_date >= sevenDaysAgoIso && e.due_date <= todayIso && e.status !== 'CANCELED')
    .reduce((s, e) => s + Number(e.amount), 0);

  // Métrica Estratégica 1: Saldo Líquido Projetado do Mês (O que realmente sobra no bolso)
  const saldoProjetado = faturamentoMes - despesasMes - provisao;
  const margemLiquidaFinal = faturamentoMes > 0 ? saldoProjetado / faturamentoMes : 0;

  // Métrica Estratégica 2: Lucro Isento para Sócios (Consultoria Hexx)
  // Série da sobra: o card diz quanto sobra ESTE mês; a curva diz se isso vem
  // crescendo ou encolhendo, que é a pergunta seguinte.
  const sobraPorMes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const ref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const rec = entries
      .filter((e) => e.type === 'RECEIVABLE' && e.reference_month === ref)
      .reduce((a, e) => a + Number(e.amount), 0);
    const pag = entries
      .filter((e) => e.type === 'PAYABLE' && e.reference_month === ref)
      .reduce((a, e) => a + Number(e.amount), 0);
    return {
      rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      /* Sem piso em zero, ao contrário do número do card: ali o zero existe
         porque não se distribui prejuízo; aqui ele mentiria — um mês de
         −R$ 5 mil ficaria idêntico a um mês em que sobrou exatamente nada. */
      valor: rec - pag,
    };
  });
  const temSobraHistorica = sobraPorMes.some((m) => m.valor !== 0);

  const chunkySobraItems = sobraPorMes.map((m, i) => {
    const isCurrent = i === sobraPorMes.length - 1;
    return {
      label: m.rotulo.toUpperCase(),
      value: m.valor,
      formattedValue: BRL.format(m.valor),
      isHighlight: isCurrent,
      pattern: isCurrent
        ? ('solid' as const)
        : i % 2 === 0
        ? ('hatched' as const)
        : ('muted' as const),
    };
  });

  const lucroIsentoDisponivel = Math.max(0, saldoProjetado);
  const economiaIRPF = lucroIsentoDisponivel * 0.275;

  // Métrica Estratégica 3: Radar de Inadimplência / Dinheiro na Rua
  const recebiveisInadimplentes = receivables.filter((e) => e.status === 'PENDING' && e.due_date && e.due_date < todayIso);
  const totalInadimplente = recebiveisInadimplentes.reduce((s, e) => s + Number(e.amount), 0);
  const qtdInadimplentes = recebiveisInadimplentes.length;

  // Série semestral de Faturamento (Evolução do Faturamento migrada do topo)
  const fatPorMes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const ref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const rec = entries
      .filter((e) => e.type === 'RECEIVABLE' && e.reference_month === ref)
      .reduce((a, e) => a + Number(e.amount), 0);
    return {
      rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
      valor: rec,
    };
  });

  const chunkyFatItems = fatPorMes.map((m, i) => {
    const isCurrent = i === fatPorMes.length - 1;
    return {
      label: m.rotulo,
      value: m.valor,
      formattedValue: BRL.format(m.valor),
      isHighlight: isCurrent,
      pattern: isCurrent
        ? ('solid' as const)
        : i % 2 === 0
        ? ('hatched' as const)
        : ('muted' as const),
    };
  });
  const margemOp = faturamentoMes > 0 ? Math.round((saldoProjetado / faturamentoMes) * 100) : 0;

  // Só o mês anterior, não a série inteira: o histórico de 8 meses vive no
  // Resumo do mês; aqui basta a comparação que o número do topo exibe.
  const faturamentoMesAnterior = receivables
    .filter((e) => e.reference_month === lastMonthStr)
    .reduce((s, e) => s + Number(e.amount), 0);
  const fatTrend =
    faturamentoMesAnterior > 0 ? (faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior : 0;

  // Termômetro Tributário & Simples
  // O oficial por cima do estimado: o texto que a IA lê abaixo diz o anexo e
  // a alíquota, e eles precisam ser os da apuração, não os da conta interna.
  const simples = ctxResumo
    ? await posicaoSimples(ctxResumo, { rbt12, folha12 }).catch((err) => {
        console.warn('[dashboard/page] falha ao carregar posicaoSimples, usando estimativa:', err);
        return new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });
      })
    : new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });
  const nextMonthLabel = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('pt-BR', { month: 'long' });


  // Avisos reais & Timeline
  const in7DaysIso = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const pendentes = entries.filter((e) => e.type === 'PAYABLE' && e.status === 'PENDING' && e.due_date);
  const vencidas = pendentes.filter((e) => e.due_date! < todayIso);
  const vencendo = pendentes.filter((e) => e.due_date! >= todayIso && e.due_date! <= in7DaysIso);
  const avisos: { tone: 'critical' | 'warn' | 'info'; text: string }[] = [];
  if (vencidas.length) avisos.push({ tone: 'critical', text: `${vencidas.length} conta${vencidas.length > 1 ? 's' : ''} a pagar vencida${vencidas.length > 1 ? 's' : ''} — ${BRL.format(vencidas.reduce((s, e) => s + Number(e.amount), 0))}` });
  if (vencendo.length) avisos.push({ tone: 'warn', text: `${vencendo.length} conta${vencendo.length > 1 ? 's' : ''} a pagar vence${vencendo.length > 1 ? 'm' : ''} nos próximos 7 dias` });
  if (issuingCount) avisos.push({ tone: 'info', text: `${issuingCount} nota${issuingCount > 1 ? 's' : ''} aguardando processamento no Emissor Nacional` });

  const timelineItems: TimelineItem[] = [
    ...(openDasGuide
      ? [
          {
            id: 'das-guide',
            type: 'tax' as const,
            title: 'Guia do Simples Nacional (DAS)',
            amount: openDasGuide.amount,
            dueDate: openDasGuide.dueDate,
            status: openDasGuide.dueDate < todayIso ? ('overdue' as const) : ('pending' as const),
            category: 'Imposto Federal',
            link: '/minha-contabilidade/guias',
          },
        ]
      : []),
    ...entries
      .filter((e) => e.due_date && e.status === 'PENDING')
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 10)
      .map((e) => ({
        id: String(e.id || Math.random()),
        type: e.type === 'PAYABLE' ? ('payable' as const) : ('receivable' as const),
        title: e.description || (e.type === 'PAYABLE' ? 'Conta a Pagar' : 'Recebível'),
        amount: Number(e.amount),
        dueDate: e.due_date!,
        status: e.due_date! < todayIso ? ('overdue' as const) : ('pending' as const),
        category: e.category_name || (e.type === 'PAYABLE' ? 'Despesa' : 'Receita'),
        link: e.type === 'PAYABLE' ? '/meu-negocio/contas-a-pagar' : '/meu-negocio/contas-a-receber',
      })),
  ];

  const insightContext = [
    `Tela: painel executivo (resumo em tempo real) de uma empresa de serviço optante do Simples Nacional.`,
    `Faturamento do mês: R$ ${faturamentoMes.toFixed(2)}. Despesas do mês: R$ ${despesasMes.toFixed(2)}. Saldo líquido projetado: R$ ${saldoProjetado.toFixed(2)}.`,
    `Imposto provisionado (DAS): R$ ${provisao.toFixed(2)}. Enquadramento: Anexo ${simples.anexo}, Fator R ${(simples.fatorR * 100).toFixed(1)}%.`,
    `Inadimplência de clientes: R$ ${totalInadimplente.toFixed(2)} (${qtdInadimplentes} recebíveis atrasados).`,
    `Contas a pagar vencidas: ${vencidas.length}${vencidas.length ? ` — total R$ ${vencidas.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}` : ''}.`,
    `Notas fiscais aguardando processamento: ${issuingCount}.`,
  ].join('\n');
  return (
    <div className="space-y-10">
      {!loadError && companyId && (
        <Suspense fallback={null}>
          <ClienteInsight companyId={companyId} insightContext={insightContext} />
        </Suspense>
      )}



      {loadError && (
        <Card level={1} className="flex items-center gap-3 border-critical/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-critical" />
          <p className="text-callout text-ink">
            Não foi possível carregar alguns dados financeiros. Recarregue a página em instantes.
          </p>
        </Card>
      )}

      {lastClosureDate && (
        <Card level={1} className="card-finish p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-serif font-bold text-base sm:text-lg text-ink">O fechamento contábil do mês anterior está pronto</p>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Resumo contábil e notas fiscais consolidadas pela contabilidade.
            </p>
          </div>
          <Link
            href={`/meu-negocio/relatorios/fechamento?month=${lastClosureDate}`}
            className="tap-target pressable focusable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-hexxa-forest px-4 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:bg-hexxa-green"
          >
            Ver relatório
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      )}

      {/* 1. Próximos Vencimentos (Trabalhado e Ampliado) + Avisos e Guias */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <DueDatesTimeline items={timelineItems} />
        </div>

        <div className="lg:col-span-1 flex flex-col">
          <Card level={1} className="card-finish p-6 sm:p-7 flex flex-col justify-between gap-6 h-full">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-(--elev-inset) text-amber-600 dark:text-amber-400 shrink-0">
                    <BellSimple className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="rotulo text-ink-soft">Avisos e Guias</p>
                    <p className="font-serif text-xl sm:text-2xl font-bold text-ink tabular mt-0.5">
                      {openDasGuide ? '1 Guia Aberta' : avisos.length > 0 ? `${avisos.length} Alerta(s)` : 'Tudo em dia'}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  openDasGuide || vencidas.length > 0
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {openDasGuide || vencidas.length > 0 ? 'Atenção' : 'Regular'}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {openDasGuide && (
                  <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">Guia DAS (Simples Nacional)</span>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">A vencer</span>
                    </div>
                    <p className="font-serif font-bold text-lg text-ink tabular">
                      {BRL.format(openDasGuide.amount)}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      Vencimento em {new Date(`${openDasGuide.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}
                    </p>
                    <Link
                      href="/minha-contabilidade/guias"
                      className="tap-target pressable focusable inline-flex items-center gap-1 text-xs font-semibold text-hexxa-forest dark:text-hexxa-lime hover:underline pt-1"
                    >
                      Visualizar e pagar guia <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {avisos.map((a) => (
                  <div
                    key={a.text}
                    className={`flex items-start gap-2.5 p-3 rounded-xl text-xs font-medium ${
                      a.tone === 'critical'
                        ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300'
                        : a.tone === 'warn'
                          ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                          : 'bg-surface text-ink'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                      a.tone === 'critical' ? 'bg-rose-500' : a.tone === 'warn' ? 'bg-amber-500' : 'bg-hexxa-forest'
                    }`} />
                    <span className="flex-1 leading-snug">{a.text}</span>
                  </div>
                ))}

                {!openDasGuide && avisos.length === 0 && (
                  <p className="text-xs text-ink-soft py-4 text-center">Nenhum aviso ou pendência fiscal no momento.</p>
                )}
              </div>
            </div>

            <div className="border-t border-black/5 dark:border-white/5 pt-4 flex items-center justify-between">
              <span className="text-caption text-ink-soft">Dúvidas com guias?</span>
              <Link
                href="/suporte"
                className="tap-target pressable focusable inline-flex items-center gap-1 text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline"
              >
                Falar com contador <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* 2. Evolução do Faturamento & Eficiência Operacional (migradas do topo) */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2">
          <ChunkyBarChart
            items={chunkyFatItems}
            title="Evolução do Faturamento"
            subtitle="Histórico semestral com barras espessas hachuradas"
            height={180}
          />
        </div>
        <div className="lg:col-span-1">
          <HalfDonutGauge
            percentage={margemOp > 0 ? margemOp : 75}
            title="Eficiência Operacional"
            subtitle="Margem de lucro sobre receita do mês"
            realizadoLabel="Sobra Líquida"
            restanteLabel="Custos / DAS"
            margemLabel="Margem"
            margemValue={pct(margemOp > 0 ? margemOp / 100 : 0.748)}
          />
        </div>
      </div>

      {/* 3. Sobra para Você + Time Tracker de Gestão */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <Card level={1} className="card-finish p-6 sm:p-7 flex flex-col justify-between gap-6 h-full">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-(--elev-inset) text-hexxa-forest dark:text-hexxa-lime">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="rotulo text-ink-soft">Sobra para Você</p>
                    <p className="font-serif text-2xl sm:text-3xl font-bold text-ink tabular mt-0.5">
                      {BRL.format(lucroIsentoDisponivel)}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Isento de IRPF
                </span>
              </div>

              <p className="text-xs text-ink-soft mt-3">
                Livre de imposto de renda — valor disponível para transferência à conta pessoal no mês.
              </p>

              {temSobraHistorica && (
                <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5">
                  <ChunkyBarChart
                    items={chunkySobraItems}
                    title="Evolução da Sobra Líquida"
                    subtitle="Histórico semestral de lucros isentos para sócios"
                    height={150}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-black/5 dark:border-white/5 pt-4">
              <div>
                <p className="rotulo text-ink-soft">Economia no IRPF</p>
                <p className="font-serif text-lg font-bold tabular text-ink mt-0.5">~{BRL.format(economiaIRPF)}</p>
              </div>
              <Link
                href="/minha-contabilidade/socios"
                className="tap-target pressable focusable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/10 shadow-(--elev-1) px-4 py-2 text-xs font-bold text-ink hover:text-hexxa-forest dark:hover:text-hexxa-lime transition-all"
              >
                Gerenciar Retiradas
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1 flex flex-col">
          <TimeTrackerCard />
        </div>
      </div>

    </div>
  );
}
