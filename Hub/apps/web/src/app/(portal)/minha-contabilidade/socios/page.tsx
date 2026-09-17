import { Suspense } from 'react';
import { TaxThermometerService } from '@hexxa/core';
import { HubSocios } from './HubSocios';
import { listPartnersAction } from './actions';
import { listDistributionsAction, getAvailableProfitAction } from '@/lib/server/profit-distribution';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, proLaboreMinimoParaFatorR } from '@/lib/server/fiscal';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

// Isolado em Suspense pra não travar a página inteira esperando a chamada de IA.
async function SociosInsight({ companyId, insightContext }: { companyId: string; insightContext: string }) {
  const insight = await getContextualInsight(companyId, 'minha-contabilidade/socios', insightContext);
  return <InsightCard pageKey="minha-contabilidade/socios" insight={insight} />;
}

export default async function Page() {
  const ctx = await getTenantContext();
  const [partners, distribuicoes, simplesInputs, yearlyProfit] = await Promise.all([
    listPartnersAction(),
    listDistributionsAction(),
    getSimplesInputs(ctx),
    getAvailableProfitAction(),
  ]);

  const prolaboreMinimoRecomendado = proLaboreMinimoParaFatorR(simplesInputs.rbt12, simplesInputs.folhaEmpregados12);
  const { fatorRFavorable, anexo, fatorR } = new TaxThermometerService().simplesPosition({
    rbt12: simplesInputs.rbt12,
    payroll12: simplesInputs.folha12,
  });

  const insightContext = [
    `Tela: Gestão de Sócios de uma empresa de serviço optante do Simples Nacional.`,
    `RBT12 (receita bruta 12 meses): R$ ${simplesInputs.rbt12.toFixed(2)}.`,
    `Fator R atual: ${(fatorR * 100).toFixed(1)}% — ${fatorRFavorable ? 'favorável (Anexo III)' : 'desfavorável (cai no Anexo V)'}. Enquadramento atual: Anexo ${anexo}.`,
    `Pró-labore total pago aos sócios (mensal, últimos 12 meses/12): R$ ${(simplesInputs.prolabore12 / 12).toFixed(2)}.`,
    `Pró-labore mínimo recomendado pra manter o Fator R favorável: R$ ${prolaboreMinimoRecomendado.toFixed(2)}.`,
    `Sócios cadastrados: ${partners.map((p) => `${p.nome} (${p.participacao}% de participação, pró-labore R$ ${p.prolabore.toFixed(2)}/mês)`).join('; ') || 'nenhum'}.`,
    `Lucro do ano disponível pra distribuir: R$ ${yearlyProfit.availableToDistribute.toFixed(2)} (já distribuído este ano: R$ ${yearlyProfit.distributedThisYear.toFixed(2)}).`,
  ].join('\n');

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="p-6 sm:p-8 card-finish">
        <h1 className="font-serif font-bold text-display text-ink tracking-tight">
          Gestão de Sócios
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Pró-labore estratégico para otimização do Fator R e lançamentos de distribuição de lucros isenta.
        </p>
      </Card>

      <Suspense fallback={null}>
        <SociosInsight companyId={ctx.companyId} insightContext={insightContext} />
      </Suspense>

      <HubSocios
        initialPartners={partners}
        initialDistribuicoes={distribuicoes}
        prolaboreMinimoRecomendado={prolaboreMinimoRecomendado}
        prolaboreAtualTotal={simplesInputs.prolabore12 / 12}
        fatorRFavoravel={fatorRFavorable}
        yearlyProfit={yearlyProfit}
      />
    </div>
  );
}

