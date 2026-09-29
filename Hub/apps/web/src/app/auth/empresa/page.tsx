import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getDb, company, membership, eq, withDbTimeout } from '@hexxa/db';
import { createClient } from '@/lib/supabase/server';
import { isNull } from 'drizzle-orm';
import {
  getTenantContext,
  modoSemLogin,
  resolveAppUser,
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

  // Com login: as empresas da pessoa (CPF) — ativas e encerradas. Uma só
  // abre direto; mais de uma, escolhe aqui (é também a troca de empresa).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}` as never);
  const eu = await resolveAppUser(user!.id, user!.email);
  const minhas = await getDb()
    .select({ id: company.id, legalName: company.legalName, closedAt: company.closedAt })
    .from(membership)
    .innerJoin(company, eq(company.id, membership.companyId))
    .where(eq(membership.userId, eu.id))
    .orderBy(company.legalName);

  if (minhas.length === 0) redirect('/onboarding' as never);
  if (minhas.length === 1) redirect(next as never);

  const atual = (await cookies()).get('hexx_active_company')?.value;
  const ativas = minhas.filter((m) => !m.closedAt);
  const encerradas = minhas.filter((m) => m.closedAt);
  return (
    <AuthLayout type="cliente" title="Escolha a empresa" subtitle="Suas empresas, ligadas ao seu CPF">
      <div className="w-full max-w-sm space-y-4">
        <EmpresaSwitcherForm companies={ativas} next={next} atualId={atual} />
        {encerradas.length > 0 && (
          <>
            <p className="pt-2 text-xs uppercase tracking-[0.08em] text-white/50">Encerradas</p>
            <EmpresaSwitcherForm companies={encerradas} next={next} atualId={atual} />
          </>
        )}
      </div>
    </AuthLayout>
  );
}
