import { redirect } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { getDb, company, eq } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { OnboardingForm } from './OnboardingForm';

export const dynamic = 'force-dynamic';

/**
 * Onboarding da empresa: pede só o CNPJ e alimenta todo o sistema
 * (cadastro da empresa + base fiscal) com os dados da Receita.
 * Se a empresa ativa já tem CNPJ real, volta ao dashboard.
 */
export default async function OnboardingPage() {
  const ctx = await getTenantContext();
  const db = getDb();
  const [row] = await db
    .select({ cnpj: company.cnpj, name: company.legalName })
    .from(company)
    .where(eq(company.id, ctx.companyId));

  if (row && !row.cnpj.startsWith('PENDENTE-')) {
    redirect('/dashboard');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center hero-blue p-4">
      {/* Trocar de organização ou sair sem ficar preso no onboarding */}
      <div className="absolute right-4 top-4 flex items-center gap-3 rounded-full bg-white/10 px-3 py-1.5 border border-white/10">
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/dashboard" />
        <UserButton />
      </div>
      <OnboardingForm companyName={row?.name ?? 'sua empresa'} />
    </div>
  );
}
