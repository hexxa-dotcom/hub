import { Receipt } from 'lucide-react';
import { HubNotas } from './HubNotas';
import { serviceInvoiceRepository, nfseMode } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, isCertConfiguredForTenant, isFiscalComplete, listServiceProfiles } from '@/lib/server/fiscal';
import { createRawClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let recent: Awaited<ReturnType<typeof serviceInvoiceRepository.listRecent>> = [];
  let mode: 'gov' | 'mock' = 'mock';
  let config = null;
  let certOk = false;
  let customers: { id: string; name: string; document: string | null; email: string | null }[] = [];
  let profiles: any[] = [];

  try {
    const ctx = await getTenantContext();
    const [recentData, modeData, configData, certData, profilesData] = await Promise.all([
      serviceInvoiceRepository.listRecent(ctx, 50),
      nfseMode(ctx),
      getNfseConfig(ctx),
      isCertConfiguredForTenant(ctx),
      listServiceProfiles(ctx),
    ]);

    // Busca clientes do tenant real
    const sb = await createRawClient();
    const { data: customersData } = await sb
      .from('customer')
      .select('id, name, document, email')
      .eq('company_id', ctx.companyId)
      .order('name');

    recent = recentData;
    mode = modeData;
    config = configData;
    certOk = certData;
    customers = customersData ?? [];
    profiles = profilesData;
  } catch {
    // tolerates container/tenant failures gracefully
  }

  const fiscalOk = isFiscalComplete(config);

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Notas Fiscais</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Dashboard, emissão de NFSe e configuração fiscal em um só lugar.
        </p>
      </header>

      <HubNotas
        recent={recent as never}
        customers={customers}
        mode={mode}
        certOk={certOk}
        fiscalOk={fiscalOk}
        config={config}
        profiles={profiles}
      />
    </div>
  );
}
