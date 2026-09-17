import { FileCode } from 'lucide-react';
import { FiscalForm } from '../../meu-negocio/fiscal/FiscalForm';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, isCertConfiguredForTenant, listServiceProfiles } from '@/lib/server/fiscal';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cadastro Fiscal | Hexxa Hub',
};

export default async function FiscalPage() {
  let config = null;
  let certOk = false;
  let profiles: any[] = [];

  try {
    const ctx = await getTenantContext();
    const [configData, certData, profilesData] = await Promise.all([
      getNfseConfig(ctx),
      isCertConfiguredForTenant(ctx),
      listServiceProfiles(ctx),
    ]);
    config = configData;
    certOk = certData;
    profiles = profilesData;
  } catch (err) {
    console.error('[configuracoes/fiscal/page] falha ao carregar dados fiscais:', err);
  }

  return (
    <div className="space-y-6">
      <Card level={1} className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime">
            <FileCode className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-ink">Cadastro Fiscal</h2>
            <p className="text-xs text-ink-soft">
              Dados da empresa, perfis de serviço e certificado digital usados na emissão de NFS-e.
            </p>
          </div>
        </div>

        <FiscalForm config={config} temCert={certOk} profiles={profiles} />
      </Card>
    </div>
  );
}
