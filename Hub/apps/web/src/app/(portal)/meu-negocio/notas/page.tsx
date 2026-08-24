import { Receipt, Sparkles } from 'lucide-react';
import { HubNotas } from './HubNotas';
import { serviceInvoiceRepository, nfseMode } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, estimateInvoiceTaxRate, isCertConfiguredForTenant, isFiscalComplete, listServiceProfiles } from '@/lib/server/fiscal';
import { withTenant, customer, eq } from '@hexxa/db';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let recent: Awaited<ReturnType<typeof serviceInvoiceRepository.listRecent>> = [];
  let mode: 'gov' | 'mock' = 'mock';
  let config = null;
  let certOk = false;
  let customers: { id: string; name: string; document: string | null; email: string | null }[] = [];
  let profiles: any[] = [];
  let taxRatePercent = 0;

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
    const customersData = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({
          id: customer.id,
          name: customer.name,
          document: customer.document,
          email: customer.email,
        })
        .from(customer)
        .where(eq(customer.companyId, ctx.companyId));
    });

    customersData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    recent = recentData;
    mode = modeData;
    config = configData;
    certOk = certData;
    customers = customersData ?? [];
    profiles = profilesData;
    if (configData) {
      taxRatePercent = await estimateInvoiceTaxRate(ctx, configData, profilesData[0]?.aliquotaIss);
    }
  } catch (err) {
    // tolera falha de container/tenant sem derrubar a página, mas registra
    // pra não ficar invisível (ex.: ENCRYPTION_KEY ausente faria a leitura
    // do certificado falhar e a página cairia aqui em silêncio).
    console.error('[meu-negocio/notas/page] falha ao carregar dados fiscais:', err);
  }

  const fiscalOk = isFiscalComplete(config);

  return (
    <div className="mx-auto w-full space-y-7 animate-fade-up">
      <header className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Faturamento &amp; Emissão NFSe
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              Notas Fiscais de Serviço
            </h1>
            <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-xl">
              Emissão simplificada, acompanhamento no Emissor Nacional e gestão de tomadores.
            </p>
          </div>
        </div>
      </header>

      <HubNotas
        recent={recent as never}
        customers={customers}
        mode={mode}
        certOk={certOk}
        fiscalOk={fiscalOk}
        config={config}
        profiles={profiles}
        taxRatePercent={taxRatePercent}
      />
    </div>
  );
}
