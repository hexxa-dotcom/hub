export const dynamic = 'force-dynamic';
import { getDb, eq, withDbTimeout } from '@hexxa/db';
import { company, appUser, membership, subscription, plan, ticket } from '@hexxa/db/schema';
import { valorDosHonorarios } from '@hexxa/core';
import { ClientesTable, type Cliente } from './ClientesTable';

/**
 * A lista parte de COMPANY, não de subscription.
 *
 * Antes era um INNER JOIN em `subscription`, o que fazia a empresa sem plano
 * contratado simplesmente não existir nesta tela. Com nenhuma assinatura
 * cadastrada, a lista ficava vazia — e a empresa recém-trazida do OneFlow
 * desaparecia logo depois de ser criada, sem erro nenhum para explicar.
 *
 * Cliente é quem o escritório atende. O plano da plataforma é um atributo
 * dele, e um que costuma chegar depois do primeiro mês de serviço.
 */
async function getClientes(): Promise<Cliente[]> {
  const db = getDb();

  const [empresas, owners, acessos, ticketCounts] = await withDbTimeout(Promise.all([
    db
      .select({
        companyId: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        cnpj: company.cnpj,
        taxRegime: company.taxRegime,
        city: company.city,
        state: company.state,
        createdAt: company.createdAt,
        closedAt: company.closedAt,
        subscriptionId: subscription.id,
        status: subscription.status,
        planName: plan.name,
        monthlyValue: plan.monthlyValue,
        discountValue: subscription.discountValue,
        customValue: subscription.customValue,
        asaasCustomerId: subscription.asaasCustomerId,
        asaasSubscriptionId: subscription.asaasSubscriptionId,
      })
      .from(company)
      .leftJoin(subscription, eq(subscription.companyId, company.id))
      .leftJoin(plan, eq(subscription.planId, plan.id)),
    db
      .select({ companyId: membership.companyId, name: appUser.name, email: appUser.email })
      .from(membership)
      .innerJoin(appUser, eq(membership.userId, appUser.id))
      .where(eq(membership.role, 'OWNER')),
    db.select({ companyId: membership.companyId }).from(membership),
    db
      .select({ companyId: ticket.companyId, id: ticket.id })
      .from(ticket)
      .where(eq(ticket.status, 'OPEN')),
  ]), 8000);

  const ownerByCompany = new Map(owners.map(o => [o.companyId, o]));
  const acessosPorEmpresa = new Map<string, number>();
  for (const a of acessos) acessosPorEmpresa.set(a.companyId, (acessosPorEmpresa.get(a.companyId) ?? 0) + 1);
  const pendByCompany = new Map<string, number>();
  for (const t of ticketCounts) pendByCompany.set(t.companyId, (pendByCompany.get(t.companyId) ?? 0) + 1);

  return empresas.map(s => {
    const owner = ownerByCompany.get(s.companyId);
    return {
      // Sem assinatura não há subscription.id; o id da empresa serve de chave
      // e é o que as ações da tabela realmente usam.
      id: s.subscriptionId ?? s.companyId,
      companyId: s.companyId,
      razao: s.legalName,
      fantasia: s.tradeName || s.legalName,
      cnpj: s.cnpj,
      email: owner?.email ?? '—',
      telefone: '—',
      plano: s.planName ?? '—',
      // Encerrado vale mais que o status da assinatura: a empresa saiu.
      status: s.closedAt ? 'ENCERRADO' : (s.status ?? 'SEM_PLANO'),
      // Receita real: o que de fato vai na fatura deste cliente.
      mrr:
        s.status === 'ACTIVE'
          ? valorDosHonorarios({
              valorDoPlano: Number(s.monthlyValue),
              desconto: s.discountValue,
              valorCombinado: s.customValue,
            })
          : 0,
      desde: s.createdAt.toISOString().slice(0, 10),
      responsavel: owner?.name ?? '—',
      regime: s.taxRegime,
      municipio: s.city && s.state ? `${s.city}/${s.state}` : '—',
      pendencias: pendByCompany.get(s.companyId) ?? 0,
      semAcesso: !s.closedAt && (acessosPorEmpresa.get(s.companyId) ?? 0) === 0,
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
