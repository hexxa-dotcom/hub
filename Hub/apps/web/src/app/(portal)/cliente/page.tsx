import { Suspense } from 'react';
import { InicioView } from './InicioView';
import { Saudacao } from './Saudacao';
import { DetalhesData } from './resumo-mes/ResumoData';
import { ViewSwitcher } from './ViewSwitcher';
import { ClienteMonthSelector } from './ClienteMonthSelector';
import { VIEWS, DEFAULT_VIEW, type ViewId } from './views';
import { getTenantContext } from '@/lib/server/tenant';
import { pendenciasDoDia } from '@/lib/server/inicio';

export const dynamic = 'force-dynamic';

function isViewId(v: string | undefined): v is ViewId {
  return VIEWS.some((x) => x.id === v);
}

/**
 * INÍCIO — a visão geral da empresa, de todas as áreas.
 *
 * O cabeçalho já diz quantas coisas pedem você hoje. No Resumo: a lista do
 * que pede ação, o mês em números, cada área num relance e o faturamento de
 * 12 meses. Os Detalhes (analíticos) ficam na outra vista, pelo `?v=`.
 */
export default async function ClientePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; month?: string; m?: string }>;
}) {
  const { v, month, m } = await searchParams;
  const active: ViewId = isViewId(v) ? v : DEFAULT_VIEW;

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const currentMonthKey = `${hoje.slice(0, 7)}-01`;
  const paramMonth = month || m;
  const activeMonthKey = paramMonth && /^\d{4}-\d{2}/.test(paramMonth) ? `${paramMonth.slice(0, 7)}-01` : currentMonthKey;

  const dataPorExtenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
  const ctx = await getTenantContext();
  const pendencias = await pendenciasDoDia(ctx).catch(() => []);
  const vencidas = pendencias.filter((p) => p.tom === 'alerta').length;

  return (
    <div className="w-full space-y-12">
      <header className="w-fit min-w-0">
        <Saudacao />
        <div className="entrada-traco mt-2 h-px w-full bg-black/25 dark:bg-white/25" />
        <p className="entrada-subtitulo mt-2 text-sm text-ink-soft">
          {dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1)}
          {' · '}
          {pendencias.length === 0 ? (
            'tudo em dia hoje'
          ) : (
            <span className={vencidas ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-semibold text-ink'}>
              {pendencias.length} {pendencias.length === 1 ? 'coisa pede' : 'coisas pedem'} você hoje
            </span>
          )}
        </p>
      </header>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <ViewSwitcher active={active} />
        <ClienteMonthSelector currentMonthKey={currentMonthKey} selectedMonthKey={activeMonthKey} />
      </div>

      {active === 'resumo' ? (
        <Suspense key={`resumo-${activeMonthKey}`} fallback={<Esqueleto />}>
          <InicioView mes={activeMonthKey.slice(0, 7)} pendencias={pendencias} />
        </Suspense>
      ) : (
        <Suspense key={`${active}-${activeMonthKey}`} fallback={<Esqueleto />}>
          <DetalhesData selectedMonth={activeMonthKey} />
        </Suspense>
      )}
    </div>
  );
}

function Esqueleto() {
  const bloco = 'rounded-[28px] bg-black/[0.05] dark:bg-white/[0.05]';
  return (
    <div className="esqueleto space-y-16" aria-busy="true">
      <div className={`${bloco} h-56`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${bloco} h-36`} />
        ))}
      </div>
    </div>
  );
}
