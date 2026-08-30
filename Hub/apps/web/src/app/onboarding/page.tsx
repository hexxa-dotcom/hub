import { redirect } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { getDb, company, eq, withDbTimeout } from '@hexxa/db';
import { getTenantContext, NoActiveOrganizationError } from '@/lib/server/tenant';
import { OnboardingForm } from './OnboardingForm';

export const dynamic = 'force-dynamic';

/**
 * Onboarding da empresa: pede só o CNPJ e alimenta todo o sistema
 * (cadastro da empresa + base fiscal) com os dados da Receita.
 * Se a empresa ativa já tem CNPJ real, volta pra área do cliente.
 */
export default async function OnboardingPage() {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (err) {
    if (!(err instanceof NoActiveOrganizationError)) throw err;
    // Sem organização ativa ainda: pede para criar/selecionar uma antes de
    // tocar no banco (nunca cai num tenant compartilhado).
    return (
      <div className="relative flex min-h-screen items-center justify-center hero-blue p-4">
        <div className="absolute right-4 top-4">
          <UserButton />
        </div>
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/10 p-8 text-center border border-white/10">
          <p className="text-white">Crie ou selecione uma empresa para continuar.</p>
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/onboarding" afterCreateOrganizationUrl="/onboarding" />
        </div>
      </div>
    );
  }
  const db = getDb();
  let row: { cnpj: string; name: string } | undefined;
  try {
    [row] = await withDbTimeout(
      db
        .select({ cnpj: company.cnpj, name: company.legalName })
        .from(company)
        .where(eq(company.id, ctx.companyId)),
      8000,
    );
  } catch (err) {
    console.error('[OnboardingPage] falha ao carregar empresa:', err);
  }

  if (row && !row.cnpj.startsWith('PENDENTE-')) {
    redirect('/cliente');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center hero-blue p-4">
      {/* Trocar de organização ou sair sem ficar preso no onboarding */}
      <div className="absolute right-4 top-4 flex items-center gap-3 rounded-full bg-white/10 px-3 py-1.5 border border-white/10">
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/cliente" />
        <UserButton />
      </div>
      <OnboardingForm companyName={row?.name ?? 'sua empresa'} />
    </div>
  );
}
