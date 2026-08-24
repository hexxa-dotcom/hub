import { FileCode } from 'lucide-react';
import { FiscalForm } from '../../meu-negocio/fiscal/FiscalForm';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, isCertConfiguredForTenant, listServiceProfiles } from '@/lib/server/fiscal';

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
      <div className="mb-2 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
          <FileCode className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Cadastro Fiscal</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Dados da empresa, perfis de serviço e certificado digital usados na emissão de NFS-e.
          </p>
        </div>
      </div>

      <FiscalForm config={config} temCert={certOk} profiles={profiles} />
    </div>
  );
}
