'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import type { Proposta, StatusDaProposta } from '@/lib/server/propostas';
import { NovoContrato } from '../contratos/NovoContrato';
import { enviarPropostaAction, excluirPropostaAction, ligarContratoAction, salvarPropostaAction } from './actions';

/**
 * PROPOSTAS.
 *
 * Cada linha diz em que pé está: rascunho, enviada, vista pelo cliente,
 * aceita (com quem aceitou), recusada, expirada. As ações seguem o caminho:
 * enviar o link → ver o PDF → transformar em contrato.
 */

type Cliente = { id: string; nome: string; documento: string | null; email: string | null };
type Filtro = 'TODAS' | 'ABERTAS' | 'ACEITAS' | 'ENCERRADAS';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR');
const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-hexxa-forest dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime';

const SITUACAO: Record<StatusDaProposta, { texto: (p: Proposta) => string; cor: string }> = {
  rascunho: { texto: () => 'Rascunho — ainda não enviada', cor: 'text-ink-soft' },
  enviada: { texto: (p) => `Enviada${p.enviadaEm ? ` em ${br(p.enviadaEm)}` : ''} — o cliente ainda não abriu`, cor: 'text-ink-soft' },
  vista: { texto: (p) => `Vista pelo cliente${p.vistaEm ? ` em ${br(p.vistaEm)}` : ''}`, cor: 'text-amber-700 dark:text-amber-400' },
  aprovada: { texto: (p) => `Aceita por ${p.decisao?.nome ?? 'o cliente'}${p.decisao ? ` em ${br(p.decisao.em)}` : ''}`, cor: 'text-emerald-700 dark:text-emerald-400' },
  rejeitada: { texto: (p) => `Recusada${p.decisao?.nota ? `: ${p.decisao.nota}` : ''}`, cor: 'text-rose-600 dark:text-rose-400' },
  expirada: { texto: (p) => `Expirou em ${br(p.validade)}`, cor: 'text-ink-soft/70' },
};

