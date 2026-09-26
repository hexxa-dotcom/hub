import { getTenantContext } from '@/lib/server/tenant';
import { areasDaEmpresa, type Pendencia } from '@/lib/server/inicio';
import { faturamentoMensal } from '@/lib/server/bussola';
import { ArcoDividido, Medidor, BolhasDoMes, DonutFatias, EspiralDoAno, FunilCirculos, LinhaDoTempo } from '@/components/inicio/graficos';
import { Cartao } from './Cartao';
import { PendenciasDoDia } from './PendenciasDoDia';

/**
 * O RESUMO DA INÍCIO — o que pede você hoje e a empresa inteira em mosaico.
 *
 * O mosaico é de propósito irregular: cada área tem o tamanho e o desenho do
 * que ela tem para contar — arco dividido no financeiro, barra segmentada nos
 * clientes, medidor no imposto, bolhas nas notas, donut nos documentos, a
 * espiral do ano, o funil das propostas e a linha do tempo dos contratos.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

const numero = 'font-serif text-2xl font-bold tracking-tight tabular text-ink';

export async function InicioView({ pendencias }: { pendencias: Pendencia[] }) {
  const ctx = await getTenantContext();
  const [a, serie] = await Promise.all([areasDaEmpresa(ctx), faturamentoMensal(ctx).catch(() => [])]);
  const { financeiro: fi, clientes: cl, documentos: docs } = a;
  const totalClientes = cl.recorrentes + cl.avulsos + cl.inativos;
  const saldo = fi.receber - fi.pagar;
  const emDia = docs.filter((d) => d.situacao === 'EM_DIA').length;
  const serie12 = serie.slice(-12).map((m) => m.valor);
  const hojeSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const diasNoMes = new Date(hojeSP.getFullYear(), hojeSP.getMonth() + 1, 0).getDate();
  const COR_DOC = { EM_DIA: '#34d399', VENCE_EM_BREVE: '#f5b544', VENCIDO: '#e11d48', FALTA: 'rgba(127,127,127,.25)' } as const;

  return (
    <div className="space-y-10">
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
        <p className="rotulo text-ink-soft">A empresa num relance</p>
        <div className="entrada-grade grid grid-flow-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {/* Financeiro — o arco dividido: o que falta receber e o que falta pagar. */}
          <Cartao rotulo="Financeiro do mês" href="/meu-negocio/hub-financeiro" className="sm:col-span-2 lg:col-span-4 lg:row-span-2">
            <div className="mx-auto mt-4 w-full max-w-[240px]">
              <ArcoDividido a={fi.receber} b={fi.pagar} centro={`${saldo < 0 ? '− ' : ''}${BRL.format(Math.abs(saldo))}`} sub={saldo >= 0 ? 'sobra no mês' : 'falta no mês'} />
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> a receber {BRL.format(fi.receber)}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> a pagar {BRL.format(fi.pagar)}</span>
            </div>
            <p className="mt-auto pt-4 text-center text-[11px] text-ink-soft">
              {BRL.format(fi.recebido)} já recebido e {BRL.format(fi.pago)} já pago no mês
            </p>
          </Cartao>

          {/* Clientes — a barra segmentada (aprovada). */}
          <Cartao rotulo="Clientes" href="/relacionamento" className="sm:col-span-2 lg:col-span-5">
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={numero}>{cl.recorrentes + cl.avulsos}</p>
                <p className="text-xs text-ink-soft">ativos de {totalClientes}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {(
                  [
                    ['Recorrentes', cl.recorrentes, 'bg-emerald-500'],
                    ['Avulsos', cl.avulsos, 'bg-amber-500'],
                    ['Inativos', cl.inativos, 'bg-black/20 dark:bg-white/25'],
                  ] as const
                ).map(([r, n, c]) => (
                  <span key={r} className="inline-flex items-center gap-1.5 text-ink-soft">
                    <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
                    <span className="font-semibold tabular text-ink">{n}</span> {r.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-auto flex h-2 gap-0.5 overflow-hidden rounded-full bg-black/[0.06] pt-0 dark:bg-white/[0.08]">
              {totalClientes > 0 &&
                (
                  [
                    [cl.recorrentes, 'bg-emerald-500'],
                    [cl.avulsos, 'bg-amber-500'],
                    [cl.inativos, 'bg-black/20 dark:bg-white/25'],
                  ] as const
                ).map(([n, c], i) => (n > 0 ? <div key={i} className={`${c} grafico-surge`} style={{ flexGrow: n }} /> : null))}
            </div>
          </Cartao>

          {/* Imposto — medidor pequeno. */}
          <Cartao rotulo="Imposto" href="/minha-contabilidade/termometro-tributario" className="lg:col-span-3">
            <div className="mx-auto mt-2 w-28">
              <Medidor fracao={a.impostos.aliquota / 20} rotulo={`${a.impostos.aliquota.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`} />
            </div>
            <p className="text-center text-xs text-ink-soft">
              alíquota {a.impostos.apurada ? 'apurada' : 'estimada'}
              {a.impostos.proximaGuia ? ` · guia em ${br(a.impostos.proximaGuia.vencimento)}` : ''}
            </p>
          </Cartao>

          {/* Notas — bolhas no dia em que cada nota saiu. */}
          <Cartao rotulo="Notas do mês" href="/meu-negocio/notas" className="sm:col-span-2 lg:col-span-5">
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <p className={numero}>{BRL.format(a.notas.valor)}</p>
              <p className="text-xs text-ink-soft">
                {a.notas.quantidade} {a.notas.quantidade === 1 ? 'nota' : 'notas'}
                {a.notas.ultima ? ` · última em ${br(a.notas.ultima)}` : ''}
              </p>
            </div>
            <div className="mt-auto pt-2">
              {a.notasPontos.length ? (
                <BolhasDoMes pontos={a.notasPontos} diasNoMes={diasNoMes} />
              ) : (
                <p className="py-3 text-center text-xs text-ink-soft">Nenhuma nota emitida no mês ainda</p>
              )}
            </div>
          </Cartao>

          {/* Documentos — donut em fatias, uma por documento essencial. */}
          <Cartao rotulo="Documentos" href="/minha-contabilidade/arquivos" className="lg:col-span-3">
            <div className="mx-auto mt-1 w-24">
              <DonutFatias cores={docs.map((d) => COR_DOC[d.situacao])} centro={`${emDia}/${docs.length}`} />
            </div>
            <p className="text-center text-xs text-ink-soft">{emDia === docs.length ? 'todos em dia' : `${docs.length - emDia} para resolver`}</p>
          </Cartao>

          {/* O ano em espiral. */}
          <Cartao rotulo="O ano em espiral" href="/meu-negocio/relatorios/faturamento" className="lg:col-span-4">
            <div className="mx-auto mt-1 w-36">
              <EspiralDoAno valores={serie12} />
            </div>
            <p className="text-center text-xs text-ink-soft">faturamento de cada mês, girando até o atual</p>
          </Cartao>

          {/* Propostas — funil em círculos. */}
          <Cartao rotulo="Propostas" href="/meu-negocio/propostas" className="lg:col-span-3">
            <p className={`mt-2 ${numero}`}>{BRL.format(a.propostas.emNegociacao)}</p>
            <p className="text-xs text-ink-soft">em negociação</p>
            <div className="mt-auto pt-3">
              <FunilCirculos
                etapas={[
                  { rotulo: 'enviadas', n: a.propostas.enviadas },
                  { rotulo: 'vistas', n: a.propostas.vistas },
                  { rotulo: 'aceitas', n: a.propostas.aceitas },
                ]}
              />
            </div>
          </Cartao>

          {/* Contratos — linha do tempo de quando terminam. */}
          <Cartao rotulo="Contratos" href="/meu-negocio/contratos" className="lg:col-span-3">
            <p className={`mt-2 ${numero}`}>
              {BRL.format(a.contratos.porMes)}
              <span className="font-sans text-xs font-normal text-ink-soft">/mês</span>
            </p>
            <p className="text-xs text-ink-soft">
              {a.contratos.ativos} {a.contratos.ativos === 1 ? 'ativo' : 'ativos'}
              {a.contratos.terminando ? ` · ${a.contratos.terminando} terminam em 60 dias` : ''}
            </p>
            <div className="mt-auto pt-3">
              <LinhaDoTempo pontos={a.contratosFim.map((c) => ({ fracao: c.fracao, cor: c.logo ? '#f5b544' : '#34d399', titulo: c.titulo }))} />
            </div>
          </Cartao>

          {/* Pessoas — avatares. */}
          <Cartao rotulo="Pessoas" href="/minha-contabilidade/socios" className="lg:col-span-2">
            <div className="mt-3 flex">
              {a.iniciais.slice(0, 3).map((ini, i) => (
                <span
                  key={i}
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-semibold dark:border-[#151916] ${
                    i === 0 ? 'bg-hexxa-forest text-hexxa-lime' : 'bg-black/[0.06] text-ink dark:bg-white/10'
                  } ${i ? '-ml-2' : ''}`}
                >
                  {ini}
                </span>
              ))}
              {a.iniciais.length > 3 && (
                <span className="-ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-black/[0.06] text-[10px] font-semibold text-ink dark:border-[#151916] dark:bg-white/10">
                  +{a.iniciais.length - 3}
                </span>
              )}
            </div>
            <p className="mt-auto pt-3 font-serif text-lg font-bold tabular text-ink">
              {BRL.format(a.pessoas.custoMensal)}
              <span className="font-sans text-xs font-normal text-ink-soft">/mês</span>
            </p>
          </Cartao>
        </div>
      </section>
    </div>
  );
}
