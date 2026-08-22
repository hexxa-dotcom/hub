import { getDb, desc, eq } from '@hexxa/db';
import { monthlyClosure, company } from '@hexxa/db/schema';
import { FechamentosList, type ClosureRow } from './FechamentosList';

export const dynamic = 'force-dynamic';

export default async function AdminFechamentosPage() {
  const db = getDb();

  let closures: {
    id: string;
    companyId: string;
    referenceMonth: string;
    totalRevenue: string;
    totalExpenses: string;
    defaultsCount: number;
    status: string;
    companyName: string | null;
  }[] = [];
  try {
    closures = await db
      .select({
        id: monthlyClosure.id,
        companyId: monthlyClosure.companyId,
        referenceMonth: monthlyClosure.referenceMonth,
        totalRevenue: monthlyClosure.totalRevenue,
        totalExpenses: monthlyClosure.totalExpenses,
        defaultsCount: monthlyClosure.defaultsCount,
        status: monthlyClosure.status,
        companyName: company.legalName,
      })
      .from(monthlyClosure)
      .leftJoin(company, eq(monthlyClosure.companyId, company.id))
      .orderBy(desc(monthlyClosure.referenceMonth), desc(monthlyClosure.createdAt));
  } catch (error) {
    console.error(error);
  }

  const byMonth = new Map<string, ClosureRow[]>();
  for (const c of closures) {
    if (!c.referenceMonth) continue;
    const list = byMonth.get(c.referenceMonth) ?? [];
    list.push({
      id: c.id,
      companyId: c.companyId,
      companyName: c.companyName ?? '',
      totalRevenue: c.totalRevenue,
      totalExpenses: c.totalExpenses,
      defaultsCount: c.defaultsCount,
      status: c.status,
    });
    byMonth.set(c.referenceMonth, list);
  }

  return <FechamentosList byMonth={[...byMonth.entries()]} />;
}
