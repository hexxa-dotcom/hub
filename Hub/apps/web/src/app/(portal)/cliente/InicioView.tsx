import Link from 'next/link';
import type { Route } from 'next';
import { getTenantContext } from '@/lib/server/tenant';
import { pendenciasDoDia, mesEmNumeros, areasNumRelance, type Pendencia } from '@/lib/server/inicio';
import { faturamentoMensal } from '@/lib/server/bussola';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { GraficoFaturamento } from '../minha-contabilidade/termometro-tributario/GraficoFaturamento';
import { PendenciasDoDia } from './PendenciasDoDia';

/**
 * A Início: a visão geral da empresa. O que pede você hoje, o mês em números,
 * cada área num relance e o faturamento de 12 meses — nesta ordem, porque é a
 * ordem das perguntas de quem abre o sistema de manhã.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
const NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export async function InicioView({ mes, pendencias }: { mes: string; pendencias: Pendencia[] }) {
  const ctx = await getTenantContext();
  const [n, areas, serie] = await Promise.all([mesEmNumeros(ctx, mes), areasNumRelance(ctx), faturamentoMensal(ctx).catch(() => [])]);
  const variacao = n.faturadoAnterior > 0 ? ((n.faturado - n.faturadoAnterior) / n.faturadoAnterior) * 100 : null;
  const saldo14 = n.caixa14.entra - n.caixa14.sai;
  const nomeDoMes = NOMES[Number(mes.slice(5)) - 1];
  const temNotas = serie.some((m) => m.valor > 0);

  return (
    <div className="space-y-16">
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="rotulo text-ink-soft">O que pede você hoje</p>
          {pendencias.length > 0 && (
            <p className="text-xs text-ink-soft">
              {pendencias.filter((p) => p.tom === 'alerta').length} com prazo vencido · {pendencias.filter((p) => p.tom === 'atencao').length} para os próximos dias
            </p>
          )}
        </div>
        <PendenciasDoDia itens={pendencias} />
      </section>

      <section className="space-y-4">
        <p className="rotulo text-ink-soft">{`${nomeDoMes!.charAt(0).toUpperCase()}${nomeDoMes!.slice(1)} em números`}</p>
        <GradeDeResumo colunas={4}>
          <CardResumo
            destaque
            rotulo="Faturado no mês"
            valor={BRL.format(n.faturado)}
            nota={`${n.notas} ${n.notas === 1 ? 'nota' : 'notas'}${variacao !== null ? ` · ${pct(variacao)} sobre o mês anterior` : ''}`}
            href="/meu-negocio/notas"
          />
          <CardResumo
            rotulo="Imposto previsto"
            valor={BRL.format(n.imposto)}
            nota={`${n.aliquota.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% sobre o faturado`}
            href="/minha-contabilidade/termometro-tributario"
          />
          <CardResumo
            rotulo="Resultado do mês"
            valor={BRL.format(n.resultado)}
            tom={n.resultado < 0 ? 'negativo' : 'padrao'}
            nota="Faturado menos despesas, pró-labore e imposto"
            href="/meu-negocio/relatorios/balanco"
          />
          <CardResumo
            rotulo="Próximos 14 dias"
            valor={`${saldo14 >= 0 ? '' : '− '}${BRL.format(Math.abs(saldo14))}`}
            tom={saldo14 < 0 ? 'negativo' : 'padrao'}
            nota={`Entra ${BRL.format(n.caixa14.entra)} · sai ${BRL.format(n.caixa14.sai)}`}
            href="/meu-negocio/hub-financeiro?aba=agenda"
          />
        </GradeDeResumo>
      </section>

      <section className="space-y-4">
        <p className="rotulo text-ink-soft">Cada área num relance</p>
        <div className="entrada-grade grid grid-cols-2 gap-3 lg:grid-cols-4">
          {areas.map((a) => (
            <Link
              key={a.area}
              href={a.href as Route}
              className="group rounded-[24px] border border-white/70 bg-white/75 p-5 ring-1 ring-inset ring-white/60 backdrop-blur-xl transition-colors hover:bg-white/90 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5 dark:hover:bg-[#1b201c]/85"
            >
              <p className="rotulo text-ink-soft">{a.area}</p>
              <p className="mt-2 truncate font-serif text-xl font-bold tabular text-ink">{a.numero}</p>
              <p className="truncate text-xs text-ink-soft">{a.linha}</p>
              {a.extra && <p className="mt-3 truncate text-xs text-ink group-hover:underline group-hover:underline-offset-4">{a.extra}</p>}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="rotulo text-ink-soft">Faturamento · 12 meses</p>
          <Link href="/meu-negocio/relatorios/faturamento" className="text-xs font-semibold text-ink-soft hover:text-ink">
            Ver relatório
          </Link>
        </div>
        {temNotas ? (
          <GraficoFaturamento meses={serie} />
        ) : (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-10 text-center text-sm text-ink-soft dark:border-white/10">
            Ainda sem notas nos últimos 12 meses. O gráfico aparece com a primeira nota emitida.
          </p>
        )}
      </section>
    </div>
  );
}
