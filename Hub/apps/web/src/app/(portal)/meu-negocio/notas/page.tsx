import { Suspense } from 'react';
import { HubNotas } from './HubNotas';
import { serviceInvoiceRepository, nfseMode } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, estimateInvoiceTaxRate, isCertConfiguredForTenant, isFiscalComplete, listServiceProfiles } from '@/lib/server/fiscal';
import { withTenant, customer, eq } from '@hexxa/db';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';

import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';

export const dynamic = 'force-dynamic';

// Isolado em Suspense pra não travar a página inteira esperando a chamada de IA.
async function NotasInsight({ companyId, insightContext }: { companyId: string; insightContext: string }) {
  const insight = await getContextualInsight(companyId, 'meu-negocio/notas', insightContext);
  return <InsightCard pageKey="meu-negocio/notas" insight={insight} />;
}

export default async function Page() {
  let recent: Awaited<ReturnType<typeof serviceInvoiceRepository.listRecent>> = [];
  let mode: 'gov' | 'mock' = 'mock';
  let config = null;
  let certOk = false;
  let customers: { id: string; name: string; document: string | null; email: string | null }[] = [];
  let profiles: any[] = [];
  let taxRatePercent = 0;
  let companyId = '';

  try {
    const ctx = await getTenantContext();
    companyId = ctx.companyId;
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

  const issuedThisMonth = recent.filter((n) => n.status === 'ISSUED' && n.referenceMonth === new Date().toISOString().slice(0, 7));
  const withError = recent.filter((n) => n.status === 'ERROR');
  const insightContext = [
    `Tela: emissão de Notas Fiscais de Serviço (NFSe) de uma empresa optante do Simples Nacional.`,
    `Cadastro fiscal completo: ${fiscalOk ? 'sim' : 'não'}. Certificado digital configurado: ${certOk ? 'sim' : 'não'}. Modo: ${mode === 'gov' ? 'produção (governo)' : 'teste (mock)'}.`,
    `Notas emitidas este mês: ${issuedThisMonth.length}, total R$ ${issuedThisMonth.reduce((s, n) => s + n.amount, 0).toFixed(2)}.`,
    `Notas com erro de emissão: ${withError.length}.`,
    `Clientes cadastrados: ${customers.length}.`,
  ].join('\n');

  return (
    <div className="mx-auto w-full space-y-16 animate-fade-up">
      {companyId && (
        <Suspense fallback={null}>
          <NotasInsight companyId={companyId} insightContext={insightContext} />
        </Suspense>
      )}
      <SectionHero
        title="Notas Fiscais de Serviço"
        infoTitle="Sobre as Notas Fiscais"
        infoDescription="Emissão simplificada, acompanhamento no Emissor Nacional e gestão de tomadores."
      />

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
