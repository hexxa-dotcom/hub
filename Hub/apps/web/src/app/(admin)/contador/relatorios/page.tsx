import { getDb, eq, sql, withDbTimeout } from '@hexxa/db';
import { company, subscription, plan, accountingInvoice } from '@hexxa/db/schema';
import { RelatoriosView, type MonthPoint, type PlanoReceita } from './RelatoriosView';

export const dynamic = 'force-dynamic';

async function getDados() {
  const db = getDb();

  const [plans, subs, invoiceRows, newCompanyRows] = await withDbTimeout(
    Promise.all([
      db.select().from(plan),
      db.select({ planId: subscription.planId, status: subscription.status }).from(subscription),
      db.execute(sql`
        SELECT reference_month, SUM(value) FILTER (WHERE status = 'PAID') AS paid, SUM(value) AS total
        FROM accounting_invoice
        GROUP BY reference_month
        ORDER BY reference_month DESC
        LIMIT 12
      `),
      db.execute(sql`
        SELECT date_trunc('month', created_at)::date AS month, count(*)::int AS n
        FROM company
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      `),
    ]),
    8000,
  );

  const clientesPorPlano = new Map<string, number>();
  for (const s of subs) {
    if (s.status !== 'ACTIVE') continue;
    clientesPorPlano.set(s.planId, (clientesPorPlano.get(s.planId) ?? 0) + 1);
  }
  const planos: PlanoReceita[] = plans.map((p) => ({
    nome: p.name,
    clientes: clientesPorPlano.get(p.id) ?? 0,
    valor: Number(p.monthlyValue),
  }));
  const mrrAtual = planos.reduce((s, p) => s + p.clientes * p.valor, 0);
  const totalClientesAtivos = planos.reduce((s, p) => s + p.clientes, 0);

  const novosPorMes = new Map<string, number>();
  for (const row of newCompanyRows) {
    novosPorMes.set(String(row.month).slice(0, 7), Number(row.n));
  }

  const faturamento: MonthPoint[] = invoiceRows
    .map((r) => ({
      mes: String(r.reference_month).slice(0, 7),
      pago: Number(r.paid ?? 0),
      total: Number(r.total ?? 0),
      novos: novosPorMes.get(String(r.reference_month).slice(0, 7)) ?? 0,
    }))
    .reverse();

  return { planos, mrrAtual, totalClientesAtivos, faturamento };
}

const EMPTY_DADOS: { planos: PlanoReceita[]; mrrAtual: number; totalClientesAtivos: number; faturamento: MonthPoint[] } = {
  planos: [],
  mrrAtual: 0,
  totalClientesAtivos: 0,
  faturamento: [],
};

export default async function AdminRelatorios() {
  let dados = EMPTY_DADOS;
  try {
    dados = await getDados();
  } catch (err) {
    console.error('[AdminRelatorios] falha ao carregar relatórios:', err);
  }
  return <RelatoriosView {...dados} />;
}
