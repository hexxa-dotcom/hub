import { Suspense } from 'react';
import { TaxThermometerService } from '@hexxa/core';
import { HubSocios } from './HubSocios';
import { listPartnersAction } from './actions';
import { listDistributionsAction, getAvailableProfitAction } from '@/lib/server/profit-distribution';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, proLaboreMinimoParaFatorR, posicaoSimples, enquadramentoApurado, fatorRSeAplica } from '@/lib/server/fiscal';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import { SectionHero } from '@/components/ui/SectionHero';

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
  // Posição oficial por cima da estimada, e a mesma regra do termômetro para
  // decidir se o Fator R importa aqui.
  const [posicao, apurado] = await Promise.all([
    posicaoSimples(ctx, simplesInputs),
    enquadramentoApurado(ctx),
  ]);
  const { fatorRFavorable, anexo, fatorR } = posicao;
  const regraFatorR = fatorRSeAplica(apurado, new TaxThermometerService().simplesPosition({
    rbt12: simplesInputs.rbt12,
    payroll12: simplesInputs.folha12,
  }).fatorR);

  const insightContext = [
    `Tela: Gestão de Sócios de uma empresa de serviço optante do Simples Nacional.`,
    `RBT12 (receita bruta 12 meses): R$ ${simplesInputs.rbt12.toFixed(2)}.`,
    regraFatorR.aplica
      ? `Fator R atual: ${(fatorR * 100).toFixed(1)}% — ${fatorRFavorable ? 'favorável (Anexo III)' : 'desfavorável (cai no Anexo V)'}. Enquadramento atual: Anexo ${anexo}.`
      : `Enquadramento: Anexo ${anexo}, apurado pelo contábil. O Fator R NÃO decide o imposto desta empresa — NÃO recomende aumentar pró-labore por causa dele.`,
    `Pró-labore total pago aos sócios (mensal, últimos 12 meses/12): R$ ${(simplesInputs.prolabore12 / 12).toFixed(2)}.`,
    ...(regraFatorR.aplica
      ? [`Pró-labore mínimo recomendado pra manter o Fator R favorável: R$ ${prolaboreMinimoRecomendado.toFixed(2)}.`]
      : []),
    `Sócios cadastrados: ${partners.map((p) => `${p.nome} (${p.participacao}% de participação, pró-labore R$ ${p.prolabore.toFixed(2)}/mês)`).join('; ') || 'nenhum'}.`,
    yearlyProfit.fonte === 'OFICIAL'
      ? `Lucro do ano disponível pra distribuir (contabilidade oficial, até ${yearlyProfit.mesOficial}): R$ ${yearlyProfit.availableToDistribute.toFixed(2)} (já distribuído este ano: R$ ${yearlyProfit.distributedThisYear.toFixed(2)}).`
      : `Lucro oficial indisponível — NÃO sugira valores de distribuição. Motivo: ${yearlyProfit.motivoIndisponivel}`,
  ].join('\n');

  return (
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        title="Gestão de Sócios"
        infoTitle="Sobre a Gestão de Sócios"
        infoDescription="Pró-labore estratégico para otimização do Fator R e lançamentos de distribuição de lucros isenta."
      />

      <Suspense fallback={null}>
        <SociosInsight companyId={ctx.companyId} insightContext={insightContext} />
      </Suspense>

      <HubSocios
        initialPartners={partners}
        initialDistribuicoes={distribuicoes}
        prolaboreMinimoRecomendado={prolaboreMinimoRecomendado}
        prolaboreAtualTotal={simplesInputs.prolabore12 / 12}
        fatorRFavoravel={fatorRFavorable}
        fatorRAplica={regraFatorR.aplica}
        anexoApurado={apurado?.anexo ?? null}
        yearlyProfit={yearlyProfit}
      />
    </div>
  );
}