export function HubPropostas({ propostas, clientes, clienteInicial }: { propostas: Proposta[]; clientes: Cliente[]; clienteInicial: string | null }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [editando, setEditando] = useState<Proposta | 'nova' | null>(null);
  const [vendo, setVendo] = useState<Proposta | null>(null);
  const [virandoContrato, setVirandoContrato] = useState<Proposta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const jaAbriu = useRef(false);

  // Vindo da ficha do cliente ("Nova proposta"): já abre com ele escolhido.
  useEffect(() => {
    if (clienteInicial && !jaAbriu.current) {
      jaAbriu.current = true;
      setEditando('nova');
      router.replace('/meu-negocio/propostas' as never, { scroll: false });
    }
  }, [clienteInicial, router]);

  const abertas = propostas.filter((p) => ['rascunho', 'enviada', 'vista'].includes(p.status));
  const aceitas = propostas.filter((p) => p.status === 'aprovada');
  const lista =
    filtro === 'TODAS' ? propostas : filtro === 'ABERTAS' ? abertas : filtro === 'ACEITAS' ? aceitas : propostas.filter((p) => p.status === 'rejeitada' || p.status === 'expirada');
  const emAberto = abertas.filter((p) => p.status !== 'rascunho').reduce((s, p) => s + p.total, 0);
  const decididas = propostas.filter((p) => p.status === 'aprovada' || p.status === 'rejeitada');
  const conversao = decididas.length ? Math.round((aceitas.length / decididas.length) * 100) : null;

  const avisar = (m: string) => {
    setAviso(m);
    setTimeout(() => setAviso(null), 7000);
  };

  async function enviar(p: Proposta) {
    setOcupado(p.id);
    const r = await enviarPropostaAction(p.id);
    setOcupado(null);
    if (!r.ok || !r.link) return avisar(r.message);
    avisar(`Link da proposta: ${r.link} — mande para ${p.cliente.nome} por e-mail ou WhatsApp.`);
    router.refresh();
    // Copiar pode pedir permissão e nunca responder: não trava a tela por isso.
    const copiou = await Promise.race([
      navigator.clipboard?.writeText(r.link).then(() => true).catch(() => false) ?? Promise.resolve(false),
      new Promise<boolean>((ok) => setTimeout(() => ok(false), 1500)),
    ]);
    if (copiou) avisar(`Link copiado: ${r.link} — mande para ${p.cliente.nome} por e-mail ou WhatsApp.`);
  }

  async function excluir(p: Proposta) {
    if (!confirm(`Excluir a proposta ${p.numero}?`)) return;
    await excluirPropostaAction(p.id);
    router.refresh();
  }

  const whatsapp = (p: Proposta) =>
    p.link ? `https://wa.me/?text=${encodeURIComponent(`Olá! Segue a proposta "${p.titulo}": ${p.link}`)}` : null;

  return (
    <div className="space-y-10">
      {aviso && <p className="break-all rounded-2xl border border-black/5 bg-black/[0.03] px-4 py-3 text-xs font-semibold text-ink dark:border-white/10 dark:bg-white/5">{aviso}</p>}

      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo="Em negociação" valor={BRL.format(emAberto)} nota={`${abertas.filter((p) => p.status !== 'rascunho').length} propostas enviadas, sem resposta`} onClick={() => setFiltro('ABERTAS')} />
        <CardResumo rotulo="Aceitas" valor={aceitas.length} nota={aceitas.filter((p) => !p.contratoId).length ? `${aceitas.filter((p) => !p.contratoId).length} esperando virar contrato` : 'Todas já viraram contrato'} onClick={() => setFiltro('ACEITAS')} />
        <CardResumo rotulo="Taxa de aceite" valor={conversao === null ? '—' : `${conversao}%`} nota={decididas.length ? `${decididas.length} propostas respondidas` : 'Nenhuma resposta ainda'} />
      </GradeDeResumo>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FiltrosEmTexto<Filtro>
            ativo={filtro}
            onChange={setFiltro}
            filtros={[
              { id: 'TODAS', label: 'Todas', count: propostas.length },
              { id: 'ABERTAS', label: 'Em aberto', count: abertas.length },
              { id: 'ACEITAS', label: 'Aceitas', count: aceitas.length, badge: aceitas.filter((p) => !p.contratoId).length || undefined },
              { id: 'ENCERRADAS', label: 'Recusadas e expiradas', count: propostas.filter((p) => p.status === 'rejeitada' || p.status === 'expirada').length },
            ]}
          />
          <button
            type="button"
            onClick={() => setEditando('nova')}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Plus className="h-3.5 w-3.5" /> Nova proposta
          </button>
        </div>

        {lista.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
            {propostas.length === 0 ? 'Nenhuma proposta ainda.' : 'Nada neste filtro.'}{' '}
            {propostas.length === 0 && (
              <button type="button" onClick={() => setEditando('nova')} className="font-semibold text-ink underline-offset-4 hover:underline">
                Criar a primeira
              </button>
            )}
          </p>
        ) : (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
            {lista.map((p) => {
              const s = SITUACAO[p.status];
              const aberta = ['rascunho', 'enviada', 'vista', 'expirada'].includes(p.status);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{p.titulo}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {p.numero} · {p.cliente.nome} · válida até {br(p.validade)}
                    </p>
                    <p className={`mt-1 text-xs font-medium ${s.cor}`}>{s.texto(p)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs font-semibold">
                    <p className="font-serif text-sm font-bold tabular text-ink">
                      {BRL.format(p.total)}
                      <span className="font-sans text-[11px] font-normal text-ink-soft">{p.recorrencia === 'MENSAL' ? '/mês' : ''}</span>
                    </p>
                    <button type="button" onClick={() => setVendo(p)} className="text-ink-soft hover:text-ink">
                      PDF
                    </button>
                    {aberta && (
                      <button type="button" onClick={() => setEditando(p)} className="text-ink-soft hover:text-ink">
                        Editar
                      </button>
                    )}
                    {aberta && (
                      <button type="button" onClick={() => enviar(p)} disabled={ocupado === p.id} className="text-ink hover:underline underline-offset-4 disabled:opacity-50">
                        {ocupado === p.id ? <Loader2 className="inline h-3 w-3 animate-spin" /> : p.link ? 'Copiar link' : 'Enviar'}
                      </button>
                    )}
                    {aberta && p.link && (
                      <a href={whatsapp(p)!} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink">
                        WhatsApp
                      </a>
                    )}
                    {p.status === 'aprovada' &&
                      (p.contratoId ? (
                        <Link href={`/meu-negocio/contratos/${p.contratoId}` as Route} className="text-emerald-700 hover:underline dark:text-emerald-400">
                          Ver contrato
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVirandoContrato(p)}
                          className="rounded-full bg-hexxa-forest px-4 py-1.5 text-hexxa-lime dark:bg-hexxa-lime dark:text-hexxa-forest"
                        >
                          Transformar em contrato
                        </button>
                      ))}
                    {(p.status === 'rascunho' || p.status === 'rejeitada' || p.status === 'expirada') && (
                      <button type="button" onClick={() => excluir(p)} aria-label="Excluir" className="text-ink-soft hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editando && (
        <EditorDeProposta
          proposta={editando === 'nova' ? null : editando}
          clientes={clientes}
          clienteInicial={editando === 'nova' ? clienteInicial : null}
          onClose={() => setEditando(null)}
          onDone={(m) => {
            setEditando(null);
            avisar(m);
            router.refresh();
          }}
        />
      )}
      {vendo && <VisualizadorDeArquivo src={`/api/propostas/${vendo.id}/pdf`} titulo={`${vendo.numero} · ${vendo.titulo}`} onClose={() => setVendo(null)} />}
      {virandoContrato && (
        <NovoContrato
          tipoInicial="ENTRADA"
          preenchido={{
            documento: virandoContrato.cliente.documento ?? '',
            nome: virandoContrato.cliente.nome,
            email: virandoContrato.decisao?.email ?? virandoContrato.cliente.email ?? '',
            objeto: [virandoContrato.titulo, ...virandoContrato.itens.map((i) => i.descricao)].join('; '),
            valor: virandoContrato.total,
            meses: virandoContrato.prazoMeses,
          }}
          onCriado={(id) => ligarContratoAction(virandoContrato.id, id)}
          onClose={() => setVirandoContrato(null)}
          onDone={(m) => {
            setVirandoContrato(null);
            avisar(m);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditorDeProposta({
  proposta,
  clientes,
  clienteInicial,
  onClose,
  onDone,
}: {
  proposta: Proposta | null;
  clientes: Cliente[];
  clienteInicial: string | null;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const daquiA30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [clienteId, setClienteId] = useState(proposta?.cliente.id ?? clienteInicial ?? '');
  const [titulo, setTitulo] = useState(proposta?.titulo ?? '');
  const [itens, setItens] = useState(proposta?.itens.length ? proposta.itens.map((i) => ({ ...i, valorTexto: String(i.valor).replace('.', ',') })) : [{ descricao: '', qtd: 1, valor: 0, valorTexto: '' }]);
  const [recorrencia, setRecorrencia] = useState<'MENSAL' | 'UNICA'>(proposta?.recorrencia ?? 'MENSAL');
  const [meses, setMeses] = useState(proposta?.prazoMeses ? String(proposta.prazoMeses) : '12');
  const [validade, setValidade] = useState(proposta?.validade ?? daquiA30);
  const [obs, setObs] = useState(proposta?.observacoes ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const total = itens.reduce((s, i) => s + i.qtd * (Number(i.valorTexto.replace(/\./g, '').replace(',', '.')) || 0), 0);

  function mudar(k: number, campoNome: 'descricao' | 'qtd' | 'valorTexto', v: string) {
    setItens((lista) => lista.map((i, j) => (j === k ? { ...i, [campoNome]: campoNome === 'qtd' ? Math.max(0, Number(v) || 0) : v } : i)));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarPropostaAction({
        id: proposta?.id,
        customerId: clienteId,
        titulo,
        itens: itens.map((i) => ({ descricao: i.descricao, qtd: i.qtd, valor: Number(i.valorTexto.replace(/\./g, '').replace(',', '.')) || 0 })),
        recorrencia,
        prazoMeses: recorrencia === 'MENSAL' && meses ? Number(meses) : null,
        validade,
        observacoes: obs,
      });
      if (!r.ok) return setErro(r.message);
      onDone(r.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-surface shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3 border-b border-black/5 px-6 py-5 dark:border-white/10">
          <div>
            <p className="rotulo text-ink-soft">{proposta ? `Editar ${proposta.numero}` : 'Nova proposta'}</p>
            <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{titulo || 'Proposta'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="rotulo text-ink-soft">Cliente</span>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={campo}>
                <option value="">Escolha…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <Link href="/relacionamento" className="mt-1 inline-block text-[11px] text-ink-soft hover:text-ink">
                Cliente novo? Cadastre em Clientes
              </Link>
            </label>
            <label className="block">
              <span className="rotulo text-ink-soft">Válida até</span>
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={campo} />
            </label>
          </div>
          <label className="block">
            <span className="rotulo text-ink-soft">Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Gestão de redes sociais" className={campo} />
          </label>

          <div className="space-y-2">
            <p className="rotulo text-ink-soft">Itens</p>
            {itens.map((i, k) => (
              <div key={k} className="grid grid-cols-[1fr_64px_110px_24px] items-center gap-2">
                <input value={i.descricao} onChange={(e) => mudar(k, 'descricao', e.target.value)} placeholder="O que será entregue" className={`${campo} mt-0`} />
                <input value={i.qtd} onChange={(e) => mudar(k, 'qtd', e.target.value)} inputMode="decimal" className={`${campo} mt-0 text-right`} />
                <input value={i.valorTexto} onChange={(e) => mudar(k, 'valorTexto', e.target.value)} inputMode="decimal" placeholder="0,00" className={`${campo} mt-0 text-right`} />
                <button type="button" onClick={() => setItens((l) => (l.length > 1 ? l.filter((_, j) => j !== k) : l))} aria-label="Remover item" className="text-ink-soft hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setItens((l) => [...l, { descricao: '', qtd: 1, valor: 0, valorTexto: '' }])} className="text-xs font-semibold text-ink-soft hover:text-ink">
              + Adicionar item
            </button>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-black/5 pt-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {(['MENSAL', 'UNICA'] as const).map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-ink">
                  <input type="radio" checked={recorrencia === r} onChange={() => setRecorrencia(r)} />
                  {r === 'MENSAL' ? 'Mensal' : 'Pagamento único'}
                </label>
              ))}
              {recorrencia === 'MENSAL' && (
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  por
                  <input value={meses} onChange={(e) => setMeses(e.target.value.replace(/\D/g, ''))} className="w-12 rounded-lg border border-black/10 bg-transparent px-2 py-1 text-right text-sm text-ink dark:border-white/10" />
                  meses
                </label>
              )}
            </div>
            <p className="font-serif text-xl font-bold tabular text-ink">
              {BRL.format(total)}
              <span className="font-sans text-xs font-normal text-ink-soft">{recorrencia === 'MENSAL' ? ' por mês' : ''}</span>
            </p>
          </div>

          <label className="block">
            <span className="rotulo text-ink-soft">Observações para o cliente (opcional)</span>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Escopo, prazos de entrega, o que não está incluso…" className={`${campo} resize-none`} />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/5 px-6 py-4 dark:border-white/10">
          {erro ? <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p> : <span />}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-6 py-2.5 text-xs font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar proposta
          </button>
        </div>
      </div>
    </div>
  );
}
