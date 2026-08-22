import { getDb, eq } from '@hexxa/db';
import { company, subscription, membership, appUser } from '@hexxa/db/schema';
import { ComunicacoesForm, type ClienteContato } from './ComunicacoesForm';

export const dynamic = 'force-dynamic';

async function getClientes(): Promise<ClienteContato[]> {
  const db = getDb();

  const [subs, owners] = await Promise.all([
    db
      .select({ companyId: company.id, nome: company.legalName, status: subscription.status })
      .from(subscription)
      .innerJoin(company, eq(subscription.companyId, company.id)),
    db
      .select({ companyId: membership.companyId, email: appUser.email })
      .from(membership)
      .innerJoin(appUser, eq(membership.userId, appUser.id))
      .where(eq(membership.role, 'OWNER')),
  ]);

  const emailByCompany = new Map(owners.map((o) => [o.companyId, o.email]));

  const out: ClienteContato[] = [];
  for (const s of subs) {
    const email = emailByCompany.get(s.companyId);
    if (email) out.push({ id: s.companyId, nome: s.nome, status: s.status, email });
  }
  return out;
}

export default async function AdminComunicacoes() {
  const clientes = await getClientes();
  return <ComunicacoesForm clientes={clientes} />;
}
