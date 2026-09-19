import { getDb, desc, eq, withDbTimeout } from '@hexxa/db';
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
    stage: string;
    companyName: string | null;
  }[] = [];
  try {
    closures = await withDbTimeout(
      db
        .select({
          id: monthlyClosure.id,
          companyId: monthlyClosure.companyId,
          referenceMonth: monthlyClosure.referenceMonth,
          totalRevenue: monthlyClosure.totalRevenue,
          totalExpenses: monthlyClosure.totalExpenses,
          defaultsCount: monthlyClosure.defaultsCount,
          // `stage`, não `status`.
          //
          // `status` é a coluna legada, que colapsava "a IA apurou" e "o
          // contador liberou" num campo só. O cron antigo gravava CLOSED nela
          // sem conferir nada, e esta tela mostrava cinco meses como prontos
          // enquanto o `stage` deles dizia ABERTO — que é o que o caminho de
          // fechamento de verdade lê.
          stage: monthlyClosure.stage,
          companyName: company.legalName,
        })
        .from(monthlyClosure)
        .leftJoin(company, eq(monthlyClosure.companyId, company.id))
        .orderBy(desc(monthlyClosure.referenceMonth), desc(monthlyClosure.createdAt)),
      8000,
    );
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
      stage: c.stage,
    });
    byMonth.set(c.referenceMonth, list);
  }

  return <FechamentosList byMonth={[...byMonth.entries()]} />;
}
