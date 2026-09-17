import { getTenantContext } from '@/lib/server/tenant';
import { Building2 } from 'lucide-react';
import { CompanyForm } from './CompanyForm';
import { withTenant, company as companyTable, eq } from '@hexxa/db';
import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Dados da Empresa | Hexxa Hub',
};

export default async function ConfiguracoesGeraisPage() {
  const ctx = await getTenantContext();

  const [company] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(companyTable).where(eq(companyTable.id, ctx.companyId));
  });

  if (!company) {
    return <div className="text-xs text-ink-soft">Erro ao carregar dados da empresa.</div>;
  }

  return (
    <div className="space-y-6">
      <Card level={1} className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-ink">Dados Cadastrais da Empresa</h2>
            <p className="text-xs text-ink-soft">Informações oficiais da pessoa jurídica e endereço da sede.</p>
          </div>
        </div>

        <CompanyForm company={company} />
      </Card>
    </div>
  );
}
