import { getTenantContext } from '@/lib/server/tenant';
import { Building2 } from 'lucide-react';
import { CompanyForm } from './CompanyForm';
import postgres from 'postgres';

export const metadata = {
  title: 'Dados da Empresa | Hexx Hub',
};

export default async function ConfiguracoesGeraisPage() {
  const ctx = await getTenantContext();
  const sql = postgres(process.env.DATABASE_URL!);

  const rows = await sql`SELECT * FROM company WHERE id = ${ctx.companyId}`;
  const company = rows[0];

  if (!company) {
    return <div>Erro ao carregar dados da empresa.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card-flat rounded-card p-6 border border-line bg-surface-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            <Building2 className="h-5 w-5" />
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
