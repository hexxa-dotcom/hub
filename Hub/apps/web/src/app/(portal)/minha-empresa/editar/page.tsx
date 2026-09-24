import { getTenantContext } from '@/lib/server/tenant';
import { Building2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withTenant, company as companyTable, eq } from '@hexxa/db';
import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import { CompanyForm } from '@/app/(portal)/configuracoes/CompanyForm';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Editar Cadastro da Empresa | Hexx Digital',
};

export default async function EditarEmpresaPage() {
  const ctx = await getTenantContext();

  const [company] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(companyTable).where(eq(companyTable.id, ctx.companyId));
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-up pb-20">
      <SectionHero
        subtitulo="Dados cadastrais que aparecem nas notas e nos documentos"
        title="Editar Cadastro da Empresa"
        infoTitle="Alteração de Dados Cadastrais"
        infoDescription="Atualize a razão social, nome fantasia, CNPJ, inscrição municipal e endereço oficial da sede."
        rightSlot={
          <Link
            href="/minha-empresa"
            className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-xs cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-ink-soft" />
            <span>Voltar ao Perfil</span>
          </Link>
        }
      />

      <Card level={1} className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-ink">Dados Oficiais da Pessoa Jurídica</h2>
            <p className="text-xs text-ink-soft">
              Preencha os dados ou digite o CNPJ para preenchimento automático via Receita Federal.
            </p>
          </div>
        </div>

        <CompanyForm company={company} />
      </Card>
    </div>
  );
}
