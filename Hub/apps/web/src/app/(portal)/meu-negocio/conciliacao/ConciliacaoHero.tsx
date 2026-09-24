'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ArrowLeft, Sparkles, Building2, ArrowRightLeft, FileCheck2 } from 'lucide-react';
import { SectionInfo } from '@/components/ui/SectionInfo';

interface ConciliacaoHeroProps {
  transactionsCount: number;
  entriesCount: number;
  contasCount: number;
}

export function ConciliacaoHero({
  transactionsCount,
  entriesCount,
  contasCount,
}: ConciliacaoHeroProps) {
  return (
    <Card
      level={1}
      className="hero-section-card relative z-30 py-4 sm:py-5 px-6 sm:px-8 rounded-[2rem] sm:rounded-full card-finish shadow-(--elev-1) border border-black/5 dark:border-white/10 transition-all"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 w-full">
        {/* Lado Esquerdo: Navegação, Título e Descrição - some no Modo Foco */}
        <div className="hero-title-block flex flex-col gap-2.5 min-w-0 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/meu-negocio/hub-financeiro"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors rounded-full bg-surface-card border border-black/5 dark:border-white/10 px-3 py-1 shadow-(--elev-1)"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Financeiro
            </Link>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 bg-hexxa-forest/10 dark:bg-hexxa-lime/10 text-hexxa-forest dark:text-hexxa-lime border border-hexxa-green/20">
              <Sparkles className="h-3 w-3" /> IA Conciliadora Ativa
            </span>
            <SectionInfo
              title="Sobre a Conciliação Bancária"
              description="A conciliação bancária cruza cada centavo que transitou pela conta do banco com as contas a pagar e a receber do Hub. A inteligência artificial classifica transações recorrentes e sugere correspondências para aprovação em lote."
            />
          </div>

          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-ink tracking-tight">
              Conciliação Bancária
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-ink-soft leading-relaxed">
              Importe seus extratos bancários, aprove sugestões inteligentes em lote e mantenha o caixa e a contabilidade da sua empresa 100% sincronizados.
            </p>
          </div>
        </div>

        {/* Lado Direito: Métricas Rápidas no Padrão Bento */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Métrica 1: Pendentes Extrato */}
          <div className="flex-1 sm:flex-initial min-w-[120px] rounded-2xl bg-surface p-3 sm:p-3.5 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Extrato</span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime opacity-70" />
            </div>
            <p className="mt-1 font-serif font-bold text-xl sm:text-2xl text-ink tabular">
              {transactionsCount}
            </p>
            <span className="text-[10px] text-ink-soft">
              {transactionsCount === 0 ? 'tudo conciliado' : 'a conciliar'}
            </span>
          </div>

          {/* Métrica 2: Lançamentos no Hub */}
          <div className="flex-1 sm:flex-initial min-w-[120px] rounded-2xl bg-surface p-3 sm:p-3.5 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Lançamentos</span>
              <FileCheck2 className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime opacity-70" />
            </div>
            <p className="mt-1 font-serif font-bold text-xl sm:text-2xl text-ink tabular">
              {entriesCount}
            </p>
            <span className="text-[10px] text-ink-soft">no sistema</span>
          </div>

          {/* Métrica 3: Contas Cadastradas */}
          <div className="flex-1 sm:flex-initial min-w-[110px] rounded-2xl bg-surface p-3 sm:p-3.5 border border-black/5 dark:border-white/5 shadow-(--elev-inset)">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Contas</span>
              <Building2 className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime opacity-70" />
            </div>
            <p className="mt-1 font-serif font-bold text-xl sm:text-2xl text-ink tabular">
              {contasCount}
            </p>
            <span className="text-[10px] text-ink-soft">ativas</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
