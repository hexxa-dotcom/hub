export const dynamic = 'force-dynamic';
import { getDb, eq, withDbTimeout } from '@hexxa/db';
import { company, appUser, membership, subscription, plan, ticket } from '@hexxa/db/schema';
import { ClientesTable, type Cliente } from './ClientesTable';

async function getClientes(): Promise<Cliente[]> {
  const db = getDb();

  const [subs, owners, ticketCounts] = await withDbTimeout(Promise.all([
    db
      .select({
        subscriptionId: subscription.id,
        companyId: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        cnpj: company.cnpj,
        taxRegime: company.taxRegime,
        city: company.city,
        state: company.state,
        createdAt: company.createdAt,
        status: subscription.status,
        planName: plan.name,
        monthlyValue: plan.monthlyValue,
        asaasCustomerId: subscription.asaasCustomerId,
        asaasSubscriptionId: subscription.asaasSubscriptionId,
      })
      .from(subscription)
      .innerJoin(company, eq(subscription.companyId, company.id))
      .innerJoin(plan, eq(subscription.planId, plan.id)),
    db
      .select({ companyId: membership.companyId, name: appUser.name, email: appUser.email })
      .from(membership)
      .innerJoin(appUser, eq(membership.userId, appUser.id))
      .where(eq(membership.role, 'OWNER')),
    db
      .select({ companyId: ticket.companyId, id: ticket.id })
      .from(ticket)
      .where(eq(ticket.status, 'OPEN')),
  ]), 8000);

  const ownerByCompany = new Map(owners.map(o => [o.companyId, o]));
  const pendByCompany = new Map<string, number>();
  for (const t of ticketCounts) pendByCompany.set(t.companyId, (pendByCompany.get(t.companyId) ?? 0) + 1);

  return subs.map(s => {
    const owner = ownerByCompany.get(s.companyId);
    return {
      id: s.subscriptionId,
      companyId: s.companyId,
      razao: s.legalName,
      fantasia: s.tradeName || s.legalName,
      cnpj: s.cnpj,
      email: owner?.email ?? '—',
      telefone: '—',
      plano: s.planName,
      status: s.status,
      mrr: s.status === 'ACTIVE' ? Number(s.monthlyValue) : 0,
      desde: s.createdAt.toISOString().slice(0, 10),
      responsavel: owner?.name ?? '—',
      regime: s.taxRegime,
      municipio: s.city && s.state ? `${s.city}/${s.state}` : '—',
      pendencias: pendByCompany.get(s.companyId) ?? 0,
      asaasCustomerId: s.asaasCustomerId ?? undefined,
      asaasSubscriptionId: s.asaasSubscriptionId ?? undefined,
    };
  });
}

async function getPlanNames(): Promise<string[]> {
  const db = getDb();
  const rows = await withDbTimeout(db.select({ name: plan.name }).from(plan), 8000);
  return rows.map(r => r.name);
}

export default async function AdminClientesPage() {
  let clientes: Cliente[] = [];
  let planos: string[] = [];
  try {
    [clientes, planos] = await Promise.all([getClientes(), getPlanNames()]);
  } catch (err) {
    console.error('[AdminClientesPage] falha ao carregar clientes:', err);
  }
  return <ClientesTable initial={clientes} planos={planos} />;
}
