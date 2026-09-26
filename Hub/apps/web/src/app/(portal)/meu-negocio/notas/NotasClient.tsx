'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { SegmentedTabs, alertaDaAba } from '@/components/ui/SegmentedTabs';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import { FinanceiroMonthSelector } from '../hub-financeiro/FinanceiroMonthSelector';
import type { NotasDoMes, NotaDoMes } from '@/lib/server/notas';
import { syncDfeAction } from './dfeActions';
import { descartarTentativaAction } from './actions';
import { cancelNfseAction } from '../nfse/actions';
import { EmitirNota } from './HubNotas';
import { ListaEmColunas, Titulo, Valor, Situacao, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';
import { nomeDeExibicao, iniciais } from '@/lib/nome-de-exibicao';

/**
 * NOTAS DO MÊS.
 *
 * Três abas: emitidas (o faturamento), recebidas (despesas com nota) e
 * emitir. Clicar numa nota abre a DANFSe dentro do Hub. As tentativas de
 * emissão que deram erro ficam à parte, com "descartar".
 */

type Aba = 'emitidas' | 'recebidas' | 'emitir';
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
    customers: { id: string; name: string; document: string | null; email: string | null }[];
    taxRatePercent: number;
  };
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [vendo, setVendo] = useState<NotaDoMes | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sincronizando, sincronizar] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState<string | null>(null);
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
        <SegmentedTabs
          tabs={[
            { id: 'emitidas', label: `Emitidas`, badge: alertaDaAba(notas.comErro.length) },
            { id: 'recebidas', label: 'Recebidas' },
            { id: 'emitir', label: 'Emitir nota' },
          ]}
          activeTab={aba}
          onChange={(id) => setAba(id as Aba)}
          layoutId="notasAbas"
        />
        {aba !== 'emitir' && (
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
        emissao.bloqueada ? (
          <div className="rounded-[28px] border border-black/5 p-8 dark:border-white/10">
            <p className="rotulo text-ink-soft">Emitir pela Hexx</p>
            <p className="mt-3 text-xl font-light leading-snug text-ink">A emissão pela Hexx libera em novembro para empresas do Simples Nacional.</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
              É quando o Emissor Nacional abre a emissão por sistema para o Simples. Até lá, emita no próprio Emissor Nacional — a nota volta
              sozinha para cá na sincronização (todo dia de madrugada, ou agora, no botão de sincronizar) e entra no faturamento e no
              financeiro.
            </p>
            <a
              href="https://www.nfse.gov.br/EmissorNacional"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime dark:bg-hexxa-lime dark:text-hexxa-forest"
            >
              Abrir o Emissor Nacional <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <EmitirNota
            mode={emissao.mode}
            customers={emissao.customers}
            certOk={emissao.certOk}
            fiscalOk={emissao.fiscalOk}
            profiles={emissao.profiles as never}
            taxRatePercent={emissao.taxRatePercent}
          />
        )
      ) : (
        <>
          <GradeDeResumo colunas={3}>
            <CardResumo
              destaque
              rotulo={`Faturado em ${MESES[Number(mes.slice(5)) - 1]}`}
              valor={BRL.format(faturado)}
              nota={`${validas.length} ${validas.length === 1 ? 'nota emitida' : 'notas emitidas'}${mes === atual ? ' até agora' : ''}`}
            />
            <CardResumo
              rotulo="Imposto estimado"
              valor={BRL.format(imposto)}
              nota={`${aliquota.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ${aliquotaApurada ? 'apurado pela contabilidade' : 'estimado'} · ver Bússola`}
              href="/minha-contabilidade/termometro-tributario"
            />
            <CardResumo
              rotulo="Notas recebidas"
              valor={BRL.format(recebido)}
              nota={`${notas.recebidas.length} ${notas.recebidas.length === 1 ? 'nota de fornecedor' : 'notas de fornecedores'}`}
              onClick={() => setAba('recebidas')}
            />
          </GradeDeResumo>

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

      {vendo?.danfse && <VisualizadorDeArquivo src={vendo.danfse} titulo={`Nota ${vendo.numero ?? ''} · ${vendo.parte ? nomeDeExibicao(vendo.parte) : ''}`} onClose={() => setVendo(null)} />}
    </div>
  );
}
