import { AlertTriangle, CheckCircle2, KeyRound, Gauge, Send, XCircle, Clock } from 'lucide-react';
import { requireAdmin } from '@/lib/server/admin-guard';
import { saudeDoOneflow, type SaudeOneflow } from '@/lib/server/saude-oneflow';
import { EnviosIncertos, EnviosEsgotados } from './DecisoesDeEnvio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Integração OneFlow | Hexx Digital' };

/**
 * INTEGRAÇÃO ONEFLOW — o painel do escritório.
 *
 * Para saber, sem abrir código nem log, se a ida e a volta estão
 * funcionando: a cota do dia e dos últimos 30 dias (com a folga de 20%), o
 * acesso, cada rotina com a última execução e quanto gastou, os lançamentos
 * recusados e o que falta voltar de cada empresa. Os problemas vêm no topo,
 * cada um com o que fazer.
 */

const painel =
  'rounded-[28px] border border-white/60 bg-white/55 p-6 ring-1 ring-inset ring-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5';
const rotulo = 'rotulo text-ink-soft';
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const duracao = (ms: number | null) =>
  ms == null ? '—' : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}min ${Math.round((ms % 60_000) / 1000)}s`;
const comp = (c: string) => `${c.slice(4, 6)}/${c.slice(0, 4)}`;

export default async function Page() {
  await requireAdmin();
  const s = await saudeDoOneflow();
  const util = s.cota.limite - s.cota.reserva;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-light uppercase tracking-[0.08em] text-ink sm:text-[28px]">Integração OneFlow</h1>
        <div className="mt-2 h-px w-full max-w-md bg-black/25 dark:bg-white/25" />
        <p className="mt-2 text-sm text-ink-soft">O que vai daqui para o OneFlow e o que volta — sem precisar abrir log.</p>
      </div>

      <Problemas problemas={s.problemas} />

      <div className="grid gap-4 lg:grid-cols-3">
        <CotaDeHoje s={s} util={util} />
        <div className={painel}>
          <p className={`${rotulo} flex items-center gap-1.5`}>
            <KeyRound className="h-3.5 w-3.5" /> Acesso ao OneFlow
          </p>
          <p className={`mt-3 font-serif text-3xl ${s.token.vivo ? 'text-ink' : 'text-rose-600'}`}>{s.token.vivo ? 'Ativo' : 'Expirado'}</p>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            {s.token.temRenovacao ? 'Renova sozinho a cada uso' : 'Sem renovação automática'}
            {s.token.expiraEm && ` · vale até ${quando(s.token.expiraEm)}`}
            {s.token.ultimoUso && ` · último uso ${quando(s.token.ultimoUso)}`}
          </p>
          <p className="mt-2 text-[11px] text-ink-soft">Um login só para o escritório inteiro: se ele cair, tudo para — por isso ele é o primeiro alerta.</p>
        </div>
        <div className={painel}>
          <p className={`${rotulo} flex items-center gap-1.5`}>
            <Send className="h-3.5 w-3.5" /> Lançamentos enviados
          </p>
          <p className="mt-3 font-serif text-3xl text-ink tabular">{s.envio.enviados.toLocaleString('pt-BR')}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-ink-soft">recusados</dt>
              <dd className={`font-semibold tabular ${s.envio.erros ? 'text-rose-600 dark:text-rose-400' : 'text-ink'}`}>{s.envio.erros}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">na fila</dt>
              <dd className="font-semibold tabular text-ink">{s.envio.pendentesLiberados}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">retirados</dt>
              <dd className="font-semibold tabular text-ink">{s.envio.retirados}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-ink-soft">Na fila = de meses já liberados no fechamento, esperando o turno da madrugada.</p>
        </div>
      </div>

      {s.envio.incertos.length > 0 && (
        <section className="rounded-[28px] border border-rose-500/25 bg-rose-500/[0.03] p-6">
          <p className="rotulo text-rose-700 dark:text-rose-400">Envios incertos — conferir no OneFlow</p>
          <p className="mt-1 text-xs text-ink-soft">
            O OneFlow não respondeu a estes envios. Eles podem ter entrado lá. Procure pelo documento no razão do OneFlow e diga o que achou — o sistema nunca
            os reenvia sozinho, para não lançar em dobro.
          </p>
          <div className="mt-3">
            <EnviosIncertos itens={s.envio.incertos} />
          </div>
        </section>
      )}

      <UsoDaCota s={s} util={util} />

      <section className="space-y-3">
        <p className={rotulo}>Rotinas</p>
        <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white/55 ring-1 ring-inset ring-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_9rem_5rem_7rem_5rem_5rem] gap-4 border-b border-black/[0.08] px-6 py-3 sm:grid dark:border-white/[0.12]">
            {['Rotina', 'Última execução', 'Duração', 'Chamadas', 'Teto hoje', 'Falhas 7d'].map((c) => (
              <span key={c} className={rotulo}>
                {c}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-black/[0.08] dark:divide-white/[0.12]">
            {s.rotinas.map((r) => (
              <li key={r.caminho} className="grid gap-x-4 gap-y-1 px-6 py-4 sm:grid-cols-[minmax(0,1.4fr)_9rem_5rem_7rem_5rem_5rem] sm:items-center">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{r.nome}</span>
                  <span className="block text-xs text-ink-soft">
                    {r.papel} Turno da {r.turno}.
                  </span>
                  {r.ultima?.status === 'FALHOU' && r.ultima.erro && (
                    <span className="mt-1 block text-xs text-rose-600 [overflow-wrap:anywhere] dark:text-rose-400">{r.ultima.erro.slice(0, 240)}</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-ink">
                  {!r.ultima ? (
                    <span className="text-ink-soft">ainda sem registro</span>
                  ) : (
                    <>
                      {r.ultima.status === 'OK' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : r.ultima.status === 'FALHOU' ? (
                        <XCircle className="h-3.5 w-3.5 text-rose-600" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-ink-soft" />
                      )}
                      {quando(r.ultima.inicio)}
                    </>
                  )}
                </span>
                <span className="text-xs tabular text-ink-soft">{duracao(r.ultima?.duracaoMs ?? null)}</span>
                <span className="text-xs tabular text-ink">
                  {r.ultima?.chamadas ?? '—'}
                  {r.mediaChamadas != null && <span className="text-ink-soft"> · média {r.mediaChamadas}</span>}
                </span>
                <span className="text-xs tabular text-ink-soft">até {r.tetoHoje}</span>
                <span className={`text-xs tabular ${r.falhas7 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-ink-soft'}`}>{r.falhas7}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-ink-soft">
          Em ordem de prioridade: as guias podem usar tudo o que houver; cada rotina abaixo deixa guardado o que as de cima ainda vão precisar no dia (mais nos
          dias 1 a 10, quando as guias saem). Os 20% de folga nenhuma rotina automática usa. Dimensionado para 150 empresas. O registro das execuções começou em
          28/09/2026.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${painel} min-w-0`}>
          <p className={rotulo}>Lançamentos recusados, por motivo</p>
          {s.envio.errosPorMotivo.length === 0 ? (
            <p className="mt-3 text-sm text-ink">Nenhum lançamento recusado.</p>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {s.envio.errosPorMotivo.map((e) => (
                  <li key={`${e.empresa}${e.motivo}`} className="flex items-start justify-between gap-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm text-ink">{e.empresa}</span>
                      <span className="block text-xs text-ink-soft [overflow-wrap:anywhere]">{e.motivo}</span>
                    </span>
                    <span className="shrink-0 font-serif text-sm tabular text-rose-600 dark:text-rose-400">{e.qtd}</span>
                  </li>
                ))}
              </ul>
              {s.envio.esgotadas.length > 0 && <EnviosEsgotados itens={s.envio.esgotadas} />}
              <p className="mt-3 text-[11px] text-ink-soft">
                Cada recusa é tentada de novo por até 3 madrugadas; depois para, para não gastar cota com o mesmo erro.
              </p>
            </>
          )}
        </section>

        <section className={`${painel} min-w-0`}>
          <p className={rotulo}>O que voltou da competência {comp(s.volta.competencia)}</p>
          {s.volta.empresas.length === 0 ? (
            <p className="mt-3 text-sm text-ink">Nenhuma empresa ligada ao OneFlow.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {s.volta.empresas.map((v) => (
                <li key={v.nome} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink">{v.nome}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs">
                    <Selo ok={v.fiscalOk} texto="DAS" />
                    <Selo
                      ok={v.folhaOk}
                      texto={v.folhaOk && v.folhaStatus === 'SEM_MODULO' ? 'sem folha' : 'Folha'}
                      detalhe={!v.folhaOk ? v.folhaStatus : null}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink-soft">
            DAS e folha têm marcação própria: a primeira guia não encerra mais o mês. Até o dia 20, o que faltar é buscado de novo todo dia.
          </p>
        </section>
      </div>
    </div>
  );
}

function Selo({ ok, texto, detalhe }: { ok: boolean; texto: string; detalhe?: string | null }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink-soft'}`} title={detalhe ?? undefined}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {texto}
      {!ok && detalhe && detalhe !== 'ERRO' && <span className="text-[10px]">({detalhe.toLowerCase()})</span>}
    </span>
  );
}

