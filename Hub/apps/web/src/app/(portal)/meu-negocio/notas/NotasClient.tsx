'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Download, Loader2, Plus, RefreshCw } from 'lucide-react';
import { SectionHero } from '@/components/ui/SectionHero';
import { SegmentedTabs, alertaDaAba } from '@/components/ui/SegmentedTabs';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import { FinanceiroMonthSelector } from '../hub-financeiro/FinanceiroMonthSelector';
import type { NotasDoMes, NotaDoMes } from '@/lib/server/notas';
import { syncDfeAction } from './dfeActions';
import { descartarTentativaAction } from './actions';
import { cancelNfseAction, cancelarPorChaveAction } from '../nfse/actions';
import { EmissaoFacil, Agendadas, type Prestador, type InicialDaEmissao } from './EmissaoFacil';
import type { EmissaoAgendada, NotaPendente } from '@/lib/server/emissao-agendada';
import { ListaEmColunas, Titulo, Valor, Situacao, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';
import { nomeDeExibicao, iniciais } from '@/lib/nome-de-exibicao';
import { FiltroDePeriodo, textoDoPeriodo, type Periodo } from './FiltroDePeriodo';

/**
 * NOTAS DO MÊS.
 *
 * A visão geral do emissor: o que foi emitido no mês, o que está agendado e
 * o que está pendente (parcela de contrato sem nota), com o "Emitir nota" em
 * destaque no alto — não escondido numa aba. Clicar numa nota abre a DANFSe
 * dentro do Hub; as tentativas com erro ficam à parte, com "descartar".
 */

type Aba = 'emitidas' | 'agendadas' | 'pendentes' | 'emitir';
/** Dentro de Emitidas, um filtro troca para as notas recebidas. */
type Lado = 'emitidas' | 'recebidas';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeDoMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}`;
const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const deslocar = (m: string, n: number) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function NotasClient({
  mes,
  periodo,
  meses,
  notas,
  aliquota,
  aliquotaApurada,
  abaInicial,
  emissao,
}: {
  mes: string;
  /** Período de/até escolhido no filtro — manda sobre o mês. */
  periodo: Periodo | null;
  meses: string[];
  notas: NotasDoMes;
  aliquota: number;
  aliquotaApurada: boolean;
  abaInicial: Aba | 'recebidas';
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
  const [aba, setAba] = useState<Aba>(abaInicial === 'recebidas' ? 'emitidas' : abaInicial);
  const [lado, setLado] = useState<Lado>(abaInicial === 'recebidas' ? 'recebidas' : 'emitidas');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState(false);
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

  const comLado = (l: Lado) => (l === 'recebidas' ? '&aba=recebidas' : '');
  const irPara = (m: string) => {
    setMarcados(new Set());
    router.push(`/meu-negocio/notas?mes=${m}${comLado(lado)}` as never);
  };
  const verPeriodo = (p: Periodo | null) => {
    setMarcados(new Set());
    router.push((p ? `/meu-negocio/notas?de=${p.de}&ate=${p.ate}${comLado(lado)}` : `/meu-negocio/notas?mes=${mes}${comLado(lado)}`) as never);
  };
  const trocarLado = (l: Lado) => {
    setLado(l);
    setMarcados(new Set());
  };
  const oPeriodo = periodo ? textoDoPeriodo(periodo) : `em ${nomeDoMes(mes)}`;

  /** As notas marcadas num .zip (PDF + XML de cada) — ver /api/nfse/lote. */
  async function baixarMarcadas() {
    setBaixando(true);
    setAviso(null);
    try {
      const r = await fetch('/api/nfse/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...marcados] }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setAviso(`Não consegui baixar: ${j?.error ?? 'tente de novo.'}`);
        return;
      }
      const blob = await r.blob();
      const nome = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'notas.zip';
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: nome });
      a.click();
      URL.revokeObjectURL(url);
      const ok = Number(r.headers.get('X-Notas-Baixadas') ?? 0);
      const falhas = Number(r.headers.get('X-Notas-Com-Falha') ?? 0);
      setAviso(
        falhas
          ? `${ok} ${ok === 1 ? 'nota baixada' : 'notas baixadas'}; ${falhas} não vieram — a lista está no LEIA-ME.txt dentro do arquivo.`
          : `${ok} ${ok === 1 ? 'nota baixada' : 'notas baixadas'} (PDF e XML).`,
      );
      setMarcados(new Set());
    } finally {
      setBaixando(false);
    }
  }

  function sync() {
    sincronizar(async () => {
      const r = await syncDfeAction();
      setAviso(
        r.erro
          ? `Não consegui sincronizar: ${r.erro}`
          : r.documentosNovos
            ? `${r.documentosNovos} nota(s) nova(s) do Emissor Nacional.`
            : 'Tudo em dia com o Emissor Nacional.',
      );
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

  async function cancelar(n: NotaDoMes, motivo: '1' | '2' | '9', justificativa: string) {
    if (!n.cancelar) return;
    setOcupado(n.id);
    const r = n.cancelar.porChave
      ? await cancelarPorChaveAction(n.cancelar.protocolo, motivo, justificativa)
      : await cancelNfseAction(n.cancelar.id, n.cancelar.protocolo, motivo, justificativa);
    setOcupado(null);
    setAviso(r.ok ? r.message : `Não consegui cancelar: ${r.message}`);
    if (r.ok) setConfirmarCancelamento(null);
    router.refresh();
  }

  // A nota de exemplo vai no fim das emitidas: mostra o layout e deixa testar
  // o detalhe e o "Ver nota" sem precisar emitir uma de verdade.
  const lista = lado === 'recebidas' ? notas.recebidas : [...notas.emitidas, NOTA_DE_EXEMPLO];
  const totalMarcado = lista.filter((n) => marcados.has(n.id)).reduce((s, n) => s + n.valor, 0);

  return (
    <div className="space-y-10">
      <SectionHero
        rightSlot={
          // O que mais se faz aqui é emitir: o convite fica no alto, ao lado do título.
          <button
            type="button"
            onClick={() => emitir()}
            aria-pressed={aba === 'emitir'}
            className={`group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold ${
              aba === 'emitir'
                ? 'border border-black/15 text-ink dark:border-white/20'
                : 'botao-emitir bg-hexxa-forest text-hexxa-lime shadow-[0_8px_24px_rgba(30,51,40,0.25)] hover:bg-hexxa-green dark:bg-hexxa-lime dark:text-hexxa-forest dark:hover:bg-hexxa-lime'
            }`}
          >
            <Plus className="h-4 w-4" />
            Emitir nota fiscal
            {aba !== 'emitir' && <ArrowRight className="botao-emitir-seta h-4 w-4" />}
          </button>
        }
        title="Notas"
        subtitulo="O faturamento nota por nota, direto do Emissor Nacional"
        infoTitle="Sobre as Notas"
        infoDescription="Toda nota emitida ou recebida pelo CNPJ da empresa, venha do sistema que vier, chega pelo Emissor Nacional do governo — é ela que vale como faturamento. A sincronização roda todo dia de madrugada; você também pode sincronizar na hora."
      />
      {aviso && (
        <p className="rounded-2xl border border-black/5 bg-black/[0.03] px-4 py-3 text-xs font-semibold text-ink dark:border-white/10 dark:bg-white/5">
          {aviso}
        </p>
      )}

      {/* Os números ficam fixos no topo; as abas e o emitir vêm logo abaixo. */}
      <GradeDeResumo colunas={3}>
        <CardResumo
          destaque
          rotulo={periodo ? `Emitidas ${textoDoPeriodo(periodo)}` : `Emitidas em ${MESES[Number(mes.slice(5)) - 1]}`}
          valor={BRL.format(faturado)}
          nota={`${validas.length} ${validas.length === 1 ? 'nota' : 'notas'} · imposto estimado ${BRL.format(imposto)} (${aliquota.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ${aliquotaApurada ? 'apurado' : 'estimado'})${notas.comErro.length ? ` · ${notas.comErro.length} com erro` : ''}`}
          onClick={() => {
            setAba('emitidas');
            trocarLado('emitidas');
          }}
        />
        <CardResumo
          rotulo="Agendadas"
          valor={ativasAgendadas.length}
          nota={
            ativasAgendadas[0]
              ? `próxima ${ativasAgendadas[0].proximaData.split('-').reverse().join('/')} · ${nomeDeExibicao(ativasAgendadas[0].cliente)}`
              : 'Nenhuma nota agendada'
          }
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            tabs={[
              { id: 'emitidas', label: 'Emitidas', badge: alertaDaAba(notas.comErro.length) },
              { id: 'agendadas', label: 'Agendadas' },
              { id: 'pendentes', label: 'Pendentes', badge: alertaDaAba(emissao.pendentes.filter((p) => p.atrasada).length) },
            ]}
            activeTab={aba === 'emitir' ? '' : aba}
            onChange={(id) => setAba(id as Aba)}
            layoutId="notasAbas"
          />
        </div>
        {aba === 'emitidas' && (
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
                  <div className="flex flex-wrap items-center gap-3">
                    <SegmentedTabs
                      size="sm"
                      tabs={[
                        { id: 'emitidas', label: 'Emitidas' },
                        { id: 'recebidas', label: 'Recebidas' },
                      ]}
                      activeTab={lado}
                      onChange={(id) => trocarLado(id as Lado)}
                      layoutId="notasLado"
                    />
                    <FiltroDePeriodo key={periodo ? `${periodo.de}${periodo.ate}` : 'mes'} periodo={periodo} aoEscolher={verPeriodo} />
                  </div>
                  <button
                    type="button"
                    onClick={sync}
                    disabled={sincronizando}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
                  >
                    {sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Sincronizar com o Emissor Nacional
                    {notas.ultimaSincronizacao && <span className="font-normal"> · última nota recebida em {quando(notas.ultimaSincronizacao)}</span>}
                  </button>
                </div>
                {marcados.size > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-hexxa-forest/25 bg-white/55 py-2 pl-5 pr-2 backdrop-blur-xl dark:border-hexxa-lime/25 dark:bg-white/5">
                    <p className="text-xs text-ink">
                      <strong>
                        {marcados.size} {marcados.size === 1 ? 'nota selecionada' : 'notas selecionadas'}
                      </strong>
                      <span className="text-ink-soft"> · {BRL.format(totalMarcado)}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setMarcados(new Set())} className="px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={baixarMarcadas}
                        disabled={baixando}
                        className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest px-4 py-1.5 text-xs font-semibold text-hexxa-lime hover:bg-hexxa-green disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
                      >
                        {baixando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {baixando ? 'Preparando o arquivo…' : 'Baixar PDF e XML'}
                      </button>
                    </div>
                  </div>
                )}
                {lista.length === 0 ? (
                  <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
                    {lado === 'recebidas' ? `Nenhuma nota recebida ${oPeriodo}.` : `Nenhuma nota emitida ${oPeriodo}.`}
                  </p>
                ) : (
                  <ListaEmColunas
                    colunas={[
                      { rotulo: lado === 'recebidas' ? 'Prestador' : 'Tomador', largura: 'minmax(0,1fr)' },
                      { rotulo: 'Nota', largura: '5rem', alinhar: 'direita', soDesktop: true },
                      { rotulo: 'Emissão', largura: '5rem', alinhar: 'direita', soDesktop: true },
                      { rotulo: 'Situação', largura: '7.5rem', soDesktop: true },
                      { rotulo: 'Valor', largura: '8rem', alinhar: 'direita' },
                    ]}
                    itens={lista}
                    chave={(n) => n.id}
                    selecao={{ marcados, aoMudar: setMarcados, podeMarcar: (n) => Boolean(n.danfse) && !n.processando }}
                    apagada={(n) => n.cancelada}
                    celulas={(n) => {
                      const nome = n.parte ? nomeDeExibicao(n.parte) : 'Sem nome';
                      const [cor, texto] = n.cancelada
                        ? ['bg-black/25 dark:bg-white/25', 'Cancelada']
                        : n.exemplo
                          ? ['bg-sky-500', 'Exemplo']
                          : n.processando
                            ? ['bg-amber-500', 'Processando']
                            : n.origem === 'HEXX'
                              ? ['bg-amber-500', 'A caminho']
                              : ['bg-emerald-500', 'Autorizada'];
                      return [
                        <Titulo
                          key="t"
                          nome={nome}
                          monograma={iniciais(nome)}
                          apoio={n.descricao ?? (n.numero ? `Nota ${n.numero}` : dia(n.data))}
                          apagado={n.cancelada}
                        />,
                        <span key="n" className="text-xs tabular text-ink-soft">
                          {n.numero ?? '—'}
                        </span>,
                        <span key="d" className="text-xs tabular text-ink-soft">
                          {dia(n.data)}
                        </span>,
                        <Situacao key="s" cor={cor}>
                          {texto}
                        </Situacao>,
                        <Valor key="v" tom={n.cancelada ? 'suave' : 'padrao'}>
                          <span className={n.cancelada ? 'line-through' : ''}>
                            {lado === 'recebidas' ? '− ' : ''}
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
                            {n.cancelar &&
                              !n.cancelada &&
                              (confirmarCancelamento === n.id ? (
                                <CancelarNota
                                  ocupado={ocupado === n.id}
                                  onConfirmar={(m, j) => cancelar(n, m, j)}
                                  onVoltar={() => setConfirmarCancelamento(null)}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmarCancelamento(n.id)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 px-4 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-500/[0.06] dark:border-rose-400/40 dark:text-rose-300 dark:hover:bg-rose-400/10"
                                >
                                  Cancelar nota
                                </button>
                              ))}
                          </>
                        }
                      >
                        <Campo rotulo={lado === 'recebidas' ? 'Prestador' : 'Tomador'} largo>
                          {n.parte ?? '—'}
                        </Campo>
                        <Campo rotulo="Número">{n.numero ?? '—'}</Campo>
                        <Campo rotulo="Emitida em">{n.data ? new Date(n.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}</Campo>
                        <Campo rotulo="Valor">
                          <span className="font-serif tabular">{BRL.format(n.valor)}</span>
                        </Campo>
                        {n.descricao && (
                          <Campo rotulo="Serviço" largo>
                            {n.descricao}
                          </Campo>
                        )}
                        {lado !== 'recebidas' && (
                          <Campo rotulo="Emissão" largo>
                            {COMO_FOI_EMITIDA[n.emissao ?? 'HEXX']}
                            {n.origem === 'HEXX' && !n.exemplo && <span className="text-ink-soft"> · a caminho do Emissor Nacional</span>}
                          </Campo>
                        )}
                        {n.exemplo && (
                          <Campo rotulo="Origem" largo>
                            Nota de exemplo — não existe de verdade; serve para ver o layout
                          </Campo>
                        )}
                      </Detalhe>
                    )}
                  />
                )}
              </section>

              {lado === 'emitidas' && notas.comErro.length > 0 && (
                <section className="space-y-4">
                  <p className="rotulo text-rose-700 dark:text-rose-400">Tentativas de emissão com erro</p>
                  <ul className="divide-y divide-rose-500/10 rounded-[28px] border border-rose-500/20 bg-rose-500/[0.03]">
                    {notas.comErro.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">
                            {t.cliente ?? 'Tomador avulso'} · {BRL.format(t.valor)}
                          </p>
                          <p className="text-xs text-ink-soft">
                            Tentativa em {quando(t.em)} — não virou nota{t.descricao ? ` · ${t.descricao}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => descartar(t.id)}
                          disabled={ocupado === t.id}
                          className="text-xs font-semibold text-ink-soft hover:text-rose-600 disabled:opacity-50"
                        >
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

      {vendo?.danfse && (
        <VisualizadorDeArquivo
          src={vendo.danfse}
          titulo={`Nota ${vendo.numero ?? ''} · ${vendo.parte ? nomeDeExibicao(vendo.parte) : ''}`}
          onClose={() => setVendo(null)}
        />
      )}
    </div>
  );
}

