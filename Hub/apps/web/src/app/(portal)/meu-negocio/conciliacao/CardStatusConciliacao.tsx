'use client';

import { CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface CardStatusConciliacaoProps {
  transactions: { id: string; amount: number }[];
  entries: { id: string; amount: number }[];
  contas: { id: string; nome: string }[];
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CardStatusConciliacao({
  transactions,
  entries,
  contas,
}: CardStatusConciliacaoProps) {
  const isUpToDate = transactions.length === 0;
  const totalPendente = transactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);

  if (isUpToDate) {
    return (
      <Card
        level={1}
        className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card p-6 shadow-(--elev-1) card-finish flex flex-col justify-between h-full"
      >
        <div>
          {/* Topo com Badge */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" /> Conciliação 100% em dia
            </span>
            <span className="text-xs text-ink-soft">
              {contas.length} {contas.length === 1 ? 'conta ativa' : 'contas ativas'}
            </span>
          </div>

          {/* Conteúdo Central */}
          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl text-ink">
                  Tudo em dia!
                </h3>
                <p className="text-xs text-ink-soft">
                  Nenhuma transação pendente de conciliação.
                </p>
              </div>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed pt-2">
              Todas as movimentações bancárias importadas já foram devidamente pareadas e categorizadas no Hub. Quando você baixar um novo extrato do banco, envie-o no cartão ao lado.
            </p>
          </div>
        </div>

        {/* Rodapé / Mini Bento Indicators */}
        <div className="grid grid-cols-2 gap-2.5 pt-4 mt-4 border-t border-black/5 dark:border-white/10">
          <div className="rounded-xl bg-surface p-2.5 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
            <p className="rotulo text-ink-soft">Pendências</p>
            <p className="font-serif font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">0 transações</p>
          </div>
          <div className="rounded-xl bg-surface p-2.5 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
            <p className="rotulo text-ink-soft">Fechamento</p>
            <p className="font-serif font-bold text-sm text-ink mt-0.5">Pronto p/ apuração</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      level={1}
      className="rounded-3xl border border-black/5 dark:border-white/10 bg-surface-card p-6 shadow-(--elev-1) card-finish flex flex-col justify-between h-full"
    >
      <div>
        {/* Topo com Badge */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <ArrowRightLeft className="h-3 w-3" /> Aguardando Conciliação
          </span>
          <span className="text-xs text-ink-soft font-serif font-bold tabular">
            Total {fmt(totalPendente)}
          </span>
        </div>

        {/* Conteúdo Central */}
        <div className="space-y-2 mt-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-xl text-ink">
                {transactions.length} {transactions.length === 1 ? 'transação no extrato' : 'transações no extrato'}
              </h3>
              <p className="text-xs text-ink-soft">
                {entries.length} lançamentos abertos no sistema para correspondência.
              </p>
            </div>
          </div>

          <p className="text-xs text-ink-soft leading-relaxed pt-2">
            As movimentações do extrato estão prontas para conferência abaixo. Você pode agrupá-las por categoria contábil ou aceitar todas as sugestões da IA com um clique.
          </p>
        </div>
      </div>

      {/* Rodapé / Mini Bento Indicators */}
      <div className="grid grid-cols-2 gap-2.5 pt-4 mt-4 border-t border-black/5 dark:border-white/10">
        <div className="rounded-xl bg-surface p-2.5 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
          <p className="rotulo text-ink-soft">A Conciliar</p>
          <p className="font-serif font-bold text-sm text-ink tabular mt-0.5">{transactions.length} itens</p>
        </div>
        <div className="rounded-xl bg-surface p-2.5 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
          <p className="rotulo text-ink-soft">Volume Aberto</p>
          <p className="font-serif font-bold text-sm text-ink tabular mt-0.5">{fmt(totalPendente)}</p>
        </div>
      </div>
    </Card>
  );
}
