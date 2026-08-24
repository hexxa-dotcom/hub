import { getTenantContext } from '@/lib/server/tenant';
import { Building2 } from 'lucide-react';
import { CompanyForm } from './CompanyForm';
import { withTenant, company as companyTable, eq } from '@hexxa/db';

export const metadata = {
  title: 'Dados da Empresa | Hexxa Hub',
};

export default async function ConfiguracoesGeraisPage() {
  const ctx = await getTenantContext();

  const [company] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(companyTable).where(eq(companyTable.id, ctx.companyId));
  });

  if (!company) {
    return <div className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Erro ao carregar dados da empresa.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Dados Cadastrais da Empresa</h2>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Informações oficiais da pessoa jurídica e endereço da sede.</p>
          </div>
        </div>

        <CompanyForm company={company} />
      </div>
    </div>
  );
}

