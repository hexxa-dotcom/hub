import { Suspense } from 'react';
import { HubFinanceiro } from './HubFinanceiro';
import { getLancamentos } from './actions';
import { getTenantContext } from '@/lib/server/tenant';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import { ExtratoConteudo } from '../conciliacao/ExtratoConteudo';
import { getReconciliationData } from '../conciliacao/actions';

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

const ABAS = ['geral', 'pagar', 'receber', 'extrato', 'agenda'] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const aba = (await searchParams).aba;
  const initialTab = (ABAS as readonly string[]).includes(aba ?? '') ? (aba as (typeof ABAS)[number]) : 'geral';
  // Só o número para a aba; o conteúdo do extrato carrega no próprio Suspense.
  const extratoPendentes = await getReconciliationData()
    .then((d) => d.transactions.length)
    .catch(() => 0);

  return (
    <div className="mx-auto w-full space-y-16 animate-fade-up">
      <HubFinanceiro
        initialTab={initialTab}
        extratoPendentes={extratoPendentes}
        extratoSlot={
          <Suspense fallback={<p className="py-16 text-center text-sm text-ink-soft">Carregando o extrato…</p>}>
            <ExtratoConteudo />
          </Suspense>
        }
        insightSlot={
          <Suspense fallback={null}>
            <HubFinanceiroInsight />
          </Suspense>
        }
      />
    </div>
  );
}
