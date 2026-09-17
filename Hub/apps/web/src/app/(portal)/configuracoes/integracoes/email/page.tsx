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
    <div className="mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col gap-4">
        <Link
          href="/configuracoes/integracoes"
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-1)">
            <Mail className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              E-mail (Envio de NFS-e)
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-ink-soft">
              Conecte a conta de e-mail que o Hub usa para encaminhar a NFS-e automaticamente para o tomador assim que for autorizada.
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
