import { Suspense } from 'react';
import { DrizzleTaxGuideRepository } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { HubGuias } from './HubGuias';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';

import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

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
      <Card level={2} tone="deep" className="relative z-30 min-h-[84px] py-4 px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre a Central de Guias"
            description="Acompanhe toda a sua jornada de impostos do mês de forma simples. DAS, DARF, ISS e parcelamentos centralizados em um só lugar."
          />
          <div className="flex flex-col items-end gap-1 text-right shrink-0">
            <div className="flex items-center gap-3">
              {vencidas.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-3 py-1 text-xs font-bold shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  {vencidas.length} em atraso
                </span>
              ) : proximas7dias.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-1 text-xs font-bold shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {proximas7dias.length} a vencer
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-bold shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Tudo em dia
                </span>
              )}
              <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
                Central de Guias
              </h1>
            </div>
            <p className="text-xs text-ink-soft hidden sm:block">
              Gestão integrada de impostos e obrigações fiscais
            </p>
          </div>
        </div>
      </Card>

      <Suspense fallback={null}>
        <GuiasInsight companyId={ctx.companyId} insightContext={insightContext} />
      </Suspense>

      <HubGuias initial={guias} />
    </div>
  );
}

