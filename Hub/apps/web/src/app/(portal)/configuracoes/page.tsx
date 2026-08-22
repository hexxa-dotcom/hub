import { getTenantContext } from '@/lib/server/tenant';
import {  Buildings  } from '@phosphor-icons/react/dist/ssr';
import { CompanyForm } from './CompanyForm';
import { withTenant, company as companyTable, eq } from '@hexxa/db';

export const metadata = {
  title: 'Dados da Empresa | Hexx Hub',
};

export default async function ConfiguracoesGeraisPage() {
  const ctx = await getTenantContext();

  const [company] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(companyTable).where(eq(companyTable.id, ctx.companyId));
  });

  if (!company) {
    return <div>Erro ao carregar dados da empresa.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card-flat rounded-card p-6 border border-line bg-surface-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            <Buildings className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-ink">Dados da Empresa</h2>
            <p className="text-sm text-ink-soft">Informações cadastrais e endereço base para faturamento.</p>
          </div>
        </div>

        <CompanyForm company={company} />
      </div>
    </div>
  );
}
