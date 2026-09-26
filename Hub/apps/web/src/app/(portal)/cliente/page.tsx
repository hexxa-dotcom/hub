import { Suspense } from 'react';
import { NumerosDoTopo } from './NumerosDoTopo';
import { InicioView } from './InicioView';
import { Saudacao } from './Saudacao';
import { Relogio } from './Relogio';
import { DetalhesData } from './resumo-mes/ResumoData';
import { ViewSwitcher } from './ViewSwitcher';
import { ClienteMonthSelector } from './ClienteMonthSelector';
import { VIEWS, DEFAULT_VIEW, type ViewId } from './views';
import { getTenantContext } from '@/lib/server/tenant';
import { pendenciasDoDia } from '@/lib/server/inicio';
import { climaDaEmpresa } from '@/lib/server/clima';

export const dynamic = 'force-dynamic';

function isViewId(v: string | undefined): v is ViewId {
  return VIEWS.some((x) => x.id === v);
}

/**
 * INÍCIO — a tela de entrada, de propósito diferente das outras.
 *
 * A saudação de um lado e o dia, a hora e o tempo do outro; logo abaixo os
 * números principais da empresa; e, descendo, o Resumo (o que pede você hoje
 * e cada área em mosaico) ou os Detalhes, pelo `?v=`.
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

  const agora = new Date();
  const diaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(agora);
  const diaDoMes = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(agora);

  const ctx = await getTenantContext();
  const [pendencias, clima] = await Promise.all([pendenciasDoDia(ctx).catch(() => []), climaDaEmpresa(ctx)]);

  return (
    <div className="relative w-full space-y-8">
      {/* A luz verde e limão por trás dos cards translúcidos — só a Início tem. */}
      <div className="pointer-events-none absolute -inset-x-6 -top-10 bottom-0 -z-10 overflow-hidden">
        <div className="absolute right-1/4 top-0 h-[520px] w-[520px] rounded-full bg-[#D4FF00]/16 blur-[140px] dark:bg-[#D4FF00]/8" />
        <div className="absolute -left-12 top-80 h-[600px] w-[600px] rounded-full bg-emerald-500/14 blur-[160px] dark:bg-emerald-500/6" />
        <div className="absolute bottom-20 right-10 h-[520px] w-[520px] rounded-full bg-emerald-700/12 blur-[150px] dark:bg-emerald-700/5" />
      </div>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Saudacao />
          <p className="entrada-subtitulo mt-1 text-xs text-ink-soft sm:text-sm">
            {pendencias.length === 0
              ? 'Tudo em dia na sua empresa hoje.'
              : `${pendencias.length} ${pendencias.length === 1 ? 'coisa pede' : 'coisas pedem'} você hoje — estão no resumo, logo abaixo.`}
          </p>
        </div>
        <div className="entrada-subtitulo shrink-0 self-start sm:text-right">
          <p className="text-xs font-medium text-ink-soft sm:text-sm">
            Hoje, {diaDaSemana} · <Relogio />
            {clima && (
              <>
                {' · '}
                <span title={`${clima.cidade}${clima.descricao ? `, ${clima.descricao}` : ''}`}>
                  {clima.temperatura}° {clima.descricao ? clima.descricao : ''} em {clima.cidade}
                </span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{diaDoMes}</p>
        </div>
      </header>

      <Suspense key={`topo-${activeMonthKey}`} fallback={<div className="esqueleto h-80 rounded-[28px] bg-black/[0.05] dark:bg-white/[0.05]" />}>
        <NumerosDoTopo mes={activeMonthKey.slice(0, 7)} />
      </Suspense>

      <div className="flex flex-col justify-between gap-4 pt-4 sm:flex-row sm:items-center">
        <ViewSwitcher active={active} />
        <ClienteMonthSelector currentMonthKey={currentMonthKey} selectedMonthKey={activeMonthKey} />
      </div>

      {active === 'resumo' ? (
        <Suspense key={`resumo-${activeMonthKey}`} fallback={<Esqueleto />}>
          <InicioView pendencias={pendencias} />
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
    <div className="esqueleto grid gap-4 lg:grid-cols-6" aria-busy="true">
      <div className={`${bloco} h-56 lg:col-span-6`} />
      <div className={`${bloco} h-72 lg:col-span-3`} />
      <div className={`${bloco} h-72 lg:col-span-3`} />
    </div>
  );
}
