'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { SegmentedTabs, alertaDaAba } from '@/components/ui/SegmentedTabs';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import { FinanceiroMonthSelector } from '../hub-financeiro/FinanceiroMonthSelector';
import type { NotasDoMes, NotaDoMes } from '@/lib/server/notas';
import { syncDfeAction } from './dfeActions';
import { descartarTentativaAction } from './actions';
import { cancelNfseAction } from '../nfse/actions';
import { EmissaoFacil, Agendadas, type Prestador, type InicialDaEmissao } from './EmissaoFacil';
import type { EmissaoAgendada, NotaPendente } from '@/lib/server/emissao-agendada';
import { ListaEmColunas, Titulo, Valor, Situacao, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';
import { nomeDeExibicao, iniciais } from '@/lib/nome-de-exibicao';

/**
 * NOTAS DO MÊS.
 *
 * A visão geral do emissor: o que foi emitido no mês, o que está agendado e
 * o que está pendente (parcela de contrato sem nota), com o "Emitir nota" em
 * destaque no alto — não escondido numa aba. Clicar numa nota abre a DANFSe
 * dentro do Hub; as tentativas com erro ficam à parte, com "descartar".
 */

type Aba = 'emitidas' | 'recebidas' | 'agendadas' | 'pendentes' | 'emitir';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeDoMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}`;
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—');
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const deslocar = (m: string, n: number) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function NotasClient({
  mes,
  meses,
  notas,
  aliquota,
  aliquotaApurada,
  abaInicial,
  emissao,
}: {
  mes: string;
  meses: string[];
  notas: NotasDoMes;
  aliquota: number;
  aliquotaApurada: boolean;
  abaInicial: Aba;
  emissao: {
    bloqueada: boolean;
    mode: 'gov' | 'mock';
    certOk: boolean;
    fiscalOk: boolean;
    profiles: never[] | unknown[];
    customers: { id: string; name: string; document: string | null; email: string | null; phone: string | null; endereco: Record<string, string> | null }[];
    taxRatePercent: number;
    agendadas: EmissaoAgendada[];
    pendentes: NotaPendente[];
    prestador: Prestador | null;
    /** Simples antes de novembro: a data a partir da qual dá para agendar. */
    liberaEm: string | null;
  };
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [vendo, setVendo] = useState<NotaDoMes | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sincronizando, sincronizar] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState<string | null>(null);
  const [inicial, setInicial] = useState<InicialDaEmissao | null>(null);
  const ativasAgendadas = emissao.agendadas.filter((a) => a.ativa);
  const totalPendente = emissao.pendentes.reduce((s, p) => s + p.valor, 0);
  const emitir = (i: InicialDaEmissao | null = null) => {
    setInicial(i);
    setAba('emitir');
  };
  const atual = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

  const validas = notas.emitidas.filter((n) => !n.cancelada);
  const faturado = validas.reduce((s, n) => s + n.valor, 0);
  const recebido = notas.recebidas.filter((n) => !n.cancelada).reduce((s, n) => s + n.valor, 0);
  const imposto = (faturado * aliquota) / 100;

  const irPara = (m: string) => router.push(`/meu-negocio/notas?mes=${m}` as never);

  function sync() {
    sincronizar(async () => {
      const r = await syncDfeAction();
      setAviso(r.erro ? `Não consegui sincronizar: ${r.erro}` : r.documentosNovos ? `${r.documentosNovos} nota(s) nova(s) do Emissor Nacional.` : 'Tudo em dia com o Emissor Nacional.');
      router.refresh();
    });
  }

  async function descartar(id: string) {
    if (!confirm('Descartar esta tentativa? Ela nunca virou nota.')) return;
    setOcupado(id);
    await descartarTentativaAction(id);
    setOcupado(null);
    router.refresh();
  }

  async function cancelar(n: NotaDoMes) {
    if (!n.cancelar) return;
    setConfirmarCancelamento(null);
    setOcupado(n.id);
    const r = await cancelNfseAction(n.cancelar.id, n.cancelar.protocolo);
    setOcupado(null);
    setAviso(r.ok ? 'Nota cancelada.' : `Não consegui cancelar: ${r.message}`);
    router.refresh();
  }

  const lista = aba === 'recebidas' ? notas.recebidas : notas.emitidas;

  return (
    <div className="space-y-10">
      {aviso && <p className="rounded-2xl border border-black/5 bg-black/[0.03] px-4 py-3 text-xs font-semibold text-ink dark:border-white/10 dark:bg-white/5">{aviso}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            tabs={[
              { id: 'emitidas', label: 'Emitidas', badge: alertaDaAba(notas.comErro.length) },
              { id: 'recebidas', label: 'Recebidas' },
              { id: 'agendadas', label: 'Agendadas' },
              { id: 'pendentes', label: 'Pendentes', badge: alertaDaAba(emissao.pendentes.filter((p) => p.atrasada).length) },
            ]}
            activeTab={aba === 'emitir' ? '' : aba}
            onChange={(id) => setAba(id as Aba)}
            layoutId="notasAbas"
          />
          {/* O que mais se faz aqui é emitir: o botão é o destaque da tela. */}
          <button
            type="button"
            onClick={() => emitir()}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
              aba === 'emitir'
                ? 'border border-black/15 text-ink dark:border-white/20'
                : 'bg-hexxa-forest text-hexxa-lime shadow-[0_8px_24px_rgba(30,51,40,0.25)] hover:bg-hexxa-green dark:bg-hexxa-lime dark:text-hexxa-forest'
            }`}
          >
            + Emitir nota
          </button>
        </div>
        {(aba === 'emitidas' || aba === 'recebidas') && (
          <FinanceiroMonthSelector
            selectedMonth={mes}
            monthLabel={nomeDoMes(mes)}
            isCurrentMonth={mes === atual}
            availableMonths={meses}
            onMonthChange={irPara}
            onPrevMonth={() => irPara(deslocar(mes, -1))}
            onNextMonth={() => irPara(deslocar(mes, 1))}
            onCurrentMonth={() => irPara(atual)}
          />
        )}
      </div>

      {aba === 'emitir' ? (
        <EmissaoFacil
          key={inicial?.parcelaId ?? inicial?.customerId ?? 'nova'}
          mode={emissao.mode}
          customers={emissao.customers}
          profiles={emissao.profiles as never}
          taxRatePercent={emissao.taxRatePercent}
          liberaEm={emissao.liberaEm}
          prestador={emissao.prestador}
          inicial={inicial}
        />
      ) : (
        <>
          <GradeDeResumo colunas={3}>
            <CardResumo
              destaque
              rotulo={`Emitidas em ${MESES[Number(mes.slice(5)) - 1]}`}
              valor={BRL.format(faturado)}
              nota={`${validas.length} ${validas.length === 1 ? 'nota' : 'notas'} · imposto estimado ${BRL.format(imposto)} (${aliquota.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ${aliquotaApurada ? 'apurado' : 'estimado'})${notas.comErro.length ? ` · ${notas.comErro.length} com erro` : ''}`}
              onClick={() => setAba('emitidas')}
            />
            <CardResumo
              rotulo="Agendadas"
              valor={ativasAgendadas.length}
              nota={ativasAgendadas[0] ? `próxima ${ativasAgendadas[0].proximaData.split('-').reverse().join('/')} · ${nomeDeExibicao(ativasAgendadas[0].cliente)}` : 'Nenhuma nota agendada'}
              onClick={() => setAba('agendadas')}
            />
            <CardResumo
              rotulo="Pendentes"
              valor={emissao.pendentes.length}
              tom={emissao.pendentes.some((p) => p.atrasada) ? 'alerta' : 'padrao'}
              nota={emissao.pendentes.length ? `${BRL.format(totalPendente)} em parcelas de contrato sem nota` : 'Nenhuma parcela de contrato sem nota'}
              onClick={() => setAba('pendentes')}
            />
          </GradeDeResumo>

          {aba === 'agendadas' ? (
            ativasAgendadas.length || emissao.agendadas.length ? (
              <Agendadas itens={emissao.agendadas} />
            ) : (
              <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-10 text-center text-sm text-ink-soft dark:border-white/10">
                Nenhuma nota agendada. Ao emitir, escolha "repetir todo mês" ou "agendar" em <strong>Depois desta</strong>.
              </p>
            )
          ) : aba === 'pendentes' ? (
            <section className="space-y-4">
              <p className="rotulo text-ink-soft">Parcelas de contrato sem nota</p>
              <ListaEmColunas
                colunas={[
                  { rotulo: 'Cliente', largura: 'minmax(0,1fr)' },
                  { rotulo: 'Vence', largura: '7rem', soDesktop: true },
                  { rotulo: 'Valor', largura: '8rem', alinhar: 'direita' },
                  { rotulo: '', largura: '7rem', alinhar: 'direita' },
                ]}
                itens={emissao.pendentes}
                chave={(p) => p.parcelaId}
                alerta={(p) => p.atrasada}
                celulas={(p) => [
                  <Titulo key="t" nome={nomeDeExibicao(p.cliente)} apoio={p.contrato} />,
                  <span key="v" className={`text-xs ${p.atrasada ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-ink-soft'}`}>
                    {p.vencimento.split('-').reverse().join('/')}
                  </span>,
                  <Valor key="r">{BRL.format(p.valor)}</Valor>,
                  <BotaoDiscreto
                    key="b"
                    onClick={() =>
                      emitir({
                        parcelaId: p.parcelaId,
                        documento: p.documento ?? '',
                        nome: p.cliente,
                        email: p.email ?? '',
                        valor: p.valor,
                        descricao: p.descricao,
                        customerId: emissao.customers.find((c) => (c.document ?? '').replace(/\D/g, '') === (p.documento ?? '').replace(/\D/g, ''))?.id,
                      })
                    }
                  >
                    Emitir
                  </BotaoDiscreto>,
                ]}
                vazio="Nenhuma parcela de contrato esperando nota."
              />
            </section>
          ) : (
          <>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="rotulo text-ink-soft">{aba === 'recebidas' ? 'Notas que você recebeu' : 'Notas que você emitiu'}</p>
              <button type="button" onClick={sync} disabled={sincronizando} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50">
                {sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sincronizar com o Emissor Nacional
                {notas.ultimaSincronizacao && <span className="font-normal"> · última nota recebida em {quando(notas.ultimaSincronizacao)}</span>}
              </button>
            </div>
            {lista.length === 0 ? (
              <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
                {aba === 'recebidas' ? `Nenhuma nota recebida em ${nomeDoMes(mes)}.` : `Nenhuma nota emitida em ${nomeDoMes(mes)}.`}
              </p>
            ) : (
              <ListaEmColunas
                colunas={[
                  { rotulo: aba === 'recebidas' ? 'Prestador' : 'Tomador', largura: 'minmax(0,1fr)' },
                  { rotulo: 'Nota', largura: '5rem', alinhar: 'direita', soDesktop: true },
                  { rotulo: 'Emissão', largura: '5rem', alinhar: 'direita', soDesktop: true },
                  { rotulo: 'Situação', largura: '7.5rem', soDesktop: true },
                  { rotulo: 'Valor', largura: '8rem', alinhar: 'direita' },
                ]}
                itens={lista}
                chave={(n) => n.id}
                apagada={(n) => n.cancelada}
                celulas={(n) => {
                  const nome = n.parte ? nomeDeExibicao(n.parte) : 'Sem nome';
                  const [cor, texto] = n.cancelada
                    ? ['bg-black/25 dark:bg-white/25', 'Cancelada']
                    : n.processando
                      ? ['bg-amber-500', 'Processando']
                      : n.origem === 'HEXX'
                        ? ['bg-amber-500', 'A caminho']
                        : ['bg-emerald-500', 'Autorizada'];
                  return [
                    <Titulo key="t" nome={nome} monograma={iniciais(nome)} apoio={n.descricao ?? (n.numero ? `Nota ${n.numero}` : dia(n.data))} apagado={n.cancelada} />,
                    <span key="n" className="text-xs tabular text-ink-soft">{n.numero ?? '—'}</span>,
                    <span key="d" className="text-xs tabular text-ink-soft">{dia(n.data)}</span>,
                    <Situacao key="s" cor={cor}>{texto}</Situacao>,
                    <Valor key="v" tom={n.cancelada ? 'suave' : 'padrao'}>
                      <span className={n.cancelada ? 'line-through' : ''}>
                        {aba === 'recebidas' ? '− ' : ''}
                        {BRL.format(n.valor)}
                      </span>
                    </Valor>,
                  ];
                }}
                detalhe={(n) => (
                  <Detalhe
                    acoes={
                      <>
                        {n.danfse && <BotaoDiscreto onClick={() => setVendo(n)}>Ver nota</BotaoDiscreto>}
                        {n.cancelar && !n.cancelada &&
                          (confirmarCancelamento === n.id ? (
                            <span className="flex items-center gap-3 px-2 py-1.5 text-xs font-semibold">
                              <span className="font-normal text-ink-soft">Cancelar no Emissor Nacional? Não tem volta.</span>
                              <button type="button" disabled={ocupado === n.id} onClick={() => cancelar(n)} className="text-rose-600 disabled:opacity-50 dark:text-rose-400">Sim</button>
                              <button type="button" onClick={() => setConfirmarCancelamento(null)} className="text-ink-soft hover:text-ink">Não</button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setConfirmarCancelamento(n.id)} className="px-2 py-1.5 text-xs font-semibold text-ink-soft hover:text-rose-600">
                              Cancelar nota
                            </button>
                          ))}
                      </>
                    }
                  >
                    <Campo rotulo={aba === 'recebidas' ? 'Prestador' : 'Tomador'} largo>{n.parte ?? '—'}</Campo>
                    <Campo rotulo="Número">{n.numero ?? '—'}</Campo>
                    <Campo rotulo="Emitida em">{n.data ? new Date(n.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}</Campo>
                    <Campo rotulo="Valor">
                      <span className="font-serif tabular">{BRL.format(n.valor)}</span>
                    </Campo>
                    {n.descricao && <Campo rotulo="Serviço" largo>{n.descricao}</Campo>}
                    {n.origem === 'HEXX' && <Campo rotulo="Origem" largo>Emitida pela Hexx, a caminho do Emissor Nacional</Campo>}
                  </Detalhe>
                )}
              />
            )}
          </section>

          {aba === 'emitidas' && notas.comErro.length > 0 && (
            <section className="space-y-4">
              <p className="rotulo text-rose-700 dark:text-rose-400">Tentativas de emissão com erro</p>
              <ul className="divide-y divide-rose-500/10 rounded-[28px] border border-rose-500/20 bg-rose-500/[0.03]">
                {notas.comErro.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{t.cliente ?? 'Tomador avulso'} · {BRL.format(t.valor)}</p>
                      <p className="text-xs text-ink-soft">Tentativa em {quando(t.em)} — não virou nota{t.descricao ? ` · ${t.descricao}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => descartar(t.id)} disabled={ocupado === t.id} className="text-xs font-semibold text-ink-soft hover:text-rose-600 disabled:opacity-50">
                      Descartar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {aba === 'emitidas' && !emissao.bloqueada && (
            <p className="text-xs text-ink-soft">
              Precisa emitir?{' '}
              <button type="button" onClick={() => setAba('emitir')} className="font-semibold text-ink underline-offset-4 hover:underline">
                Emitir nota
              </button>
              {' · '}
              <Link href="/configuracoes/fiscal" className="font-semibold text-ink underline-offset-4 hover:underline">
                Cadastro fiscal
              </Link>
            </p>
          )}
          </>
          )}
        </>
      )}

      {vendo?.danfse && <VisualizadorDeArquivo src={vendo.danfse} titulo={`Nota ${vendo.numero ?? ''} · ${vendo.parte ? nomeDeExibicao(vendo.parte) : ''}`} onClose={() => setVendo(null)} />}
    </div>
  );
}
