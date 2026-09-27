import Link from 'next/link';
import type { Route } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { detalhesDoMes } from '@/lib/server/detalhes';
import { Anel, PontosTendencia } from '@/components/inicio/graficos';
import { Cascata, MosaicoDeCategorias, CalendarioDoCaixa, BarrasRadiais, ReguaDoSimples } from '@/components/inicio/graficos-do-mes';
import { Cartao } from './Cartao';
import { ProgramacaoDoMes } from './ProgramacaoDoMes';

/**
 * OS DETALHES DA INÍCIO — o mês escolhido a fundo.
 *
 * O topo da tela já diz quanto; aqui é o porquê, em mosaico: a cascata do
 * resultado, o mosaico das despesas, o calendário do caixa, quem comprou, a
 * régua do Simples e a programação. Nenhum número é inventado para tapar
 * buraco — sem dado, o cartão diz que não há.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const taxa = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const numero = 'font-serif text-2xl font-bold tracking-tight tabular text-ink';
const vazio = 'grid flex-1 place-items-center py-8 text-center text-xs text-ink-soft';

export async function DetalhesView({ mes }: { mes: string }) {
  const ctx = await getTenantContext();
  const d = await detalhesDoMes(ctx, mes);
  const r = d.resultado;
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const nomeDoMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const temResultado = r.notas > 0 || r.despesas > 0 || r.prolabore > 0;
  const degraus = [
    { rotulo: 'Notas', valor: r.notas, tipo: 'inicio' as const },
    { rotulo: 'Imposto', valor: r.imposto, tipo: 'sai' as const },
    ...(r.prolabore > 0 ? [{ rotulo: 'Pró-labore', valor: r.prolabore, tipo: 'sai' as const }] : []),
    { rotulo: 'Despesas', valor: r.despesas, tipo: 'sai' as const },
    { rotulo: 'Resultado', valor: r.lucro, tipo: 'fim' as const },
  ];

  const totalClientes = d.clientes.reduce((s, c) => s + c.valor, 0);
  const top = d.clientes.slice(0, 3);
  const outros = d.clientes.slice(3);
  const fatias = [
    ...top.map((c) => ({ rotulo: c.nome, fracao: totalClientes ? c.valor / totalClientes : 0 })),
    ...(outros.length ? [{ rotulo: `${outros.length} outros`, fracao: outros.reduce((s, c) => s + c.valor, 0) / (totalClientes || 1) }] : []),
  ];
  const concentrado = fatias[0] && top.length && fatias[0].fracao > 0.5 && d.clientes.length > 1;

  const entraMes = d.dias.reduce((s, x) => s + x.entra, 0);
  const saiMes = d.dias.reduce((s, x) => s + x.sai, 0);
  const totalDespesas = d.categorias.reduce((s, c) => s + c.valor, 0);
  const s = d.simples;
  const dentroDaFaixa = s && s.faixaMax > s.faixaMin ? (s.rbt12 - s.faixaMin) / (s.faixaMax - s.faixaMin) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="rotulo text-ink-soft">
          {nomeDoMes} · {d.fechado ? 'mês fechado pela contabilidade' : 'em apuração'}
        </p>
        <Link
          href={`/meu-negocio/relatorios/fechamento?month=${mes}-01` as Route}
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
        >
          Relatório completo <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="entrada-grade grid grid-flow-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {/* Resultado — a cascata, de onde sai e para onde vai. */}
        <Cartao rotulo="Resultado do mês" href="/meu-negocio/relatorios/balanco" className="sm:col-span-2 lg:col-span-7">
          {!d.noHistorico ? (
            <p className={vazio}>Os relatórios guardam os últimos 12 meses — este ficou de fora.</p>
          ) : !temResultado ? (
            <p className={vazio}>Nenhuma nota nem despesa lançada neste mês.</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className={`${numero} ${r.lucro < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{BRL.format(r.lucro)}</p>
                  <p className="text-xs text-ink-soft">
                    {r.lucro >= 0 ? 'sobrou' : 'faltou'} no mês{r.margem !== null ? ` · margem de ${pct(r.margem)}` : ''}
                  </p>
                </div>
                {d.lucro6.length > 1 && (
                  <div className="w-32" title="Resultado dos últimos 6 meses">
                    <PontosTendencia valores={d.lucro6.map((x) => x.valor)} />
                    <p className="mt-1 text-right text-[11px] text-ink-soft">últimos 6 meses</p>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Cascata degraus={degraus} />
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">
                Imposto pela alíquota do seu faturamento.
                {r.distribuido > 0 ? ` ${BRL.format(r.distribuido)} já foram distribuídos aos sócios.` : ''}
                {r.outrasEntradas > 0 ? ` ${BRL.format(r.outrasEntradas)} entraram sem nota e não contam como faturamento.` : ''}
              </p>
            </>
          )}
        </Cartao>

        {/* Para onde foi o dinheiro — o mosaico. */}
        <Cartao rotulo="Para onde foi o dinheiro" href="/meu-negocio/hub-financeiro" className="sm:col-span-2 lg:col-span-5">
          {d.categorias.length === 0 ? (
            <p className={vazio}>Nenhuma despesa lançada neste mês.</p>
          ) : (
            <>
              <p className={`mt-2 ${numero}`}>{BRL.format(totalDespesas)}</p>
              <p className="text-xs text-ink-soft">
                em despesas, {d.categorias.length} {d.categorias.length === 1 ? 'categoria' : 'categorias'}
              </p>
              <div className="mt-4 flex-1">
                <MosaicoDeCategorias categorias={d.categorias} />
              </div>
            </>
          )}
        </Cartao>

        {/* O caixa dia a dia — o calendário. */}
        <Cartao rotulo="O caixa dia a dia" className="sm:col-span-2 lg:col-span-7">
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-400" /> entra {BRL.format(entraMes)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-rose-400" /> sai {BRL.format(saiMes)}
            </span>
            <span>quanto mais forte, maior o valor do dia</span>
          </div>
          <div className="mt-4">
            <CalendarioDoCaixa mes={mes} dias={d.dias} hoje={hoje} />
          </div>
        </Cartao>

        {/* Quem comprou — barras radiais, pelas notas. */}
        <Cartao rotulo="Quem comprou no mês" href="/relacionamento" className="sm:col-span-2 lg:col-span-5">
          {d.clientes.length === 0 ? (
            <p className={vazio}>Nenhuma nota emitida neste mês.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-5">
                <BarrasRadiais fatias={fatias} />
                <ul className="space-y-2.5">
                  {fatias.map((f, i) => (
                    <li key={f.rotulo} className="min-w-0">
                      <p className={`truncate text-sm ${i === 0 ? 'font-semibold text-ink' : 'text-ink'}`}>{f.rotulo}</p>
                      <p className="text-xs tabular text-ink-soft">
                        {pct(f.fracao)} · {BRL.format(i < top.length ? top[i]!.valor : outros.reduce((s2, c) => s2 + c.valor, 0))}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <p className={`mt-auto pt-4 text-[11px] ${concentrado ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-ink-soft'}`}>
                {concentrado
                  ? `Mais da metade do faturamento veio de um cliente só — vale diversificar.`
                  : `${d.clientes.length} ${d.clientes.length === 1 ? 'cliente' : 'clientes'} com nota no mês.`}
              </p>
            </>
          )}
        </Cartao>

        {/* Simples Nacional — a régua das faixas. */}
        <Cartao rotulo="Posição no Simples Nacional" href="/minha-contabilidade/termometro-tributario" className="sm:col-span-2 lg:col-span-12">
          {!s ? (
            <p className={vazio}>Não foi possível calcular a posição no Simples agora.</p>
          ) : (
            <div className="mt-3 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <p className={numero}>{BRL.format(s.rbt12)}</p>
                  <p className="text-xs text-ink-soft">faturados nos últimos 12 meses · {pct(s.ceilingUsagePct)} do teto</p>
                </div>
                <div className="mt-8 px-2">
                  {s.projecaoConfiavel ? (
                    <ReguaDoSimples faixa={s.faixa} dentro={dentroDaFaixa} />
                  ) : (
                    <p className="text-xs text-ink-soft">Faixas do Anexo {s.anexo} ainda não estão na Hexx — a régua aparece para os Anexos III e V.</p>
                  )}
                </div>
                <p className="mt-3 text-xs text-ink-soft">
                  {!s.projecaoConfiavel
                    ? ''
                    : s.toNextFaixa !== null
                      ? `Faltam ${BRL.format(s.toNextFaixa)} para a ${s.faixa + 1}ª faixa, quando a alíquota nominal sobe de ${taxa(s.nominalRate)} para ${taxa(s.nextRate ?? 0)}.`
                      : 'Você está na última faixa — atenção ao teto de R$ 4,8 milhões.'}
                </p>
              </div>
              <div className="flex items-center gap-6 lg:border-l lg:border-black/[0.06] lg:pl-6 dark:lg:border-white/[0.08]">
                <div className="w-24 text-center">
                  {/* Sem faturamento nos 12 meses o Fator R não existe — a conta daria 100%. */}
                  <Anel
                    fracao={s.rbt12 > 0 ? Math.min(1, s.fatorR / 0.28) : 0}
                    cor={s.fatorR >= 0.28 ? '#34d399' : '#f5b544'}
                    rotulo={s.rbt12 > 0 ? pct(s.fatorR) : '—'}
                  />
                  <p className="mt-1 text-[11px] text-ink-soft">Fator R</p>
                </div>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-ink-soft">Anexo</dt>
                    <dd className="font-semibold text-ink">{s.anexo}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Alíquota efetiva</dt>
                    <dd className="font-semibold tabular text-ink">{taxa(s.effectiveRate)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Fonte</dt>
                    <dd className="text-ink">{s.fonte === 'APURADO' ? 'apuração da contabilidade' : 'estimativa da Hexx'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </Cartao>
      </div>

      <section className="pt-4">
        <ProgramacaoDoMes itens={d.compromissos} />
      </section>
    </div>
  );
}
