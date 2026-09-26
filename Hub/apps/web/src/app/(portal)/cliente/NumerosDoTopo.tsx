import { getTenantContext } from '@/lib/server/tenant';
import { numerosDoTopo } from '@/lib/server/inicio';
import { getAvailableProfitAction } from '@/lib/server/profit-distribution';
import { AreaSuave, Anel, PontosTendencia, MeiaLua, AneisConcentricos, Fluxo } from '@/components/inicio/graficos';
import { Cartao } from './Cartao';

/**
 * OS NÚMEROS PRINCIPAIS — o topo da Início, em mosaico.
 *
 * Faturamento maior (a área suave dos 12 meses, só nota fiscal); o resultado
 * num anel com a margem; o ticket médio em pontos; as despesas numa meia-lua
 * de pago e em aberto; o atraso em anéis por faixa; e os próximos 14 dias num
 * fluxo — entra em cima, sai embaixo.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => `${NOMES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export async function NumerosDoTopo({ mes }: { mes: string }) {
  const ctx = await getTenantContext();
  const lucro = await getAvailableProfitAction().catch(() => null);
  const n = await numerosDoTopo(ctx, mes, lucro?.availableToDistribute ?? 0);

  const variacao = n.faturadoAnterior > 0 ? Math.round(((n.faturado - n.faturadoAnterior) / n.faturadoAnterior) * 100) : null;
  const ticket = n.notas > 0 ? n.faturado / n.notas : 0;
  const ticketAnt = n.ticketSerie[5] ?? 0;
  const varTicket = ticketAnt > 0 && ticket > 0 ? Math.round(((ticket - ticketAnt) / ticketAnt) * 100) : null;
  const margem = n.faturado > 0 ? n.resultado / n.faturado : 0;
  const margemMedivel = n.faturado > 0 && Math.abs(margem) <= 10;
  const totalDesp = n.despesas.pagas + n.despesas.abertas;
  const totalAtraso = n.atraso.ate15 + n.atraso.ate60 + n.atraso.mais60;
  const entra14 = n.proximos14.entradas.reduce((s, v) => s + v, 0);
  const sai14 = n.proximos14.saidas.reduce((s, v) => s + v, 0);
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

  return (
    <div className="entrada-grade grid grid-flow-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
      {/* Faturamento — o maior. */}
      <Cartao rotulo="Faturamento do mês" href="/meu-negocio/notas" destaque className="sm:col-span-2 lg:col-span-5 lg:row-span-2">
        <p className="mt-3 font-serif text-4xl font-extrabold leading-none tracking-tight text-[#D4FF00] tabular sm:text-5xl">{BRL.format(n.faturado)}</p>
        <p className="mt-2 text-xs text-white/70">
          {variacao === null ? 'Sem notas no mês anterior para comparar' : `${variacao >= 0 ? '+' : '−'}${Math.abs(variacao)}% sobre o mês anterior`} · {n.notas}{' '}
          {n.notas === 1 ? 'nota' : 'notas'}
        </p>
        <div className="mt-auto pt-6">
          <AreaSuave valores={n.serie.map((s) => s.valor)} id="fat12" />
          <div className="mt-1 flex justify-between text-[11px] text-white/55">
            <span>{rotuloMes(n.serie[0]!.mes)}</span>
            <span>12 meses · só nota fiscal</span>
            <span>{rotuloMes(n.serie[11]!.mes)}</span>
          </div>
        </div>
      </Cartao>

      {/* Resultado — anel com a margem. */}
      <Cartao rotulo="Resultado do mês" href="/meu-negocio/relatorios/balanco" className="lg:col-span-4">
        <div className="mt-2 flex items-center gap-4">
          <div className="w-24 shrink-0">
            <Anel fracao={margemMedivel ? Math.max(0, margem) : 0} cor={n.resultado < 0 ? '#fb7185' : '#34d399'} rotulo={margemMedivel ? `${Math.round(margem * 100)}%` : '—'} />
          </div>
          <div className="min-w-0">
            <p className={`font-serif text-2xl font-bold tracking-tight tabular ${n.resultado < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink'}`}>{BRL.format(n.resultado)}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {margemMedivel ? 'margem depois de despesas, pró-labore e imposto' : 'depois de despesas, pró-labore e imposto'}
              {n.paraDistribuir > 0 ? ` · ${BRL.format(n.paraDistribuir)} para distribuir` : ''}
            </p>
          </div>
        </div>
      </Cartao>

      {/* Ticket médio — pontos de tendência. */}
      <Cartao rotulo="Ticket médio" href="/meu-negocio/relatorios/faturamento-por-cliente" className="lg:col-span-3">
        <p className="mt-2 font-serif text-2xl font-bold tracking-tight tabular text-ink">{BRL.format(ticket)}</p>
        <p className="text-xs text-ink-soft">
          por nota{varTicket !== null ? ` · ${varTicket >= 0 ? '+' : '−'}${Math.abs(varTicket)}%` : ''}
        </p>
        <div className="mt-auto pt-3">
          <PontosTendencia valores={n.ticketSerie} />
        </div>
      </Cartao>

      {/* Despesas — meia-lua. */}
      <Cartao rotulo="Despesas do mês" href="/meu-negocio/hub-financeiro?aba=pagar" className="lg:col-span-3">
        <div className="mx-auto mt-1 w-32">
          <MeiaLua fracao={totalDesp > 0 ? n.despesas.pagas / totalDesp : 0} rotulo={totalDesp > 0 ? `${Math.round((n.despesas.pagas / totalDesp) * 100)}%` : '—'} />
        </div>
        <p className="text-center text-xs text-ink-soft">
          {BRL.format(n.despesas.pagas)} pagas · {BRL.format(n.despesas.abertas)} em aberto
        </p>
      </Cartao>

      {/* Atraso — anéis concêntricos por faixa. */}
      <Cartao rotulo="Recebimentos atrasados" href="/meu-negocio/hub-financeiro?aba=receber" className="lg:col-span-4">
        <div className="mt-2 flex items-center gap-4">
          <div className="w-24 shrink-0">
            <AneisConcentricos
              faixas={[
                { valor: n.atraso.ate15, cor: '#fda4af' },
                { valor: n.atraso.ate60, cor: '#fb7185' },
                { valor: n.atraso.mais60, cor: '#e11d48' },
              ]}
            />
          </div>
          <div className="min-w-0">
            <p className={`font-serif text-2xl font-bold tracking-tight tabular ${totalAtraso > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink'}`}>
              {totalAtraso > 0 ? BRL.format(totalAtraso) : 'Tudo em dia'}
            </p>
            {totalAtraso > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
                {[
                  ['até 15 dias', n.atraso.ate15, 'bg-rose-300'],
                  ['16 a 60', n.atraso.ate60, 'bg-rose-400'],
                  ['mais de 60', n.atraso.mais60, 'bg-rose-600'],
                ]
                  .filter(([, v]) => (v as number) > 0)
                  .map(([r, v, c]) => (
                    <span key={r as string} className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
                      {r as string} · {BRL.format(v as number)}
                    </span>
                  ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink-soft">Nenhum cliente em atraso</p>
            )}
          </div>
        </div>
      </Cartao>

      {/* Próximos 14 dias — fluxo. */}
      <Cartao rotulo="Próximos 14 dias" href="/meu-negocio/hub-financeiro?aba=agenda" className="sm:col-span-2 lg:col-span-12">
        <div className="-mt-5 flex justify-end text-xs text-ink-soft">
          entra {BRL.format(entra14)} · sai {BRL.format(sai14)} ·{' '}
          <span className={`ml-1 font-semibold ${entra14 - sai14 >= 0 ? 'text-emerald-700 dark:text-[#D4FF00]' : 'text-rose-600 dark:text-rose-400'}`}>
            {entra14 - sai14 >= 0 ? 'sobra' : 'falta'} {BRL.format(Math.abs(entra14 - sai14))}
          </span>
        </div>
        <div className="mt-3">
          <Fluxo entradas={n.proximos14.entradas} saidas={n.proximos14.saidas} />
        </div>
        <div className="mt-1 grid grid-cols-7 text-center text-[10px] text-ink-soft sm:grid-cols-14">
          {n.proximos14.entradas.map((_, i) => {
            const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
            return (
              <span key={i} className={`${i >= 7 ? 'hidden sm:block' : ''} ${i === 0 ? 'font-semibold text-ink' : ''}`}>
                {i === 0 ? 'hoje' : `${DIAS[d.getDay()]} ${d.getDate()}`}
              </span>
            );
          })}
        </div>
      </Cartao>
    </div>
  );
}
