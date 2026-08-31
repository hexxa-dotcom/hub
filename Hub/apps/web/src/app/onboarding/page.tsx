import { redirect } from 'next/navigation';
import { getDb, company, eq, withDbTimeout } from '@hexxa/db';
import { getTenantContext, NoActiveOrganizationError, NoActiveCompanySelectedError } from '@/lib/server/tenant';
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
    if (err instanceof NoActiveCompanySelectedError) redirect('/auth/empresa' as never);
    if (!(err instanceof NoActiveOrganizationError)) throw err;
    // Sem nenhuma empresa vinculada ainda: pede o CNPJ direto, sem widget de terceiro.
    return (
      <div className="relative flex min-h-screen items-center justify-center hero-blue p-4">
        <OnboardingForm companyName="sua empresa" />
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

  // 'PENDENTE-' só existe em empresas legadas da era Clerk que ainda não
  // tiveram o CNPJ real preenchido — fluxo novo nunca cria esse placeholder.
  if (row && !row.cnpj.startsWith('PENDENTE-')) {
    redirect('/cliente');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center hero-blue p-4">
      <OnboardingForm companyName={row?.name ?? 'sua empresa'} existingCompanyId={row ? ctx.companyId : undefined} />
    </div>
  );
}
