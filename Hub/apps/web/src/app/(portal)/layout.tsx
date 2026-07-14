import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { NAV } from '@/lib/nav';
import { getTenantContext } from '@/lib/server/tenant';
import { company, getDb, eq } from '@hexxa/db';

/** Shell do portal: menu único e completo (sem distinção de tipo de empresa). */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  const db = getDb();
  const [dbCompany] = await db.select().from(company).where(eq(company.id, ctx.companyId));

  // Empresa recém-criada pela organização (sem CNPJ) → completa o onboarding primeiro.
  if (dbCompany?.cnpj?.startsWith('PENDENTE-')) {
    redirect('/onboarding');
  }

  return <AppShell sections={NAV} company={dbCompany}>{children}</AppShell>;
}
