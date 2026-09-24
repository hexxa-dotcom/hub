import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { CadastroEmValidacao } from './CadastroEmValidacao';
import { NAV } from '@/lib/nav';
import { getTenantContext, NoActiveOrganizationError, NoActiveCompanySelectedError } from '@/lib/server/tenant';
import { company, appUser, membership, partner, getDb, withTenant, eq } from '@hexxa/db';

// Toda página sob o portal depende da sessão/tenant em tempo real — nunca
// pode ser pré-renderada estaticamente no build (o build não tem sessão do
// login nem conexão de banco garantida, e tentar gera timeout no build).
export const dynamic = 'force-dynamic';

/** Shell do portal: menu único e completo (sem distinção de tipo de empresa). */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (err) {
    if (err instanceof NoActiveOrganizationError) redirect('/onboarding');
    if (err instanceof NoActiveCompanySelectedError) redirect('/auth/empresa' as never);
    throw err;
  }
  const [dbCompany] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(company).where(eq(company.id, ctx.companyId));
  });

  // Empresa recém-criada pela organização (sem CNPJ) → completa o onboarding primeiro.
  if (dbCompany?.cnpj?.startsWith('PENDENTE-')) {
    redirect('/onboarding');
  }

  // ctx.userId é 'dev-skip-auth'/'cron'/'mcp' fora do fluxo normal — não é
  // uuid de appUser, então nem tenta a query nesses casos.
  const isRealUser = /^[0-9a-f-]{36}$/i.test(ctx.userId);
  let userRow: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    phone: string | null;
    cpf: string | null;
  } | undefined;
  let memberships: { id: string; companyId: string; authorized: boolean; role: string }[] = [];
  const db = getDb();

  if (isRealUser) {
    [userRow] = await db
      .select({
        id: appUser.id,
        name: appUser.name,
        email: appUser.email,
        avatarUrl: appUser.avatarUrl,
        phone: appUser.phone,
        cpf: appUser.cpf,
      })
      .from(appUser)
      .where(eq(appUser.id, ctx.userId));

    memberships = await db
      .select({
        id: membership.id,
        companyId: membership.companyId,
        authorized: membership.authorized,
        role: membership.role,
      })
      .from(membership)
      .where(eq(membership.userId, ctx.userId));
  } else {
    // Em ambiente local / dev-skip-auth: busca o primeiro membro associado à empresa
    const [firstMember] = await db
      .select({
        id: membership.id,
        userId: membership.userId,
        role: membership.role,
        authorized: membership.authorized,
      })
      .from(membership)
      .where(eq(membership.companyId, ctx.companyId))
      .limit(1);

    if (firstMember?.userId) {
      const [dbUser] = await db
        .select({
          id: appUser.id,
          name: appUser.name,
          email: appUser.email,
          avatarUrl: appUser.avatarUrl,
          phone: appUser.phone,
          cpf: appUser.cpf,
        })
        .from(appUser)
        .where(eq(appUser.id, firstMember.userId));

      if (dbUser) {
        userRow = dbUser;
        memberships = [
          {
            id: firstMember.id,
            companyId: ctx.companyId,
            authorized: firstMember.authorized,
            role: firstMember.role,
          },
        ];
      }
    }
  }

  /**
   * Cadastro ainda não aprovado pelo escritório: só a tela de validação.
   *
   * O contador revisa, aprova, e a aprovação cria a empresa no OneFlow —
   * onde as regras tributárias são definidas. Antes disso a Hexx não tem
   * regime nem contabilidade do outro lado, e qualquer número de imposto
   * que mostrasse seria palpite.
   */
  const vinculo = memberships.find((m) => m.companyId === ctx.companyId);
  if (vinculo && !vinculo.authorized) {
    return <CadastroEmValidacao empresa={dbCompany?.legalName ?? ''} nome={userRow?.name} />;
  }

  let isPartner = false;
  if (userRow?.id) {
    const [partnerRow] = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({ id: partner.id })
        .from(partner)
        .where(eq(partner.userId, userRow!.id))
        .limit(1);
    });
    isPartner = !!partnerRow;
  }

  const currentUser = userRow
    ? {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        avatarUrl: userRow.avatarUrl,
        role: vinculo?.role ?? 'VIEWER',
        isPartner,
        phone: userRow.phone,
        cpf: userRow.cpf,
        authorized: vinculo?.authorized ?? true,
      }
    : null;

  return (
    <AppShell
      sections={NAV}
      company={dbCompany}
      user={currentUser}
      userName={userRow?.name}
      userEmail={userRow?.email}
      hasMultipleCompanies={memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
