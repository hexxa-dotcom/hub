import { Suspense } from 'react';
import { ResumoView } from './ResumoView';
import { MesHero } from './MesHero';
import { Saudacao } from './Saudacao';
import { DetalhesData } from './resumo-mes/ResumoData';
import { ViewSwitcher } from './ViewSwitcher';
import { ClienteMonthSelector } from './ClienteMonthSelector';
import { VIEWS, DEFAULT_VIEW, type ViewId } from './views';

export const dynamic = 'force-dynamic';

function isViewId(v: string | undefined): v is ViewId {
  return VIEWS.some((x) => x.id === v);
}

/**
 * Resumo do mês e Detalhes em uma tela só, trocadas por `?v=`.
 *
 * Resumo responde "o que preciso saber e fazer agora"; Detalhes guarda o que é
 * analítico e histórico. Como a vista vem da URL e não de estado de cliente, só
 * as consultas da vista pedida rodam — abrir o Resumo não paga o custo dos
 * Detalhes.
 */
export default async function ClientePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; month?: string; m?: string }>;
}) {
  const { v, month, m } = await searchParams;
  const active: ViewId = isViewId(v) ? v : DEFAULT_VIEW;

  // Formato padrão dos dados: YYYY-MM-01
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  // Parâmetro do mês selecionado (suporta '2026-09' ou '2026-09-01')
  const paramMonth = month || m;
  let activeMonthKey = currentMonthKey;
  if (paramMonth && /^\d{4}-\d{2}/.test(paramMonth)) {
    const [year, mon] = paramMonth.split('-');
    activeMonthKey = `${year}-${mon!.padStart(2, '0')}-01`;
  }

  const now = new Date();
  const weekdayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(now);

  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(now);

  return (
    <div className="relative w-full space-y-8">
      {/* Iluminação atmosférica verde e limão sutil sob os cards translúcidos do Dashboard */}
      <div className="pointer-events-none absolute -inset-x-6 -top-10 bottom-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 h-[520px] w-[520px] rounded-full bg-[#D4FF00]/16 dark:bg-[#D4FF00]/8 blur-[140px]" />
        <div className="absolute top-80 -left-12 h-[600px] w-[600px] rounded-full bg-emerald-500/14 dark:bg-emerald-500/6 blur-[160px]" />
        <div className="absolute bottom-20 right-10 h-[520px] w-[520px] rounded-full bg-emerald-700/12 dark:bg-emerald-700/5 blur-[150px]" />
      </div>

      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Saudacao />
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            Aqui está sua visão executiva em tempo real e saúde financeira da sua empresa.
          </p>
        </div>
        <div className="self-start sm:text-right shrink-0">
          <p className="text-xs sm:text-sm font-medium text-ink-soft">
            Hoje, {weekdayFormatted}
          </p>
          <p className="font-bold text-2xl sm:text-3xl text-ink tracking-tight mt-0.5">
            {dateFormatted}
          </p>
        </div>
      </header>

      {/* O total do mês fica acima do seletor porque é contexto das duas
          vistas: trocar entre Resumo e Detalhes muda o detalhamento, não o
          quanto entrou no mês. */}
      <Suspense fallback={<div className="h-56 rounded-3xl bg-line" />}>
        <MesHero selectedMonth={activeMonthKey} />
      </Suspense>

      {/* Barra de controle: Seleção de vista à esquerda + Seletor de mês à direita (mesma linha) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ViewSwitcher active={active} />
        <ClienteMonthSelector
          currentMonthKey={currentMonthKey}
          selectedMonthKey={activeMonthKey}
        />
      </div>

      {active === 'resumo' ? (
        <Suspense key={`resumo-${activeMonthKey}`} fallback={<ViewSkeleton />}>
          <ResumoView selectedMonth={activeMonthKey} />
        </Suspense>
      ) : (
        /* Suspense por vista: trocar de aba mostra o esqueleto da nova em vez
           de segurar a tela inteira em branco até a consulta voltar. */
        <Suspense key={`${active}-${activeMonthKey}`} fallback={<ViewSkeleton />}>
          <DetalhesData selectedMonth={activeMonthKey} />
        </Suspense>
      )}
    </div>
  );
}

function ViewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-48 rounded-3xl bg-line" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-64 rounded-3xl bg-line" />
        <div className="h-64 rounded-3xl bg-line lg:col-span-2" />
      </div>
    </div>
  );
}
