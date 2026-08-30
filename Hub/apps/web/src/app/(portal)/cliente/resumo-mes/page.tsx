import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { ResumoMesView, type MonthSummary, type CompromissoRow, type WeekFlow } from './ResumoMesView';

export const dynamic = 'force-dynamic';

type Entry = {
  id: string;
  amount: number | string;
  type: 'PAYABLE' | 'RECEIVABLE';
  status: string;
  reference_month: string;
  due_date: string;
  description: string | null;
  category_name: string | null;
};

type ContractRow = {
  id: string;
  type: 'ENTRADA' | 'SAIDA';
  title: string;
  party_name: string;
  value: number | string;
  status: string;
  start_date: string;
  end_date: string;
};

type RecurringExpenseRow = {
  id: string;
  description: string;
  amount: number | string;
  due_day: number;
  category_name: string | null;
  active: boolean;
};

type DistributionRow = {
  amount: number | string;
  distributed_at: string;
};

type InvoiceCountRow = {
  reference_month: string;
  n: number;
};

type CustomerRow = {
  id: string;
  created_at: string;
};

type EmploymentEventRow = {
  type: 'ADMISSION' | 'TERMINATION';
  event_date: string;
  employee_name: string;
};

const MONTHS_BACK = 12; // 13 meses de histórico

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthEndOf(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m!, 0).toISOString().slice(0, 10);
}

function isImposto(e: Entry) {
  return String(e.description || '').includes('Provisão de Imposto');
}
function emAberto(e: Entry) {
  return e.status === 'PENDING' || e.status === 'OVERDUE';
}
function sum(list: Entry[]) {
  return list.reduce((s, e) => s + Number(e.amount), 0);
}

/** Lucro acumulado de 1º de janeiro até o fim do mês informado. */
function lucroAcumuladoNoAno(allEntries: Entry[], key: string, monthEnd: string) {
  const yearStart = `${key.slice(0, 4)}-01-01`;
  const inRange = allEntries.filter(
    (e) => e.status !== 'CANCELED' && e.reference_month >= yearStart && e.reference_month <= monthEnd
  );
  return sum(inRange.filter((e) => e.type === 'RECEIVABLE')) - sum(inRange.filter((e) => e.type === 'PAYABLE'));
}

