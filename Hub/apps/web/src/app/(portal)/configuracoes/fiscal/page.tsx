import { FiscalForm } from '../../meu-negocio/fiscal/FiscalForm';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, isCertConfiguredForTenant, listServiceProfiles } from '@/lib/server/fiscal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cadastro Fiscal | Hexx Digital',
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
    <section className="space-y-5">
      <div>
        <p className="rotulo text-ink-soft">Cadastro fiscal</p>
        <p className="mt-1 text-sm text-ink-soft">Dados da empresa, perfis de serviço e certificado digital usados na emissão de notas.</p>
      </div>
      <FiscalForm config={config} temCert={certOk} profiles={profiles} />
    </section>
  );
}
