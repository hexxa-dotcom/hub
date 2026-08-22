import { getDb, eq } from '@hexxa/db';
import { or } from 'drizzle-orm';
import { company, subscription, plan, membership, appUser } from '@hexxa/db/schema';
import { RenovacoesList, type RiscoItem } from './RenovacoesList';

export const dynamic = 'force-dynamic';

async function getRiscos(): Promise<RiscoItem[]> {
  const db = getDb();

  const [rows, owners] = await Promise.all([
    db
      .select({
        subscriptionId: subscription.id,
        companyId: company.id,
        nome: company.legalName,
        planoNome: plan.name,
        valor: plan.monthlyValue,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        asaasCustomerId: subscription.asaasCustomerId,
      })
      .from(subscription)
      .innerJoin(company, eq(subscription.companyId, company.id))
      .innerJoin(plan, eq(subscription.planId, plan.id))
      .where(or(eq(subscription.status, 'TRIAL'), eq(subscription.status, 'PAST_DUE'))),
    db
      .select({ companyId: membership.companyId, email: appUser.email })
      .from(membership)
      .innerJoin(appUser, eq(membership.userId, appUser.id))
      .where(eq(membership.role, 'OWNER')),
  ]);

  const emailByCompany = new Map(owners.map((o) => [o.companyId, o.email]));
  const today = new Date();

  return rows.map((r) => {
    let diasRestantes: number | undefined;
    let diasAtraso: number | undefined;
    if (r.currentPeriodEnd) {
      const end = new Date(`${r.currentPeriodEnd}T00:00:00`);
      const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000);
      if (r.status === 'TRIAL') diasRestantes = diff;
      else diasAtraso = Math.max(0, -diff);
    }
    return {
      id: r.subscriptionId,
      companyId: r.companyId,
      nome: r.nome,
      email: emailByCompany.get(r.companyId) ?? '—',
      plano: r.planoNome,
      valor: Number(r.valor),
      tipo: r.status === 'TRIAL' ? ('trial' as const) : ('inadimplente' as const),
      diasRestantes,
      diasAtraso,
      asaasCustomerId: r.asaasCustomerId ?? undefined,
    };
  });
}

export default async function AdminRenovacoes() {
  const items = await getRiscos();
  return <RenovacoesList initial={items} />;
}
