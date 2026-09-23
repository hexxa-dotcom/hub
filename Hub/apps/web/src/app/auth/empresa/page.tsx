import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb, company, withDbTimeout } from '@hexxa/db';
import { isNull } from 'drizzle-orm';
import {
  getTenantContext,
  modoSemLogin,
  NoActiveCompanySelectedError,
  NoActiveOrganizationError,
} from '@/lib/server/tenant';
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

  // Sem login, qualquer empresa pode ser aberta — e dá para começar uma nova.
  // É assim que o cadastro em 3 passos é testado enquanto o login não volta.
  if (modoSemLogin()) {
    const empresas = await withDbTimeout(
      getDb()
        .select({ id: company.id, legalName: company.legalName })
        .from(company)
        .where(isNull(company.closedAt))
        .orderBy(company.legalName),
      8000,
    );
    const atual = await getTenantContext();
    return (
      <AuthLayout type="contador" title="Escolha a empresa" subtitle="Login desligado: acesso por código">
        <div className="w-full max-w-sm space-y-4">
          <EmpresaSwitcherForm companies={empresas} next={next} semLogin atualId={atual.companyId} />
          <Link
            href={'/onboarding?nova=1' as never}
            className="block w-full rounded-2xl border border-dashed border-[#DFFFAE]/60 px-4 py-3.5 text-center text-sm font-medium text-[#DFFFAE] transition-colors hover:bg-white/10"
          >
            + Cadastrar nova empresa
          </Link>
        </div>
      </AuthLayout>
    );
  }

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
