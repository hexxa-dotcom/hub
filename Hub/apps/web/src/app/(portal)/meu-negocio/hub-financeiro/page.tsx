import { Suspense } from 'react';
import { HubFinanceiro } from './HubFinanceiro';
import { getLancamentos } from './actions';
import { getTenantContext } from '@/lib/server/tenant';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';

import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const dynamic = 'force-dynamic';

// Isolado em Suspense pra não travar o dashboard inteiro esperando a
// chamada de IA — o card de dica só aparece quando (e se) ficar pronto.
async function HubFinanceiroInsight() {
  let insight: string | null = null;
  try {
    const ctx = await getTenantContext();
    const lancamentos = await getLancamentos();
    const hoje = new Date().toISOString().slice(0, 10);
    const vencidos = lancamentos.filter((l) => !l.pago_em && l.vencimento < hoje);
    const mesAtual = hoje.slice(0, 7);
    const receberMes = lancamentos.filter((l) => l.tipo === 'RECEBER' && l.vencimento.startsWith(mesAtual)).reduce((s, l) => s + l.valor, 0);
    const pagarMes = lancamentos.filter((l) => l.tipo === 'PAGAR' && l.vencimento.startsWith(mesAtual)).reduce((s, l) => s + l.valor, 0);
    const insightContext = [
      `Tela: resumo financeiro (contas a pagar e a receber) de uma empresa de serviço.`,
      `A receber neste mês: R$ ${receberMes.toFixed(2)}. A pagar neste mês: R$ ${pagarMes.toFixed(2)}.`,
      `Lançamentos vencidos e não pagos: ${vencidos.length}${vencidos.length ? ` — total R$ ${vencidos.reduce((s, l) => s + l.valor, 0).toFixed(2)}` : ''}.`,
    ].join('\n');
    insight = await getContextualInsight(ctx.companyId, 'meu-negocio/hub-financeiro', insightContext);
  } catch (err) {
    console.error('[hub-financeiro/page] falha ao gerar insight:', err);
  }
  return <InsightCard pageKey="meu-negocio/hub-financeiro" insight={insight} />;
}

export default async function Page() {
  return (
    <div className="mx-auto w-full space-y-7 animate-fade-up">
      <Suspense fallback={null}>
        <HubFinanceiroInsight />
      </Suspense>
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex items-center justify-between gap-4 w-full">
          <SectionInfo
            title="Sobre o Hub Financeiro"
            description="Contas a pagar, a receber, conciliação bancária e fluxo de caixa — tudo integrado com a sua contabilidade. O Balanço e o DRE ficam na aba Contabilidade."
          />
          <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight text-right shrink-0">
            Hub Financeiro
          </h1>
        </div>
      </Card>

      <HubFinanceiro />
    </div>
  );
}
