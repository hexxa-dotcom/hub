import { Suspense } from 'react';
import { getProperties, listLeasesAction } from './actions';
import { listPartnersAction } from '../minha-contabilidade/socios/actions';
import { getAvailableProfitAction } from '@/lib/server/profit-distribution';
import { PatrimonioApp } from './PatrimonioApp';
import { getTenantContext } from '@/lib/server/tenant';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';

import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

// Isolado em Suspense pra não travar a página inteira esperando a chamada de IA.
async function PatrimonialInsight({ companyId, insightContext }: { companyId: string; insightContext: string }) {
  const insight = await getContextualInsight(companyId, 'patrimonial', insightContext);
  return <InsightCard pageKey="patrimonial" insight={insight} />;
}

export default async function Page() {
  const ctx = await getTenantContext();
  const [properties, partners, resumo, leases] = await Promise.all([
    getProperties(),
    listPartnersAction(),
    getAvailableProfitAction(),
    listLeasesAction(),
  ]);

  const ativos = leases.filter((l) => l.status === 'ACTIVE');
  const insightContext = [
    `Tela: gestão de patrimônio (imóveis, ativos, depreciação e contratos de aluguel) de uma holding patrimonial.`,
    `Bens cadastrados: ${properties.length}. Contratos de aluguel ativos: ${ativos.length}, renda mensal total R$ ${ativos.reduce((s, l) => s + l.monthlyRent, 0).toFixed(2)}.`,
    `Lucro do exercício (já líquido de depreciação, base pro simulador de dividendos): R$ ${resumo.netProfit.toFixed(2)}.`,
    `Bens sem contrato de aluguel ativo: ${properties.filter((p) => !p.leaseId).length}.`,
  ].join('\n');

  return (
    <div className="mx-auto w-full space-y-6">
      <Suspense fallback={null}>
        <PatrimonialInsight companyId={ctx.companyId} insightContext={insightContext} />
      </Suspense>

      <Card level={2} tone="deep" className="p-6 sm:p-8 card-finish">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif font-bold text-display text-ink tracking-tight">
              Gestão de Patrimônio & Ativos
            </h1>
            <p className="mt-1 text-body-sm text-ink-soft">
              Patrimônio consolidado da empresa (PJ) e dos sócios (PF), com cálculo contábil real de depreciação e simulação de dividendos.
            </p>
          </div>
        </div>
      </Card>

      <PatrimonioApp initialProperties={properties} partners={partners} resumo={resumo} initialLeases={leases} />
    </div>
  );
}

