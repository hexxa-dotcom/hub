import { Suspense } from 'react';
import { Receipt, Sparkles } from 'lucide-react';
import { DrizzleTaxGuideRepository } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { HubGuias } from './HubGuias';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';

export const dynamic = 'force-dynamic';

// Isolado em Suspense pra não travar a página inteira esperando a chamada de IA.
async function GuiasInsight({ companyId, insightContext }: { companyId: string; insightContext: string }) {
  const insight = await getContextualInsight(companyId, 'minha-contabilidade/guias', insightContext);
  return <InsightCard pageKey="minha-contabilidade/guias" insight={insight} />;
}

async function getGuias() {
  try {
    const ctx = await getTenantContext();
    return await new DrizzleTaxGuideRepository().listAll(ctx);
  } catch (err) {
    console.error('[guias/page] falha ao listar guias:', err);
    return [];
  }
}

export default async function Page() {
  const ctx = await getTenantContext();
  const guias = await getGuias();

  const hoje = new Date().toISOString().slice(0, 10);
  const vencidas = guias.filter((g) => g.status !== 'PAID' && g.dueDate < hoje);
  const proximas7dias = guias.filter((g) => g.status !== 'PAID' && g.dueDate >= hoje && g.dueDate <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const insightContext = [
    `Tela: guias de impostos (DAS, DARF, ISS, parcelamentos) de uma empresa optante do Simples Nacional.`,
    `Guias vencidas e ainda não pagas: ${vencidas.length}${vencidas.length ? ` — total R$ ${vencidas.reduce((s, g) => s + g.amount, 0).toFixed(2)}` : ''}.`,
    `Guias vencendo nos próximos 7 dias: ${proximas7dias.length}${proximas7dias.length ? ` — total R$ ${proximas7dias.reduce((s, g) => s + g.amount, 0).toFixed(2)}` : ''}.`,
    `Total de guias cadastradas: ${guias.length}.`,
  ].join('\n');

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Receipt className="h-3.5 w-3.5" />
              Minha Contabilidade
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Central de Guias
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Acompanhe toda a sua jornada de impostos do mês de forma simples. DAS, DARF, ISS e parcelamentos centralizados em um só lugar.
          </p>
        </div>
      </header>

      <Suspense fallback={null}>
        <GuiasInsight companyId={ctx.companyId} insightContext={insightContext} />
      </Suspense>

      <HubGuias initial={guias} />
    </div>
  );
}

