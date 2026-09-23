import { Suspense } from 'react';
import { DrizzleTaxGuideRepository } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { HubGuias } from './HubGuias';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import { withTenant, eq } from '@hexxa/db';
import { subscription } from '@hexxa/db/schema';
import { listarEntregasDoCliente } from '@/lib/server/entregas';
import { listSubscriptionPayments, type AsaasPayment } from '@/lib/asaas';

export const dynamic = 'force-dynamic';

async function getHonorarios(companyId: string): Promise<{ cobrancas: AsaasPayment[]; semCobranca: boolean }> {
  const [sub] = await withTenant(companyId, (tx) =>
    tx.select({ asaas: subscription.asaasSubscriptionId }).from(subscription).where(eq(subscription.companyId, companyId)),
  );
  if (!sub?.asaas) return { cobrancas: [], semCobranca: true };
  try {
    return { cobrancas: (await listSubscriptionPayments(sub.asaas)).data, semCobranca: false };
  } catch (err) {
    console.error('[guias/honorarios] Asaas não respondeu:', err);
    return { cobrancas: [], semCobranca: false };
  }
}

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
  // Tudo numa lista só — guias, documentos do contador e honorários —, e o
  // cliente separa pelos filtros. Ver HubGuias.
  const [entregas, honorarios] = await Promise.all([
    listarEntregasDoCliente(ctx).catch(() => []),
    getHonorarios(ctx.companyId).catch(() => ({ cobrancas: [], semCobranca: true })),
  ]);
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
      <HubGuias
        initial={guias}
        entregaDaGuia={Object.fromEntries(entregas.filter((e) => e.taxGuideId).map((e) => [e.taxGuideId!, e.id]))}
        documentos={entregas.filter((e) => !e.taxGuideId)}
        honorarios={honorarios.cobrancas}
        insightSlot={
          <Suspense fallback={null}>
            <GuiasInsight companyId={ctx.companyId} insightContext={insightContext} />
          </Suspense>
        }
      />
    </div>
  );
}

