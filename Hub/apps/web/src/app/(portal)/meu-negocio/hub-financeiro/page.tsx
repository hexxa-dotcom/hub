import { TrendingUp, Sparkles } from 'lucide-react';
import { HubFinanceiro } from './HubFinanceiro';
import { getLancamentos } from './actions';
import { getTenantContext } from '@/lib/server/tenant';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';

export const dynamic = 'force-dynamic';

export default async function Page() {
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

  return (
    <div className="mx-auto w-full space-y-7 animate-fade-up">
      <InsightCard pageKey="meu-negocio/hub-financeiro" insight={insight} />
      <header className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Gestão Financeira
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              Hub Financeiro
            </h1>
            <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-xl">
              Contas a pagar, a receber, conciliação bancária e fluxo de caixa — tudo integrado com a sua contabilidade.
              O Balanço e o DRE ficam na aba Contabilidade.
            </p>
          </div>
        </div>
      </header>

      <HubFinanceiro />
    </div>
  );
}
