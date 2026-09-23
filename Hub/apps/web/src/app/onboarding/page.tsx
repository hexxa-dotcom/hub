import { redirect } from 'next/navigation';
import { getDb, company, eq, withDbTimeout } from '@hexxa/db';
import { getTenantContext, modoSemLogin, NoActiveOrganizationError, NoActiveCompanySelectedError } from '@/lib/server/tenant';
import { OnboardingForm } from './OnboardingForm';
import { PassosDoOnboarding } from './PassosDoOnboarding';

/** No passo 1 ainda não há empresa de onde medir o progresso: tudo começa aberto. */
const PASSOS_DO_INICIO = [
  { id: 'empresa' as const, href: '/onboarding', estado: 'PENDENTE' as const },
  { id: 'fiscal' as const, href: '/onboarding/fiscal', estado: 'PENDENTE' as const },
  { id: 'ponto-de-partida' as const, href: '/onboarding/ponto-de-partida', estado: 'PENDENTE' as const },
];

export const dynamic = 'force-dynamic';

/**
 * Onboarding da empresa: pede só o CNPJ e alimenta todo o sistema
 * (cadastro da empresa + base fiscal) com os dados da Receita.
 * Se a empresa ativa já tem CNPJ real, volta pra área do cliente.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>;
}) {
  // Sem login, "Cadastrar nova empresa" (em /auth/empresa) começa do zero: não
  // há sessão que diga que a pessoa ainda não tem empresa.
  if (modoSemLogin() && (await searchParams).nova) {
    return (
      <>
        <PassosDoOnboarding passos={PASSOS_DO_INICIO} atual="empresa" />
        <OnboardingForm companyName="sua empresa" />
      </>
    );
  }

  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (err) {
    if (err instanceof NoActiveCompanySelectedError) redirect('/auth/empresa' as never);
    if (!(err instanceof NoActiveOrganizationError)) throw err;
    // Sem nenhuma empresa vinculada ainda: pede o CNPJ direto, sem widget de terceiro.
    return (
      <>
        <PassosDoOnboarding passos={PASSOS_DO_INICIO} atual="empresa" />
        <OnboardingForm companyName="sua empresa" />
      </>
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
    <>
      <PassosDoOnboarding passos={PASSOS_DO_INICIO} atual="empresa" />
      <OnboardingForm companyName={row?.name ?? 'sua empresa'} existingCompanyId={row ? ctx.companyId : undefined} />
    </>
  );
}