function groupByCategory(list: Entry[]): { label: string; value: number }[] {
  const byCat = new Map<string, number>();
  for (const e of list) {
    const key = e.category_name?.trim() || 'Outros';
    byCat.set(key, (byCat.get(key) ?? 0) + Number(e.amount));
  }
  return [...byCat.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export default async function ResumoMesPage() {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const monthDates: Date[] = [];
  for (let i = MONTHS_BACK; i >= 0; i--) {
    monthDates.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  const monthKeys = monthDates.map(monthKey);
  const curMonth = monthKeys[monthKeys.length - 1]!;

  const earliestYear = Number(monthKeys[0]!.slice(0, 4));
  const yearRangeStart = `${earliestYear}-01-01`;

  let allEntries: Entry[] = [];
  let openDasGuide: { amount: number; dueDate: string } | null = null;
  let closedMonths = new Set<string>();
  let contracts: ContractRow[] = [];
  let recurringExpenses: RecurringExpenseRow[] = [];
  let distributions: DistributionRow[] = [];
  let notasPorMes = new Map<string, number>();
  let notasParaEmitirPorMes = new Map<string, number>();
  let customers: CustomerRow[] = [];
  let employmentEvents: EmploymentEventRow[] = [];
  let loadError = false;

  try {
    const ctx = await getTenantContext();
    const data = await withTenant(ctx.companyId, async (tx) => {
      const fe = await tx.execute(sql`
        SELECT fe.id, fe.amount, fe.type, fe.status, fe.reference_month, fe.due_date, fe.description,
               c.name AS category_name
        FROM financial_entry fe
        LEFT JOIN category c ON c.id = fe.category_id
        WHERE fe.company_id = ${ctx.companyId} AND fe.status != 'CANCELED' AND fe.reference_month >= ${yearRangeStart} AND fe.reference_month <= ${curMonth}
        ORDER BY fe.due_date ASC
      `);
      const dasGuide = await tx.execute(sql`
        SELECT amount, due_date FROM tax_guide
        WHERE company_id = ${ctx.companyId} AND tax_name = 'DAS - Simples Nacional' AND status = 'OPEN'
        ORDER BY due_date DESC
        LIMIT 1
      `);
      const closures = await tx.execute(sql`
        SELECT reference_month FROM monthly_closure
        WHERE company_id = ${ctx.companyId} AND reference_month IN ${monthKeys}
      `);
      const contractRows = await tx.execute(sql`
        SELECT id, type, title, party_name, value, status, start_date, end_date
        FROM business_contract
        WHERE company_id = ${ctx.companyId}
      `);
      const recurringRows = await tx.execute(sql`
        SELECT id, description, amount, due_day, category_name, active
        FROM recurring_expense
        WHERE company_id = ${ctx.companyId} AND active = true
      `);
      const distributionRows = await tx.execute(sql`
        SELECT amount, distributed_at
        FROM profit_distribution
        WHERE company_id = ${ctx.companyId} AND distributed_at >= ${monthKeys[0]}
      `);
      const invoiceCounts = await tx.execute(sql`
        SELECT reference_month, count(*)::int AS n
        FROM service_invoice
        WHERE company_id = ${ctx.companyId} AND status = 'ISSUED' AND reference_month IN ${monthKeys}
        GROUP BY reference_month
      `);
      const pendingInvoiceCounts = await tx.execute(sql`
        SELECT reference_month, count(*)::int AS n
        FROM service_invoice
        WHERE company_id = ${ctx.companyId} AND status IN ('DRAFT', 'ISSUING') AND reference_month IN ${monthKeys}
        GROUP BY reference_month
      `);
      const customerRows = await tx.execute(sql`
        SELECT id, created_at FROM customer
        WHERE company_id = ${ctx.companyId} AND created_at >= ${monthKeys[0]}
      `);
      const employmentEventRows = await tx.execute(sql`
        SELECT ee.type, ee.event_date, e.name AS employee_name
        FROM employment_event ee
        JOIN employee e ON e.id = ee.employee_id
        WHERE e.company_id = ${ctx.companyId} AND ee.event_date >= ${monthKeys[0]}
      `);
      return {
        entries: fe as unknown as Entry[],
        dasGuide: dasGuide[0] ? { amount: Number(dasGuide[0].amount), dueDate: String(dasGuide[0].due_date) } : null,
        closed: new Set(closures.map((c: any) => String(c.reference_month).slice(0, 10))),
        contracts: contractRows as unknown as ContractRow[],
        recurringExpenses: recurringRows as unknown as RecurringExpenseRow[],
        distributions: distributionRows as unknown as DistributionRow[],
        invoiceCounts: invoiceCounts as unknown as InvoiceCountRow[],
        pendingInvoiceCounts: pendingInvoiceCounts as unknown as InvoiceCountRow[],
        customers: customerRows as unknown as CustomerRow[],
        employmentEvents: employmentEventRows as unknown as EmploymentEventRow[],
      };
    });
    allEntries = data.entries;
    openDasGuide = data.dasGuide;
    closedMonths = data.closed;
    contracts = data.contracts;
    recurringExpenses = data.recurringExpenses;
    distributions = data.distributions;
    notasPorMes = new Map(data.invoiceCounts.map((r) => [String(r.reference_month).slice(0, 10), r.n]));
    notasParaEmitirPorMes = new Map(data.pendingInvoiceCounts.map((r) => [String(r.reference_month).slice(0, 10), r.n]));
    customers = data.customers;
    employmentEvents = data.employmentEvents;
  } catch (err) {
    console.error('[resumo-mes/page] falha ao carregar dados:', err);
    loadError = true;
  }

  const months: MonthSummary[] = monthDates.map((d, idx) => {
    const key = monthKeys[idx]!;
    const isCurrent = key === curMonth;
    const monthEntries = allEntries.filter((e) => e.reference_month === key && e.status !== 'CANCELED');
    const payables = monthEntries.filter((e) => e.type === 'PAYABLE');
    const receivables = monthEntries.filter((e) => e.type === 'RECEIVABLE');

    const compromissos: CompromissoRow[] = [
      ...(isCurrent && openDasGuide
        ? [
            {
              id: 'das-guide',
              titulo: 'Guia do Simples Nacional (DAS)',
              categoria: 'Impostos',
              tipo: 'PAYABLE' as const,
              valor: openDasGuide.amount,
              vencimento: openDasGuide.dueDate,
              status: openDasGuide.dueDate < todayIso ? 'OVERDUE' : 'PENDING',
              link: '/minha-contabilidade/guias',
            },
          ]
        : []),
      ...monthEntries.map((e) => ({
        id: e.id,
        titulo: e.description || (e.type === 'PAYABLE' ? 'Conta a Pagar' : 'Recebível'),
        categoria: e.category_name || (isImposto(e) ? 'Impostos' : 'Outros'),
        tipo: e.type,
        valor: Number(e.amount),
        vencimento: e.due_date,
        status: e.status,
        link: e.type === 'PAYABLE' ? '/meu-negocio/contas-a-pagar' : '/meu-negocio/contas-a-receber',
      })),
    ].sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    const monthStart = key;
    const monthEnd = monthEndOf(key);
    const contratosNoMes = contracts.filter(
      (c) => c.status === 'ATIVO' && c.start_date <= monthEnd && (!c.end_date || c.end_date >= monthStart)
    );
    const lucroDistribuido = distributions
      .filter((d) => d.distributed_at >= monthStart && d.distributed_at <= monthEnd)
      .reduce((s, d) => s + Number(d.amount), 0);
    const novosClientes = customers.filter(
      (c) => String(c.created_at).slice(0, 10) >= monthStart && String(c.created_at).slice(0, 10) <= monthEnd
    ).length;
    const eventosNoMes = employmentEvents.filter((e) => e.event_date >= monthStart && e.event_date <= monthEnd);
    const admissoes = eventosNoMes.filter((e) => e.type === 'ADMISSION').map((e) => e.employee_name);
    const desligamentos = eventosNoMes.filter((e) => e.type === 'TERMINATION').map((e) => e.employee_name);

    // Inadimplência
    const inadimplente = receivables.filter((e) => e.status !== 'PAID' && e.due_date < todayIso);
    const valorInadimplente = sum(inadimplente);
    const taxaInadimplencia = sum(receivables) > 0 ? valorInadimplente / sum(receivables) : 0;

    const lucroAno = lucroAcumuladoNoAno(allEntries, key, monthEnd);

    // === PANORAMA ORÇAMENTÁRIO (Início do Mês) ===
    // 1. Receita Base Contratada: contratos de clientes ativos
    const receitaContratos = contratosNoMes
      .filter((c) => c.type === 'ENTRADA')
      .reduce((s, c) => s + Number(c.value), 0);
    const receitaBaseContratada = receitaContratos > 0 ? receitaContratos : sum(receivables);

    // 2. Custos Fixos Comprometidos (despesas fixas cadastradas + pró-labore)
    const custoFixoRecorrente = recurringExpenses.reduce((s, r) => s + Number(r.amount), 0);
    const proLaboreEntry = payables.find((p) => String(p.description || '').toLowerCase().includes('pró-labore') || String(p.description || '').toLowerCase().includes('pro-labore'));
    const custoFixoComprometido = custoFixoRecorrente + (proLaboreEntry ? Number(proLaboreEntry.amount) : 0);

    // 3. 4 Semanas do Mês
    const weekRanges = [
      { num: 1, label: 'Semana 1', startDay: 1, endDay: 7, desc: '01 a 07 de ' + d.toLocaleDateString('pt-BR', { month: 'short' }) },
      { num: 2, label: 'Semana 2', startDay: 8, endDay: 14, desc: '08 a 14 de ' + d.toLocaleDateString('pt-BR', { month: 'short' }) },
      { num: 3, label: 'Semana 3', startDay: 15, endDay: 21, desc: '15 a 21 de ' + d.toLocaleDateString('pt-BR', { month: 'short' }) },
      { num: 4, label: 'Semana 4', startDay: 22, endDay: 31, desc: '22 a 31 de ' + d.toLocaleDateString('pt-BR', { month: 'short' }) },
    ];

    const semanas: WeekFlow[] = weekRanges.map((w) => {
      const weekReceivables = receivables.filter((r) => {
        const day = Number(r.due_date.slice(8, 10));
        return day >= w.startDay && day <= w.endDay;
      });
      const weekPayables = payables.filter((p) => {
        const day = Number(p.due_date.slice(8, 10));
        return day >= w.startDay && day <= w.endDay;
      });

      const inflow = sum(weekReceivables);
      const outflow = sum(weekPayables);

      // Highlights
      const topIn = weekReceivables.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 2).map((r) => r.description || 'Recebível');
      const topOut = weekPayables.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 2).map((p) => p.description || 'Despesa');
      const keyHighlights = [...topIn, ...topOut].slice(0, 3);

      const currentDay = now.getDate();
      let status: 'past' | 'current' | 'future' = 'future';
      if (isCurrent) {
        if (currentDay > w.endDay) status = 'past';
        else if (currentDay >= w.startDay && currentDay <= w.endDay) status = 'current';
        else status = 'future';
      } else {
        status = 'past';
      }

      return {
        weekNum: w.num,
        label: w.label,
        dateRange: w.desc,
        inflow,
        outflow,
        net: inflow - outflow,
        status,
        keyHighlights,
      };
    });

    // 4. Break-Even (Ponto de Equilíbrio)
    // Calcula em que dia do mês as entradas acumuladas cobrem 100% dos custos fixos
    let breakEvenDay: number | null = null;
    let acumuladoEntradas = 0;
    const targetBreakeven = custoFixoComprometido > 0 ? custoFixoComprometido : sum(payables);

    const sortedReceivables = [...receivables].sort((a, b) => a.due_date.localeCompare(b.due_date));
    for (const r of sortedReceivables) {
      acumuladoEntradas += Number(r.amount);
      if (acumuladoEntradas >= targetBreakeven && breakEvenDay === null) {
        breakEvenDay = Number(r.due_date.slice(8, 10));
        break;
      }
    }

    const totalFaturamento = sum(receivables);
    const totalDespesas = sum(payables);
    const totalImpostos = sum(payables.filter(isImposto));
    const sobraPrevista = Math.max(0, totalFaturamento - totalDespesas - totalImpostos);

    // === DRE SINTÉTICO (Fechamento) ===
    const dre = {
      faturamentoBruto: totalFaturamento,
      impostosSimples: totalImpostos > 0 ? totalImpostos : totalFaturamento * 0.06,
      faturamentoLiquido: totalFaturamento - (totalImpostos > 0 ? totalImpostos : totalFaturamento * 0.06),
      custosFixos: custoFixoComprometido > 0 ? custoFixoComprometido : totalDespesas * 0.7,
      custosVariaveis: Math.max(0, totalDespesas - (custoFixoComprometido > 0 ? custoFixoComprometido : totalDespesas * 0.7)),
      lucroOperacional: totalFaturamento - totalDespesas,
      distribuicaoLucro: lucroDistribuido,
      saldoFinalRetido: Math.max(0, totalFaturamento - totalDespesas - lucroDistribuido),
    };

    return {
      key,
      label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      shortLabel: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
      isCurrent,
      closed: closedMonths.has(key),
      faturamento: totalFaturamento,
      faturamentoRecebido: sum(receivables.filter((r) => r.status === 'PAID')),
      faturamentoPendente: sum(receivables.filter(emAberto)),
      despesas: totalDespesas,
      despesasPagas: sum(payables.filter((p) => p.status === 'PAID')),
      despesasPendentes: sum(payables.filter(emAberto)),
      lucro: totalFaturamento - totalDespesas,
      impostos: totalImpostos,
      impostosAberto: sum(payables.filter((e) => isImposto(e) && emAberto(e))),
      pagarTotal: totalDespesas,
      pagarAberto: sum(payables.filter(emAberto)),
      receberTotal: totalFaturamento,
      receberAberto: sum(receivables.filter(emAberto)),
      receitaBaseContratada,
      custoFixoComprometido,
      breakEvenDay,
      sobraPrevista,
      semanas,
      dre,
      categoriasReceber: groupByCategory(receivables),
      categoriasPagar: groupByCategory(payables),
      compromissos,
      contratosAtivos: contratosNoMes.map((c) => ({
        id: c.id,
        nome: c.party_name || c.title,
        tipo: c.type,
        valor: Number(c.value),
      })),
      lucroDistribuido,
      notasEmitidas: notasPorMes.get(key) ?? 0,
      notasParaEmitir: notasParaEmitirPorMes.get(key) ?? 0,
      novosClientes,
      admissoes,
      desligamentos,
      valorInadimplente,
      taxaInadimplencia,
      lucroAcumuladoNoAno: lucroAno,
    };
  });

  return <ResumoMesView months={months} loadError={loadError} />;
}
