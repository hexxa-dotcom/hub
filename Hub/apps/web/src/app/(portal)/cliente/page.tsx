import { Suspense } from 'react';
import { NumerosDoTopo } from './NumerosDoTopo';
import { InicioView } from './InicioView';
import { Saudacao } from './Saudacao';
import { DetalhesView } from './DetalhesView';
import { ViewSwitcher } from './ViewSwitcher';
import { ClienteMonthSelector } from './ClienteMonthSelector';
import { VIEWS, DEFAULT_VIEW, type ViewId } from './views';
import { InicioBasico } from './InicioBasico';
import { blocosDoPerfil, ehPerfil, type BlocoId } from './blocos';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { pendenciasDoDia } from '@/lib/server/inicio';
import {listarNovasGuiasParcelamento} from '@/lib/server/entregas';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function isViewId(v: string | undefined): v is ViewId {
  return VIEWS.some((x) => x.id === v);
}

/**
 * INÍCIO — a tela de entrada, de propósito diferente das outras.
 *
 * A saudação de um lado e, do outro, o dia da semana e a data; logo abaixo os
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
  const diaDoMes = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(agora);
  const diaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(agora);

  const ctx = await getTenantContext();
  const [pendencias, preferencia, novasParcelas] = await Promise.all([
    pendenciasDoDia(ctx).catch(() => []),
    getDb()
      .execute(sql`SELECT inicio_perfil AS perfil, inicio_blocos AS blocos FROM company WHERE id = ${ctx.companyId}`)
      .then((r) => (r as unknown as { perfil: string; blocos: string[] | null }[])[0])
      .catch(() => undefined),
    listarNovasGuiasParcelamento(ctx).catch(() => []),
  ]);
  const perfil = ehPerfil(preferencia?.perfil) ? preferencia.perfil : 'BASICO';
  const visiveis = blocosDoPerfil(perfil, preferencia?.blocos);
  const DO_TOPO: BlocoId[] = ['faturamento', 'resultado', 'ticket', 'despesas', 'atrasados', 'proximos-14', 'pede-hoje'];
  const temTopo = visiveis.some((b) => DO_TOPO.includes(b));
  const temMosaico = visiveis.some((b) => !DO_TOPO.includes(b));
  // No Básico não há "Detalhes": o essencial cabe numa tela só (InicioBasico).
  const vista: ViewId = active;

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
            {/* A contagem mora no cartão "Pede você hoje", logo abaixo — aqui não se repete. */}
            {pendencias.some((p) => p.tom === 'alerta') ? 'Tem coisa com prazo vencido — está logo abaixo.' : 'Aqui está a sua empresa hoje.'}
          </p>
        </div>
        <div className="entrada-subtitulo shrink-0 self-start sm:text-right">
          {/* O dia da semana discreto em cima e a data embaixo — sem temperatura. */}
          <p className="text-xs font-medium text-ink-soft sm:text-sm">{diaDaSemana.charAt(0).toUpperCase() + diaDaSemana.slice(1)}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{diaDoMes}</p>
        </div>
      </header>

      {novasParcelas.length>0 && <Link href="/minha-contabilidade/guias?aba=parcelamentos" className="focusable flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hexxa-lime/25 bg-hexxa-lime/10 p-4 text-sm text-ink"><span><strong>{novasParcelas.length===1?'Você tem uma nova guia de parcelamento disponível':`Você tem ${novasParcelas.length} novas guias de parcelamento disponíveis`}</strong><span className="mt-1 block text-xs text-ink-soft">A contabilidade enviou o PDF. Acesse para consultar ou baixar.</span></span><span className="text-xs font-semibold">Ver parcelamentos →</span></Link>}

      {perfil === 'BASICO' ? (
        <>
          <div className="flex justify-end">
            <ClienteMonthSelector currentMonthKey={currentMonthKey} selectedMonthKey={activeMonthKey} />
          </div>
          <Suspense key={`basico-${activeMonthKey}`} fallback={<Esqueleto />}>
            <InicioBasico mes={activeMonthKey.slice(0, 7)} pendencias={pendencias} />
          </Suspense>
        </>
      ) : (
      <>
      {temTopo && (
        <Suspense key={`topo-${activeMonthKey}-${visiveis.join()}`} fallback={<div className="esqueleto h-80 rounded-[28px] bg-black/[0.05] dark:bg-white/[0.05]" />}>
          <NumerosDoTopo mes={activeMonthKey.slice(0, 7)} pendencias={pendencias} visiveis={visiveis} />
        </Suspense>
      )}

      <div className="flex flex-col justify-between gap-4 pt-4 sm:flex-row sm:items-center">
        <ViewSwitcher active={vista} />
        <ClienteMonthSelector currentMonthKey={currentMonthKey} selectedMonthKey={activeMonthKey} />
      </div>

      {vista === 'resumo' ? (
        temMosaico && (
          <Suspense key={`resumo-${activeMonthKey}-${visiveis.join()}`} fallback={<Esqueleto />}>
            <InicioView pendencias={pendencias} visiveis={visiveis} />
          </Suspense>
        )
      ) : (
        <Suspense key={`${vista}-${activeMonthKey}`} fallback={<Esqueleto />}>
          <DetalhesView mes={activeMonthKey.slice(0, 7)} />
        </Suspense>
      )}
      </>
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
