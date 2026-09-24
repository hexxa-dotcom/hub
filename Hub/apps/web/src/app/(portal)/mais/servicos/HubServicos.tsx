'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Loader2, Paperclip, Search, X } from 'lucide-react';
import { SegmentedTabs, alertaDaAba } from '@/components/ui/SegmentedTabs';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import { textoDoPreco } from '@/lib/servicos-preco';
import type { Pedido, ServicoDoCatalogo, SituacaoDoPedido } from '@/lib/server/servicos';
import { useAnexo } from '@/lib/useAnexo';
import { cancelarPedidoAction, pedirServicoAction, responderPedidoAction } from './actions';

/**
 * SERVIÇOS ADICIONAIS.
 *
 * Duas abas: o catálogo (lista por categoria, com busca, o prazo e o preço
 * que o contador definiu) e os pedidos (cada um com protocolo, situação e a
 * conversa inteira, com anexos). "Pedir" abre o pedido já com o serviço; um
 * link com ?pedir=<nome> (vindo dos Documentos) abre direto.
 */

const OUTRO = 'Outro serviço (descreva)';

const SITUACAO: Record<SituacaoDoPedido, { texto: string; cor: string }> = {
  RECEBIDO: { texto: 'Recebido', cor: 'text-ink-soft' },
  EM_ANDAMENTO: { texto: 'Em andamento', cor: 'text-amber-700 dark:text-amber-400' },
  AGUARDANDO_VOCE: { texto: 'Aguardando você', cor: 'text-rose-600 dark:text-rose-400' },
  CONCLUIDO: { texto: 'Concluído', cor: 'text-emerald-700 dark:text-emerald-400' },
  CANCELADO: { texto: 'Cancelado', cor: 'text-ink-soft/70' },
};
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-hexxa-forest dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime';