/** Uma nota que não existe — só para ver o layout da DANFSe e testar a lista. */
/** Na visualização rápida: de onde a nota saiu (as emitidas ficam todas juntas). */
const COMO_FOI_EMITIDA: Record<NonNullable<NotaDoMes['emissao']> | 'HEXX', string> = {
  AGENDADA: 'Agendada — saiu sozinha na data marcada',
  UM_CLIQUE: 'Um clique, pela ficha do cliente',
  CONTRATO: 'Parcela de contrato',
  MANUAL: 'Manual, pela Hexx',
  EMISSOR: 'Fora da Hexx — no Emissor Nacional ou em outro sistema',
  HEXX: 'Pela Hexx',
};

const NOTA_DE_EXEMPLO: NotaDoMes = {
  id: 'exemplo',
  origem: 'HEXX',
  numero: 'EXEMPLO',
  data: new Date().toISOString(),
  parte: 'Cliente Exemplo Ltda',
  descricao: 'Consultoria em gestão financeira referente ao mês — nota de exemplo',
  valor: 2500,
  cancelada: false,
  danfse: '/api/nfse/exemplo',
  exemplo: true,
  emissao: 'AGENDADA',
};

/** O cancelamento com o motivo que o Emissor Nacional pede. */
function CancelarNota({
  ocupado,
  onConfirmar,
  onVoltar,
}: {
  ocupado: boolean;
  onConfirmar: (motivo: '1' | '2' | '9', justificativa: string) => void;
  onVoltar: () => void;
}) {
  const [motivo, setMotivo] = useState<'1' | '2' | '9'>('1');
  const [justificativa, setJustificativa] = useState('');
  const curta = justificativa.trim().length < 15;
  return (
    <div className="w-full space-y-2 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs">
      <p className="font-semibold text-rose-700 dark:text-rose-400">Cancelar no Emissor Nacional — não tem volta.</p>
      <div className="flex flex-wrap gap-3 text-ink">
        {(
          [
            ['1', 'Erro na emissão'],
            ['2', 'Serviço não prestado'],
            ['9', 'Outro motivo'],
          ] as const
        ).map(([v, t]) => (
          <label key={v} className="flex items-center gap-1.5">
            <input type="radio" checked={motivo === v} onChange={() => setMotivo(v)} /> {t}
          </label>
        ))}
      </div>
      <textarea
        value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)}
        rows={2}
        placeholder="Explique o motivo (mínimo 15 letras) — vai para o governo."
        className="w-full resize-none rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-ink outline-none dark:border-white/10 dark:bg-white/5"
      />
      <div className="flex gap-3">
        <button
          type="button"
          disabled={ocupado || curta}
          onClick={() => onConfirmar(motivo, justificativa)}
          className="rounded-full bg-rose-600 px-4 py-1.5 font-semibold text-white disabled:opacity-40"
        >
          {ocupado ? 'Cancelando…' : 'Confirmar cancelamento'}
        </button>
        <button type="button" onClick={onVoltar} className="text-ink-soft hover:text-ink">
          Voltar
        </button>
      </div>
    </div>
  );
}
