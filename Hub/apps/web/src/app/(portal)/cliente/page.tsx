import { Suspense } from 'react';
import { ResumoView } from './ResumoView';
import { MesHero } from './MesHero';
import { Saudacao } from './Saudacao';
import { DetalhesData } from './resumo-mes/ResumoData';
import { ViewSwitcher } from './ViewSwitcher';
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
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const active: ViewId = isViewId(v) ? v : DEFAULT_VIEW;

  const dateFormatted = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());

  return (
    <div className="mx-auto w-full space-y-8 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <Saudacao />
        <p className="text-footnote text-ink-soft">{dateFormatted}</p>
      </header>

      {/* O total do mês fica acima do seletor porque é contexto das duas
          vistas: trocar entre Resumo e Detalhes muda o detalhamento, não o
          quanto entrou no mês. */}
      <Suspense fallback={<div className="h-56 rounded-3xl bg-line" />}>
        <MesHero />
      </Suspense>

      <ViewSwitcher active={active} />

      {active === 'resumo' ? (
        <ResumoView />
      ) : (
        /* Suspense por vista: trocar de aba mostra o esqueleto da nova em vez
           de segurar a tela inteira em branco até a consulta voltar. */
        <Suspense key={active} fallback={<ViewSkeleton />}>
          <DetalhesData />
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