function Problemas({ problemas }: { problemas: SaudeOneflow['problemas'] }) {
  if (!problemas.length) {
    return (
      <div className="flex items-center gap-3 rounded-[28px] border border-emerald-500/25 bg-emerald-500/[0.06] px-6 py-4 text-sm text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-5 w-5 shrink-0" /> Tudo funcionando: cota dentro do planejado, acesso ativo e nenhuma rotina com falha.
      </div>
    );
  }
  return (
    <section className="space-y-2">
      <p className="rotulo text-rose-700 dark:text-rose-400">{problemas.length === 1 ? '1 ponto pede atenção' : `${problemas.length} pontos pedem atenção`}</p>
      <ul className="space-y-2">
        {problemas.map((p, i) => (
          <li
            key={i}
            className={`rounded-2xl border px-5 py-3.5 ${
              p.nivel === 'critico' ? 'border-rose-500/30 bg-rose-500/[0.05]' : 'border-amber-500/30 bg-amber-500/[0.05]'
            }`}
          >
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${p.nivel === 'critico' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {p.titulo}
            </p>
            <p className="mt-1 pl-6 text-xs text-ink">{p.detalhe}</p>
            <p className="mt-1 pl-6 text-xs text-ink-soft">
              <strong className="font-semibold text-ink">O que fazer:</strong> {p.acao}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CotaDeHoje({ s, util }: { s: SaudeOneflow; util: number }) {
  const { hoje, limite } = s.cota;
  const pct = Math.min(100, (hoje / limite) * 100);
  const cor = hoje >= limite ? 'bg-rose-500' : hoje >= util ? 'bg-amber-500' : 'bg-hexxa-forest dark:bg-hexxa-lime';
  return (
    <div className="rounded-[28px] bg-[#1E3328] p-6 text-white shadow-[0_18px_40px_rgba(30,51,40,0.25)]">
      <p className="rotulo flex items-center gap-1.5 text-white/60">
        <Gauge className="h-3.5 w-3.5" /> Cota da API hoje
      </p>
      <p className="mt-3 font-serif text-4xl tabular text-hexxa-lime">
        {hoje}
        <span className="text-lg text-white/50"> / {limite}</span>
      </p>
      {/* Barra do dia com a marca da folga de 20%. */}
      <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${(util / limite) * 100}%` }} title="Começo da reserva" />
      </div>
      <p className="mt-3 text-xs text-white/60">
        {Math.max(0, util - hoje)} livres antes da reserva · média de 7 dias {s.cota.media7} · pico do mês {s.cota.pico30}
      </p>
      <p className="mt-1 text-[11px] text-white/40">Reserva de {s.cota.reserva} chamadas (20%) para imprevistos. A cota vira à meia-noite.</p>
    </div>
  );
}

/** Barras dos últimos 30 dias, com a linha do planejado (80%) e a do limite. */
function UsoDaCota({ s, util }: { s: SaudeOneflow; util: number }) {
  const W = 900;
  const H = 180;
  const topo = Math.max(s.cota.limite, s.cota.pico30) * 1.08;
  const y = (v: number) => H - (v / topo) * H;
  const bw = W / s.cota.serie.length;
  return (
    <section className={`${painel} min-w-0`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="rotulo text-ink-soft">Uso da cota — últimos 30 dias</p>
        <p className="text-[11px] text-ink-soft">
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block h-px w-4 border-t border-dashed border-amber-600" /> planejado ({util})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-px w-4 bg-rose-500" /> limite ({s.cota.limite})
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="mt-4 w-full" role="img" aria-label="Chamadas por dia nos últimos 30 dias">
        <defs>
          <pattern id="hachura-cota" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2" />
          </pattern>
        </defs>
        {s.cota.serie.map((d, i) => {
          const hojeBar = i === s.cota.serie.length - 1;
          const acima = d.chamadas > util;
          return (
            <g key={d.dia} className={acima ? 'text-rose-500' : 'text-hexxa-forest dark:text-hexxa-lime'}>
              <rect
                x={i * bw + bw * 0.18}
                y={y(d.chamadas)}
                width={bw * 0.64}
                height={Math.max(0, H - y(d.chamadas))}
                rx={3}
                fill={hojeBar ? 'url(#hachura-cota)' : 'currentColor'}
                opacity={hojeBar ? 1 : 0.75}
              >
                <title>{`${d.dia.split('-').reverse().join('/')}: ${d.chamadas} chamadas`}</title>
              </rect>
              {(i % 5 === 0 || hojeBar) && (
                <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" className="fill-current text-ink-soft" fontSize="11">
                  {d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}
                </text>
              )}
            </g>
          );
        })}
        <line x1="0" x2={W} y1={y(util)} y2={y(util)} stroke="#d97706" strokeDasharray="5 4" strokeWidth="1.2" />
        <line x1="0" x2={W} y1={y(s.cota.limite)} y2={y(s.cota.limite)} stroke="#f43f5e" strokeWidth="1.2" />
      </svg>
    </section>
  );
}
