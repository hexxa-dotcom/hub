import { Suspense } from 'react';
import { DrizzleTaxGuideRepository } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { HubGuias } from './HubGuias';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import Link from 'next/link';
import { withTenant, eq } from '@hexxa/db';
import { subscription } from '@hexxa/db/schema';
import { listarEntregasDoCliente, TIPOS_DE_DOCUMENTO } from '@/lib/server/entregas';
import { listSubscriptionPayments, type AsaasPayment } from '@/lib/asaas';
import { DocumentosDoContador } from './DocumentosDoContador';
import { HonorariosDoCliente } from './HonorariosDoCliente';

type Aba = 'guias' | 'documentos' | 'honorarios';

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

/**
 * A CENTRAL, EM TRÊS ABAS: o que pagar de imposto, o que a contabilidade
 * enviou (com protocolo) e os honorários com o boleto.
 */
function Abas({ atual, naoAbertos }: { atual: Aba; naoAbertos: number }) {
  const abas: [Aba, string][] = [
    ['guias', 'Guias'],
    ['documentos', 'Documentos do contador'],
    ['honorarios', 'Honorários'],
  ];
  return (
    <nav className="flex flex-wrap gap-2">
      {abas.map(([id, nome]) => (
        <Link
          key={id}
          href={`/minha-contabilidade/guias${id === 'guias' ? '' : `?aba=${id}`}` as never}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            atual === id
              ? 'bg-[#1E3328] text-[#DFFFAE]'
              : 'border border-black/10 text-[#231F20] hover:bg-black/5 dark:border-white/10 dark:text-[#F5F6F4]'
          }`}
        >
          {nome}
          {id === 'documentos' && naoAbertos > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-[11px] text-white">{naoAbertos}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

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

export default async function Page({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ctx = await getTenantContext();
  const pedida = (await searchParams).aba;
  const aba: Aba = pedida === 'documentos' || pedida === 'honorarios' ? pedida : 'guias';
  const entregas = await listarEntregasDoCliente(ctx).catch(() => []);
  const naoAbertos = entregas.filter((e) => !e.visualizadoEm && e.origem === 'CONTADOR').length;

  if (aba === 'documentos') {
    return (
      <div className="mx-auto w-full space-y-6">
        <Abas atual={aba} naoAbertos={naoAbertos} />
        <DocumentosDoContador entregas={entregas} tipos={TIPOS_DE_DOCUMENTO} />
      </div>
    );
  }
  if (aba === 'honorarios') {
    const h = await getHonorarios(ctx.companyId);
    return (
      <div className="mx-auto w-full space-y-6">
        <Abas atual={aba} naoAbertos={naoAbertos} />
        <HonorariosDoCliente cobrancas={h.cobrancas} semCobranca={h.semCobranca} />
      </div>
    );
  }

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
      <Abas atual={aba} naoAbertos={naoAbertos} />
      <HubGuias
        initial={guias}
        entregaDaGuia={Object.fromEntries(entregas.filter((e) => e.taxGuideId).map((e) => [e.taxGuideId!, e.id]))}
        insightSlot={
          <Suspense fallback={null}>
            <GuiasInsight companyId={ctx.companyId} insightContext={insightContext} />
          </Suspense>
        }
      />
    </div>
  );
}

