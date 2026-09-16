import { ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';
import { EmailSetupForm } from './EmailSetupForm';
import { withTenant, eq } from '@hexxa/db';
import { emailAccount } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'E-mail (NFSe) | Hexxa Hub',
};

export default async function EmailIntegracaoPage() {
  const ctx = await getTenantContext();

  const [account] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({ isActive: emailAccount.isActive, emailAddress: emailAccount.emailAddress })
      .from(emailAccount)
      .where(eq(emailAccount.companyId, ctx.companyId));
  });

  return (
    <div className="mx-auto w-full space-y-8 animate-in fade-in">
      <header className="flex flex-col gap-4">
        <Link
          href="/configuracoes/integracoes"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#1E3328] text-[#DFFFAE] shadow-md">
            <Mail className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
              E-mail (envio de NFSe)
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Conecte a conta de e-mail que o Hub usa pra mandar a NFSe automaticamente pro cliente assim que ela é emitida.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-xl">
        <EmailSetupForm connected={account?.isActive ?? false} emailAddress={account?.emailAddress ?? null} />
      </div>
    </div>
  );
}
