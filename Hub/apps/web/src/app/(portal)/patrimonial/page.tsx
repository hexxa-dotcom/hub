import { Suspense } from 'react';
import { Landmark } from 'lucide-react';
import { getProperties, getResumoFinanceiroAction, listLeasesAction } from './actions';
import { listPartnersAction } from '../minha-contabilidade/socios/actions';
import { PatrimonioApp } from './PatrimonioApp';
import { getTenantContext } from '@/lib/server/tenant';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';

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
    getResumoFinanceiroAction(),
    listLeasesAction(),
  ]);

  const ativos = leases.filter((l) => l.status === 'ACTIVE');
  const insightContext = [
    `Tela: gestão de patrimônio (imóveis, ativos, depreciação e contratos de aluguel) de uma holding patrimonial.`,
    `Bens cadastrados: ${properties.length}. Contratos de aluguel ativos: ${ativos.length}, renda mensal total R$ ${ativos.reduce((s, l) => s + l.monthlyRent, 0).toFixed(2)}.`,
    `Lucro do exercício (já líquido de depreciação, base pro simulador de dividendos): R$ ${resumo.lucroExercicio.toFixed(2)}.`,
    `Bens sem contrato de aluguel ativo: ${properties.filter((p) => !p.leaseId).length}.`,
  ].join('\n');

  return (
    <div className="mx-auto w-full space-y-6">
      <Suspense fallback={null}>
        <PatrimonialInsight companyId={ctx.companyId} insightContext={insightContext} />
      </Suspense>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Landmark className="h-3.5 w-3.5" />
              Gestão Patrimonial
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Gestão de Patrimônio & Ativos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Patrimônio consolidado da empresa (PJ) e dos sócios (PF), com cálculo contábil real de depreciação e simulação de dividendos.
          </p>
        </div>
      </header>

      <PatrimonioApp initialProperties={properties} partners={partners} resumo={resumo} initialLeases={leases} />
    </div>
  );
}