export function HubServicos({ catalogo, pedidos, pedirInicial }: { catalogo: ServicoDoCatalogo[]; pedidos: Pedido[]; pedirInicial: string | null }) {
  const router = useRouter();
  const abertos = pedidos.filter((p) => p.situacao !== 'CONCLUIDO' && p.situacao !== 'CANCELADO');
  const comVoce = pedidos.filter((p) => p.situacao === 'AGUARDANDO_VOCE').length;
  const [aba, setAba] = useState<'catalogo' | 'pedidos'>(abertos.length && !pedirInicial ? 'pedidos' : 'catalogo');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('TODAS');
  const [pedindo, setPedindo] = useState<ServicoDoCatalogo | { nome: string } | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Vindo de "Pedir à contabilidade" nos Documentos: já abre o pedido certo —
  // uma vez só, e tira o ?pedir= do endereço para não reabrir ao atualizar.
  const jaAbriu = useRef(false);
  useEffect(() => {
    if (!pedirInicial || jaAbriu.current) return;
    jaAbriu.current = true;
    setPedindo(catalogo.find((s) => s.nome === pedirInicial) ?? { nome: pedirInicial });
    router.replace('/mais/servicos' as never, { scroll: false });
  }, [pedirInicial, catalogo, router]);

  const categorias = useMemo(() => Array.from(new Set(catalogo.map((s) => s.categoria))), [catalogo]);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return catalogo.filter(
      (s) =>
        (categoria === 'TODAS' || s.categoria === categoria) &&
        (!q || `${s.nome} ${s.descricao} ${s.categoria}`.toLowerCase().includes(q)),
    );
  }, [catalogo, busca, categoria]);

  const concluir = (m: string) => {
    setAviso(m);
    setTimeout(() => setAviso(null), 6000);
    router.refresh();
  };

  return (
    <div className="space-y-10">
      {aviso && <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">{aviso}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedTabs
          tabs={[
            { id: 'catalogo', label: 'Catálogo' },
            { id: 'pedidos', label: 'Meus pedidos', badge: alertaDaAba(comVoce) },
          ]}
          activeTab={aba}
          onChange={(id) => setAba(id as 'catalogo' | 'pedidos')}
          layoutId="servicosAbas"
        />
        <button type="button" onClick={() => setPedindo({ nome: OUTRO })} className="text-xs font-semibold text-ink-soft hover:text-ink">
          Precisa de algo fora da lista?
        </button>
      </div>

      {aba === 'catalogo' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <FiltrosEmTexto
              ativo={categoria}
              onChange={setCategoria}
              filtros={[{ id: 'TODAS', label: 'Todos' }, ...categorias.map((c) => ({ id: c, label: c }))]}
            />
            <label className="flex w-full items-center gap-2 border-b border-black/10 pb-1.5 sm:w-64 dark:border-white/15">
              <Search className="h-3.5 w-3.5 text-ink-soft" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar serviço" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60" />
            </label>
          </div>

          {filtrados.length === 0 ? (
            <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
              Nenhum serviço encontrado.{' '}
              <button type="button" onClick={() => setPedindo({ nome: OUTRO })} className="font-semibold text-ink underline-offset-4 hover:underline">
                Descrever o que preciso
              </button>
            </p>
          ) : (
            (categoria === 'TODAS' ? categorias : [categoria]).map((cat) => {
              const daCat = filtrados.filter((s) => s.categoria === cat);
              if (!daCat.length) return null;
              return (
                <section key={cat} className="space-y-3">
                  <p className="rotulo text-ink-soft">{cat}</p>
                  <ul className="divide-y divide-black/5 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
                    {daCat.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{s.nome}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">{s.descricao}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-6">
                          <div className="text-right">
                            <p className={`text-xs font-semibold ${s.precoTipo === 'INCLUSO' ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink'}`}>{textoDoPreco(s.precoTipo, s.preco)}</p>
                            <p className="text-[11px] text-ink-soft">{s.prazo}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPedindo(s)}
                            className="rounded-full px-4 py-2 text-xs font-bold text-ink ring-1 ring-black/10 transition-colors hover:ring-black/25 dark:ring-white/15 dark:hover:ring-white/30"
                          >
                            Pedir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      ) : pedidos.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
          Nenhum pedido ainda.{' '}
          <button type="button" onClick={() => setAba('catalogo')} className="font-semibold text-ink underline-offset-4 hover:underline">
            Ver o catálogo
          </button>
        </p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-[28px] border border-black/5 dark:divide-white/10 dark:border-white/10">
          {pedidos.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setAbertoId(p.id)} className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{p.servico}</p>
                  <p className="text-xs text-ink-soft">
                    {p.protocolo} · pedido em {quando(p.criadoEm)}
                    {p.urgente ? ' · urgente' : ''} · {p.mensagens.length} {p.mensagens.length === 1 ? 'mensagem' : 'mensagens'}
                  </p>
                </div>
                <span className={`text-xs font-semibold ${SITUACAO[p.situacao].cor}`}>{SITUACAO[p.situacao].texto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pedindo && (
        <NovoPedido
          servico={pedindo}
          onClose={() => setPedindo(null)}
          onDone={(m) => {
            setPedindo(null);
            setAba('pedidos');
            concluir(m);
          }}
        />
      )}
      {abertoId && pedidos.find((p) => p.id === abertoId) && (
        <ConversaDoPedido pedido={pedidos.find((p) => p.id === abertoId)!} onClose={() => setAbertoId(null)} onChange={concluir} />
      )}
    </div>
  );
}

function NovoPedido({ servico, onClose, onDone }: { servico: ServicoDoCatalogo | { nome: string }; onClose: () => void; onDone: (m: string) => void }) {
  const doCatalogo = 'precoTipo' in servico ? servico : null;
  const [nome, setNome] = useState(servico.nome === OUTRO ? '' : servico.nome);
  const [descricao, setDescricao] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const a = useAnexo();

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await pedirServicoAction({ servico: nome, descricao, urgente, anexo: a.anexo });
      if (!r.ok) return setErro(r.message);
      onDone(r.message);
    } catch {
      setErro('Não consegui enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-black/5 bg-surface p-6 shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="rotulo text-ink-soft">Pedir à contabilidade</p>
            {doCatalogo ? (
              <>
                <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{doCatalogo.nome}</h2>
                <p className="mt-1 text-xs text-ink-soft">
                  {textoDoPreco(doCatalogo.precoTipo, doCatalogo.preco)} · {doCatalogo.prazo}
                </p>
              </>
            ) : (
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Qual serviço?" className={campo} autoFocus />
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="rotulo text-ink-soft">O que você precisa</span>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} placeholder="Datas, valores, para que é — o que ajudar a contabilidade a resolver de primeira." className={`${campo} resize-none`} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {a.input}
            <button type="button" onClick={a.abrir} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
              <FileUp className="h-3.5 w-3.5" /> {a.anexo ? a.anexo.nome : 'Anexar arquivo'}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
              <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} /> É urgente
            </label>
          </div>
          {(erro || a.erro) && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{erro || a.erro}</p>}
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-3 text-sm font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Enviar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversaDoPedido({ pedido, onClose, onChange }: { pedido: Pedido; onClose: () => void; onChange: (m: string) => void }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vendo, setVendo] = useState<{ href: string; nome: string } | null>(null);
  const a = useAnexo();
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [pedido.mensagens.length]);

  async function responder() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await responderPedidoAction(pedido.id, texto, a.anexo);
      if (!r.ok) return setErro(r.message);
      setTexto('');
      a.setAnexo(null);
      onChange(r.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    if (!confirm('Cancelar este pedido?')) return;
    const r = await cancelarPedidoAction(pedido.id);
    onClose();
    onChange(r.message);
  }

  const encerrado = pedido.situacao === 'CANCELADO';
  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-surface shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3 border-b border-black/5 px-6 py-5 dark:border-white/10">
          <div className="min-w-0">
            <p className="rotulo text-ink-soft">
              {pedido.protocolo} · <span className={SITUACAO[pedido.situacao].cor}>{SITUACAO[pedido.situacao].texto}</span>
            </p>
            <h2 className="mt-1 truncate text-lg font-light uppercase tracking-[0.05em] text-ink">{pedido.servico}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {pedido.mensagens.map((m) => (
            <div key={m.id} className={`flex ${m.daContabilidade ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.daContabilidade ? 'bg-black/[0.04] dark:bg-white/[0.06]' : 'bg-hexxa-forest text-white dark:bg-hexxa-lime/15 dark:text-ink'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${m.daContabilidade ? 'text-ink-soft' : 'text-white/60 dark:text-ink-soft'}`}>
                  {m.daContabilidade ? 'Contabilidade' : 'Você'} · {quando(m.em)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.texto}</p>
                {m.anexo && (
                  <button type="button" onClick={() => setVendo(m.anexo)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-4 hover:underline">
                    <Paperclip className="h-3 w-3" /> {m.anexo.nome}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={fim} />
        </div>

        {!encerrado && (
          <div className="space-y-3 border-t border-black/5 px-6 py-4 dark:border-white/10">
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escreva para a contabilidade" className={`${campo} mt-0 resize-none`} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {a.input}
                <button type="button" onClick={a.abrir} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
                  <FileUp className="h-3.5 w-3.5" /> {a.anexo ? a.anexo.nome : 'Anexar'}
                </button>
                {pedido.situacao !== 'CONCLUIDO' && (
                  <button type="button" onClick={cancelar} className="text-xs font-semibold text-ink-soft hover:text-rose-600">
                    Cancelar pedido
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={responder}
                disabled={enviando}
                className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2 text-xs font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
              >
                {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar
              </button>
            </div>
            {(erro || a.erro) && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{erro || a.erro}</p>}
          </div>
        )}
      </div>
    </div>
    {vendo && <VisualizadorDeArquivo src={vendo.href} titulo={vendo.nome} onClose={() => setVendo(null)} />}
    </>
  );
}
