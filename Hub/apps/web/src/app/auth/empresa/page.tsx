import { redirect } from 'next/navigation';
import { getTenantContext, NoActiveCompanySelectedError, NoActiveOrganizationError } from '@/lib/server/tenant';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { EmpresaSwitcherForm } from './EmpresaSwitcherForm';

export const dynamic = 'force-dynamic';

export default async function EmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next || '/cliente';

  try {
    await getTenantContext();
  } catch (err) {
    if (err instanceof NoActiveOrganizationError) redirect('/onboarding' as never);
    if (!(err instanceof NoActiveCompanySelectedError)) throw err;

    return (
      <AuthLayout type="contador" title="Escolha a empresa" subtitle="Você tem acesso a mais de uma empresa">
        <EmpresaSwitcherForm companies={err.companies} next={next} />
      </AuthLayout>
    );
  }

  // Já tem empresa ativa resolvida (ex.: usuário voltou aqui por engano) — segue.
  redirect(next as never);
}
