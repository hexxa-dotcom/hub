import { Card, CardHeader, Metric } from '@/components/ui/Card';
import { TaxThermometerService } from '@hexxa/core';
import { AlertTriangle, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, posicaoSimples } from '@/lib/server/fiscal';
import type { TenantContext } from '@hexxa/core';
import { withTenant, sql } from '@hexxa/db';
import { DueDatesTimeline } from './DueDatesTimeline';
import { CashflowForecast, type CashflowDay } from './CashflowForecast';
import { InadimplenciaChart } from './InadimplenciaChart';
import { MiniBarChart } from './MiniBarChart';
import { Suspense } from 'react';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import Link from 'next/link';
// `/dist/ssr`, não a raiz: a entrada normal do Phosphor usa Context do React,
// e `createContext` não existe em server component — importar da raiz aqui
// derruba a rota com "createContext is not a function".
import { BellSimple, ClockCountdown, HandCoins } from '@phosphor-icons/react/dist/ssr';

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


export async function ResumoView() {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
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
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
            WHERE company_id = ${ctx.companyId} AND tax_name IN ('DAS', 'DAS - Simples Nacional') AND status = 'OPEN'
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

  const lucroIsentoDisponivel = Math.max(0, saldoProjetado);
  const economiaIRPF = lucroIsentoDisponivel * 0.275;

  // Métrica Estratégica 3: Radar de Inadimplência / Dinheiro na Rua
  const recebiveisInadimplentes = receivables.filter((e) => e.status === 'PENDING' && e.due_date && e.due_date < todayIso);
  const totalInadimplente = recebiveisInadimplentes.reduce((s, e) => s + Number(e.amount), 0);
  const qtdInadimplentes = recebiveisInadimplentes.length;

  // Faixas de atraso: o total esconde a gravidade. R$ 10 mil vencidos ontem é
  // cobrança; os mesmos R$ 10 mil vencidos há 90 dias é perda provável.
  const diasDeAtraso = (venc: string) =>
    Math.floor((Date.parse(`${todayIso}T00:00:00`) - Date.parse(`${venc}T00:00:00`)) / 86_400_000);
  const FAIXAS = [
    { faixa: 'até 15d', ate: 15 },
    { faixa: '16–30d', ate: 30 },
    { faixa: '31–60d', ate: 60 },
    { faixa: '61–90d', ate: 90 },
    { faixa: '+90d', ate: Infinity },
  ];
  const atrasoPorFaixa = FAIXAS.map(({ faixa, ate }, i) => {
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

  // Métrica Estratégica 4: Projeção de Fluxo de Caixa (14 dias)
  const cashflowDays: CashflowDay[] = [];
  let totalInflow14 = 0;
  let totalOutflow14 = 0;
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
    ? await posicaoSimples(ctxResumo, { rbt12, folha12 })
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
  const tudoEmDia = vencidas.length === 0 && qtdInadimplentes === 0;

  const timelineItems = [
    ...(openDasGuide
      ? [
          {
            id: 'das-guide',
            type: 'tax' as const,
            title: 'Guia do Simples Nacional (DAS)',
            amount: openDasGuide.amount,
            dueDate: openDasGuide.dueDate,
            status: openDasGuide.dueDate < todayIso ? ('overdue' as const) : ('pending' as const),
            link: '/minha-contabilidade/guias',
          },
        ]
      : []),
    ...entries
      .filter((e) => e.due_date && e.status === 'PENDING')
      .slice(0, 8)
      .map((e) => ({
        id: String(e.id || Math.random()),
        type: e.type === 'PAYABLE' ? ('payable' as const) : ('receivable' as const),
        title: e.description || (e.type === 'PAYABLE' ? 'Conta a Pagar' : 'Recebível'),
        amount: Number(e.amount),
        dueDate: e.due_date!,
        status: e.due_date! < todayIso ? ('overdue' as const) : ('pending' as const),
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

      <div className="flex justify-end">
        {tudoEmDia ? (
          <p className="inline-flex items-center gap-2 text-footnote font-semibold text-ok dark:text-hexxa-lime">
            <CheckCircle2 className="h-4 w-4" />
            Operação em dia
          </p>
        ) : (
          <p className="inline-flex items-center gap-2 text-footnote font-semibold text-warn">
            <AlertCircle className="h-4 w-4" />
            Atenção a prazos
          </p>
        )}
      </div>

      {loadError && (
        <Card level={1} className="flex items-center gap-3 border-critical/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-critical" />
          <p className="text-callout text-ink">
            Não foi possível carregar alguns dados financeiros. Recarregue a página em instantes.
          </p>
        </Card>
      )}

      {lastClosureDate && (
        <Card level={1} className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-heading text-ink">O fechamento contábil do mês anterior está pronto</p>
            <p className="text-footnote text-ink-soft mt-1">
              Resumo contábil e notas fiscais consolidadas.
            </p>
          </div>
          <Link
            href={`/meu-negocio/relatorios/fechamento?month=${lastClosureDate}`}
            className="tap-target pressable focusable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-hexxa-green-dark px-5 py-2.5 text-footnote font-semibold text-hexxa-cream transition-colors hover:bg-hexxa-green"
          >
            Ver relatório
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      )}

      {/* O faturamento do mês saiu daqui: agora é o card principal da tela,
          acima do seletor de vista, porque serve às duas. */}
      <Card level={2} className="flex flex-col justify-between gap-6">
          <div>
            <CardHeader label="Sobra para você" icon={HandCoins} />
            <Metric
              value={BRL.format(lucroIsentoDisponivel)}
              size="display"
              className="mt-4 text-hexxa-green dark:text-hexxa-lime"
            />
            <p className="text-footnote text-ink-soft mt-3">
              Livre de imposto de renda — o que pode ir para a sua conta pessoal este mês.
            </p>

            {temSobraHistorica && (
              <div className="mt-6">
                <p className="text-caption uppercase text-ink-soft">Evolução da sobra</p>
                <div className="mt-2 h-20">
                  <MiniBarChart data={sobraPorMes} label="Sobra" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-line pt-5">
            <div>
              <p className="text-caption uppercase text-ink-soft">Economia no IRPF</p>
              <p className="text-heading tabular text-ink mt-1">~{BRL.format(economiaIRPF)}</p>
            </div>
            <Link
              href="/minha-contabilidade/socios"
              className="tap-target pressable focusable inline-flex shrink-0 items-center gap-1 text-footnote font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              Retiradas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>

      {/* 2. Inadimplência e projeção de caixa. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card level={1} className="flex flex-col justify-between gap-6">
          <div>
            <CardHeader label="Contas atrasadas" icon={ClockCountdown} />
            {totalInadimplente > 0 ? (
              <>
                <Metric
                  value={BRL.format(totalInadimplente)}
                  size="display"
                  className="mt-4 text-critical"
                />
                <p className="text-footnote text-ink-soft mt-3">
                  {qtdInadimplentes} cobrança{qtdInadimplentes > 1 ? 's' : ''} passou do vencimento.
                </p>
                <div className="mt-6">
                  <p className="text-caption uppercase text-ink-soft">Por tempo de atraso</p>
                  <div className="mt-2 h-24">
                    <InadimplenciaChart data={atrasoPorFaixa} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <Metric
                  value="Tudo em dia"
                  size="title2"
                  className="mt-4 text-ok dark:text-hexxa-lime"
                />
                <p className="text-footnote text-ink-soft mt-3">
                  Todos os clientes pagaram no prazo neste mês.
                </p>
              </>
            )}
          </div>

          <Link
            href="/meu-negocio/contas-a-receber"
            className="tap-target pressable focusable inline-flex items-center justify-between gap-2 border-t border-line pt-5 text-footnote font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            Cobrar clientes
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>

        <div className="lg:col-span-2">
          <CashflowForecast days={cashflowDays} totalInflow={totalInflow14} totalOutflow={totalOutflow14} />
        </div>
      </div>

      {/* 4. Vencimentos e avisos. */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DueDatesTimeline items={timelineItems} />
        </div>

        <Card level={1} className="lg:col-span-2">
          <CardHeader label="Avisos e guias" icon={BellSimple} href="/suporte" hrefLabel="Suporte" />

          <div className="mt-6 space-y-5">
            {openDasGuide && (
              <div>
                <p className="text-heading text-ink">Guia do DAS disponível</p>
                <p className="text-footnote text-ink-soft mt-1.5">
                  <span className="tabular text-ink">{BRL.format(openDasGuide.amount)}</span>
                  {' · vence em '}
                  {new Date(`${openDasGuide.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}
                </p>
                <Link
                  href="/minha-contabilidade/guias"
                  className="tap-target pressable focusable mt-2.5 inline-flex items-center gap-1 text-footnote font-semibold text-hexxa-green dark:text-hexxa-lime hover:underline"
                >
                  Ver guia
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* Aviso como filete lateral, não como caixa preenchida: a cor
                marca a severidade sem virar mais um bloco na tela. */}
            {avisos.map((a) => (
              <p
                key={a.text}
                className={`border-l-2 pl-4 text-footnote text-ink ${
                  a.tone === 'critical'
                    ? 'border-critical'
                    : a.tone === 'warn'
                      ? 'border-warn'
                      : 'border-line'
                }`}
              >
                {a.text}
              </p>
            ))}

            {!openDasGuide && avisos.length === 0 && (
              <p className="text-footnote text-ink-soft">Nenhum aviso pendente.</p>
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}
