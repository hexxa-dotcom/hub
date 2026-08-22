import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { NAV } from '@/lib/nav';
import { getTenantContext, NoActiveOrganizationError } from '@/lib/server/tenant';
import { company, withTenant, eq } from '@hexxa/db';

/** Shell do portal: menu único e completo (sem distinção de tipo de empresa). */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (err) {
    if (err instanceof NoActiveOrganizationError) redirect('/onboarding');
    throw err;
  }
  const [dbCompany] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(company).where(eq(company.id, ctx.companyId));
  });

  // Empresa recém-criada pela organização (sem CNPJ) → completa o onboarding primeiro.
  if (dbCompany?.cnpj?.startsWith('PENDENTE-')) {
    redirect('/onboarding');
  }

  return <AppShell sections={NAV} company={dbCompany}>{children}</AppShell>;
}
