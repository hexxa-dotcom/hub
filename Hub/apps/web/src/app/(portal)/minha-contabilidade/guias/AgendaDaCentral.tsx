'use client';

import { useMemo, useState } from 'react';
import { List, CalendarDays, CheckCircle2, Clock, AlertTriangle, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';

/**
 * A AGENDA DO MÊS: tudo o que tem data, no mesmo lugar.
 *
 * Duas leituras do mesmo conteúdo. O extrato é a lista cronológica, dia a
 * dia, com as colunas alinhadas — para conferir. O calendário é o mês em
 * grade — para enxergar onde os vencimentos se acumulam.
 *
 * Antes esta aba mostrava três compromissos escritos à mão ("dia 07", "dia
 * 20", "dia 30"), iguais para toda empresa e todo mês. Agora é o dado real.
 */

export type SituacaoNaAgenda = 'OPEN' | 'PAID' | 'OVERDUE' | 'DOC';

export interface ItemDaAgenda {
  id: string;
  /** AAAA-MM-DD: vencimento, ou o dia em que o documento chegou. */
  data: string;
  titulo: string;
  selo: string;
  valor: number | null;
  situacao: SituacaoNaAgenda;
  /** Dinheiro que entra (conta a receber). Muda os rótulos: "a receber", "recebida". */
  entrada?: boolean;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const SITUACAO: Record<SituacaoNaAgenda, { label: string; cls: string; ponto: string; icon: React.FC<{ className?: string }> }> = {
  OPEN: { label: 'A pagar', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20', ponto: 'bg-amber-500', icon: Clock },
  OVERDUE: { label: 'Em atraso', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20', ponto: 'bg-rose-500', icon: AlertTriangle },
  PAID: { label: 'Paga', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', ponto: 'bg-emerald-500', icon: CheckCircle2 },
  DOC: { label: 'Documento', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20', ponto: 'bg-sky-500', icon: FileText },
};

function Selo({ s, entrada }: { s: SituacaoNaAgenda; entrada?: boolean }) {
  const c = SITUACAO[s];
  const label = entrada ? (s === 'PAID' ? 'Recebida' : s === 'OPEN' ? 'A receber' : c.label) : c.label;
  return (
    <span className={`inline-flex w-full items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${c.cls}`}>
      <c.icon className="h-3 w-3" /> {label}
    </span>
  );
}

export function AgendaDaCentral({ itens, mes, rotuloDoMes }: { itens: ItemDaAgenda[]; mes: string; rotuloDoMes: string }) {
  const [visao, setVisao] = useState<'extrato' | 'calendario'>('extrato');
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const porDia = useMemo(() => {
    const m = new Map<string, ItemDaAgenda[]>();
    for (const i of [...itens].sort((a, b) => a.data.localeCompare(b.data))) {
      m.set(i.data, [...(m.get(i.data) ?? []), i]);
    }
    return m;
  }, [itens]);

  const soma = (l: ItemDaAgenda[]) => l.reduce((s, i) => s + (i.valor ?? 0), 0);
  const emAberto = (i: ItemDaAgenda) => i.situacao === 'OPEN' || i.situacao === 'OVERDUE';
  const aPagar = soma(itens.filter((i) => !i.entrada && emAberto(i)));
  const aReceber = soma(itens.filter((i) => i.entrada && emAberto(i)));
  const pago = soma(itens.filter((i) => !i.entrada && i.situacao === 'PAID'));
  const temEntradas = itens.some((i) => i.entrada);


  return (
    <Card level={1} className="card-finish space-y-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-ink">Agenda de {rotuloDoMes}</h2>
          <p className="text-xs text-ink-soft sm:text-sm">
            {itens.length === 0
              ? 'Nada com data neste mês.'
              : temEntradas
                ? `A pagar ${BRL.format(aPagar)} · a receber ${BRL.format(aReceber)}`
                : `A pagar ${BRL.format(aPagar)} · pago ${BRL.format(pago)}`}
          </p>
        </div>
        <SegmentedTabs
          size="sm"
          tabs={[
            { id: 'extrato', label: 'Extrato', icon: List },
            { id: 'calendario', label: 'Calendário', icon: CalendarDays },
          ]}
          activeTab={visao}
          onChange={setVisao}
          layoutId="agendaVisaoIndicator"
        />
      </div>

      {visao === 'extrato' ? (
        itens.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft">Nada com vencimento neste mês.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/5 dark:border-white/10">
            {/* Cabeçalho e linhas na MESMA grade: é o que mantém tudo alinhado. */}
            <div className="hidden grid-cols-[4.5rem_1fr_7.5rem_7.5rem] gap-3 border-b border-black/5 bg-black/[0.02] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft dark:border-white/10 dark:bg-white/[0.02] sm:grid">
              <span>Dia</span>
              <span>Descrição</span>
              <span className="text-right">Valor</span>
              <span className="text-center">Situação</span>
            </div>
            {[...porDia.entries()].map(([data, doDia]) => (
              <div key={data} className={`border-b border-black/5 last:border-0 dark:border-white/10 ${data === hoje ? 'bg-hexxa-forest/[0.04]' : ''}`}>
                {doDia.map((i, n) => (
                  <div key={i.id} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 px-4 py-3 sm:grid-cols-[4.5rem_1fr_7.5rem_7.5rem]">
                    <span className={`text-sm font-bold tabular ${n > 0 ? 'invisible' : ''} ${data === hoje ? 'text-hexxa-forest dark:text-hexxa-lime' : 'text-ink'}`}>
                      {data.slice(8, 10)}/{data.slice(5, 7)}
                      <span className="rotulo block text-ink-soft">
                        {data === hoje ? 'hoje' : SEMANA[new Date(`${data}T12:00:00`).getDay()]}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{i.titulo}</span>
                      <span className="text-xs text-ink-soft">{i.selo}</span>
                    </span>
                    <span className="col-start-2 text-sm font-serif font-bold tabular text-ink sm:col-start-auto sm:text-right">
                      {i.valor != null ? BRL.format(i.valor) : '—'}
                    </span>
                    <span className="col-start-2 w-32 sm:col-start-auto sm:w-auto">
                      <Selo s={i.situacao} entrada={i.entrada} />
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      ) : (
        <Calendario mes={mes} porDia={porDia} hoje={hoje} diaAberto={diaAberto} setDiaAberto={setDiaAberto} />
      )}
    </Card>
  );
}

function Calendario({
  mes,
  porDia,
  hoje,
  diaAberto,
  setDiaAberto,
}: {
  mes: string;
  porDia: Map<string, ItemDaAgenda[]>;
  hoje: string;
  diaAberto: string | null;
  setDiaAberto: (d: string | null) => void;
}) {
  const [ano, m] = mes.split('-').map(Number) as [number, number];
  const primeiro = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const celulas: (string | null)[] = [
    ...Array.from({ length: primeiro }, () => null),
    ...Array.from({ length: dias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`),
  ];
  const doDiaAberto = diaAberto ? porDia.get(diaAberto) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="rotulo grid grid-cols-7 gap-1 text-center text-ink-soft">
        {SEMANA.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celulas.map((d, i) => {
          if (!d) return <span key={`v${i}`} />;
          const itens = porDia.get(d) ?? [];
          const aberto = diaAberto === d;
          return (
            <button
              key={d}
              type="button"
              disabled={itens.length === 0}
              onClick={() => setDiaAberto(aberto ? null : d)}
              className={`flex aspect-square flex-col items-center justify-start gap-1 rounded-xl border p-1.5 text-xs transition-colors sm:aspect-auto sm:h-20 sm:items-start ${
                aberto
                  ? 'border-hexxa-forest bg-hexxa-forest/5 dark:border-hexxa-lime'
                  : 'border-black/5 dark:border-white/10'
              } ${itens.length ? 'cursor-pointer hover:border-hexxa-forest/40' : 'cursor-default opacity-60'}`}
            >
              <span className={`font-bold ${d === hoje ? 'rounded-full bg-hexxa-forest px-1.5 text-hexxa-lime' : 'text-ink'}`}>
                {Number(d.slice(8, 10))}
              </span>
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {itens.slice(0, 4).map((it) => (
                  <span key={it.id} className={`h-1.5 w-1.5 rounded-full ${SITUACAO[it.situacao].ponto}`} />
                ))}
              </span>
              <span className="hidden w-full space-y-0.5 sm:block">
                {itens.slice(0, 2).map((it) => (
                  <span key={it.id} className="flex items-center gap-1 truncate text-[10px] text-ink">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SITUACAO[it.situacao].ponto}`} />
                    <span className="truncate">{it.titulo}</span>
                  </span>
                ))}
                {itens.length > 2 && <span className="text-[10px] text-ink-soft">+{itens.length - 2}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {diaAberto && doDiaAberto.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-black/5 p-4 dark:border-white/10">
          <p className="rotulo text-ink-soft">
            {diaAberto.slice(8, 10)}/{diaAberto.slice(5, 7)}
          </p>
          {doDiaAberto.map((i) => (
            <div key={i.id} className="grid grid-cols-[1fr_7rem_7.5rem] items-center gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-ink">{i.titulo}</span>
                <span className="text-xs text-ink-soft">{i.selo}</span>
              </span>
              <span className="text-right text-sm font-serif font-bold tabular text-ink">{i.valor != null ? BRL.format(i.valor) : '—'}</span>
              <Selo s={i.situacao} entrada={i.entrada} />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-[11px] text-ink-soft">
        {(Object.keys(SITUACAO) as SituacaoNaAgenda[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${SITUACAO[k].ponto}`} /> {SITUACAO[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
