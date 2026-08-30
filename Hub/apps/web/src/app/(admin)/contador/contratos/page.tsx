export const dynamic = 'force-dynamic';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { company, appUser, membership, plan, accountingContract } from '@hexxa/db/schema';
import { eq, desc } from 'drizzle-orm';
import AdminContratos, { type ClienteOpcao, type PlanoOpcao, type ContratoGerado } from './ContratosGerador';

async function getClientes(): Promise<ClienteOpcao[]> {
  const db = getDb();
  const [companies, owners] = await withDbTimeout(
    Promise.all([
      db.select().from(company),
      db
        .select({ companyId: membership.companyId, name: appUser.name, email: appUser.email })
        .from(membership)
        .innerJoin(appUser, eq(membership.userId, appUser.id))
        .where(eq(membership.role, 'OWNER')),
    ]),
    8000,
  );
  const ownerByCompany = new Map(owners.map(o => [o.companyId, o]));

  return companies.map(c => {
    const owner = ownerByCompany.get(c.id);
    return {
      id: c.id,
      razao: c.legalName,
      cnpj: c.cnpj,
      responsavel: owner?.name ?? '—',
      email: owner?.email ?? '—',
      municipio: c.city ?? '—',
      uf: c.state ?? '—',
    };
  });
}

async function getPlanos(): Promise<PlanoOpcao[]> {
  const db = getDb();
  const rows = await withDbTimeout(db.select({ nome: plan.name, valor: plan.monthlyValue }).from(plan), 8000);
  return rows.map(r => ({ nome: r.nome, valor: Number(r.valor) }));
}

async function getHistorico(): Promise<ContratoGerado[]> {
  try {
    const db = getDb();
    const rows = await withDbTimeout(
      db
        .select({
          id: accountingContract.id,
          companyId: accountingContract.companyId,
          cliente: company.legalName,
          plano: accountingContract.plano,
          valor: accountingContract.valor,
          inicio: accountingContract.inicio,
          status: accountingContract.status,
          createdAt: accountingContract.createdAt,
        })
        .from(accountingContract)
        .innerJoin(company, eq(accountingContract.companyId, company.id))
        .orderBy(desc(accountingContract.createdAt))
        .limit(50),
      8000,
    );

    return rows.map((r) => ({
      id: r.id,
      cliente: r.cliente,
      plano: r.plano,
      valor: Number(r.valor),
      inicio: r.inicio,
      geradoEm: r.createdAt.toLocaleString('pt-BR'),
      status: r.status as 'ativo' | 'cancelado',
    }));
  } catch (error) {
    // Tabela `accounting_contract` só existe depois que a migration
    // 0012_accounting_contract.sql rodar no banco — até lá, degrada pra
    // histórico vazio em vez de quebrar a página.
    console.error('Erro ao ler accounting_contract (migration 0012 ainda não aplicada?):', error);
    return [];
  }
}

export default async function AdminContratosPage() {
  let clientes: ClienteOpcao[] = [];
  let planos: PlanoOpcao[] = [];
  let historico: ContratoGerado[] = [];
  try {
    [clientes, planos, historico] = await Promise.all([getClientes(), getPlanos(), getHistorico()]);
  } catch (err) {
    console.error('[AdminContratosPage] falha ao carregar dados:', err);
  }
  return <AdminContratos clientes={clientes} planos={planos} historicoInicial={historico} />;
}
