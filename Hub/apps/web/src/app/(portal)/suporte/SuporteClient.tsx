'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, Loader2, MessageCircle, Paperclip, Plus, Send, X } from 'lucide-react';
import { SectionHero } from '@/components/ui/SectionHero';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import { useAnexo } from '@/lib/useAnexo';
import {
  createSupportTicketAction,
  sendSupportMessageAction,
  scheduleMeetingAction,
  concluirConversaAction,
  type SupportTicketRow,
} from './actions';

type Filtro = 'ABERTAS' | 'CONCLUIDAS';
export type ContatoDoEscritorio = { nome: string; email: string | null; horario: string | null; whatsappUrl: string | null };

const SITUACAO: Record<SupportTicketRow['status'], { texto: string; cor: string }> = {
  OPEN: { texto: 'Enviada', cor: 'text-ink-soft' },
  IN_PROGRESS: { texto: 'Em atendimento', cor: 'text-amber-700 dark:text-amber-400' },
  WAITING_CLIENT: { texto: 'Aguardando você', cor: 'text-rose-600 dark:text-rose-400' },
  RESOLVED: { texto: 'Concluída', cor: 'text-emerald-700 dark:text-emerald-400' },
  CLOSED: { texto: 'Encerrada', cor: 'text-ink-soft/70' },
};
const concluida = (t: SupportTicketRow) => t.status === 'RESOLVED' || t.status === 'CLOSED';
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const campo =
  'mt-1.5 w-full rounded-2xl border border-black/5 bg-surface-card px-4 py-2.5 text-sm text-ink shadow-(--elev-inset) outline-none focus:ring-2 focus:ring-hexxa-green dark:border-white/5 dark:focus:ring-hexxa-lime';
const botao =
  'inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest';

export function SuporteClient({ initialTickets, escritorio }: { initialTickets: SupportTicketRow[]; escritorio: ContatoDoEscritorio }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('ABERTAS');
  const abertas = initialTickets.filter((t) => !concluida(t));
  const lista = filtro === 'ABERTAS' ? abertas : initialTickets.filter(concluida);
  const [ativaId, setAtivaId] = useState<string | null>(abertas[0]?.id ?? initialTickets[0]?.id ?? null);
  const ativa = initialTickets.find((t) => t.id === ativaId) ?? null;
  const [nova, setNova] = useState(false);
  const [reuniao, setReuniao] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const comVoce = abertas.filter((t) => t.respondido || t.status === 'WAITING_CLIENT').length;

  function aberta(id: string | undefined, msg: string) {
    setNova(false);
    setReuniao(false);
    setFiltro('ABERTAS');
    if (id) setAtivaId(id);
    setAviso(msg);
    router.refresh();
  }

  return (
    <div className="space-y-16">
      <SectionHero
        subtitulo={escritorio.nome ? `Converse com ${escritorio.nome}` : 'Converse com a sua contabilidade'}
        title="Atendimento"
        infoTitle="Sobre o Atendimento"
        infoDescription="Suas conversas com a contabilidade, com anexos e o histórico de tudo. A contabilidade responde por aqui; quando precisar de algo seu, a conversa fica marcada como aguardando você. Pedidos de serviço (certidões, alterações) ficam em Serviços Adicionais."
      />

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FiltrosEmTexto<Filtro>
            ativo={filtro}
            onChange={setFiltro}
            filtros={[
              { id: 'ABERTAS', label: 'Em aberto', count: abertas.length, badge: comVoce || undefined },
              { id: 'CONCLUIDAS', label: 'Concluídas', count: initialTickets.length - abertas.length },
            ]}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setReuniao(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
              <Calendar className="h-3.5 w-3.5" /> Pedir reunião
            </button>
            {escritorio.whatsappUrl && (
              <a href={escritorio.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            <button type="button" onClick={() => setNova(true)} className={botao}>
              <Plus className="h-3.5 w-3.5" /> Nova conversa
            </button>
          </div>
        </div>

        {aviso && (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> {aviso}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
          <section className="space-y-3">
            {lista.length === 0 ? (
              <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
                {filtro === 'ABERTAS' ? 'Nenhuma conversa em aberto. Precisa de algo? Comece uma nova conversa.' : 'Nenhuma conversa concluída.'}
              </p>
            ) : (
              <ul className="divide-y divide-black/[0.08] overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/[0.12] dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
                {lista.map((t) => {
                  const s = SITUACAO[t.status];
                  const pendente = !concluida(t) && (t.respondido || t.status === 'WAITING_CLIENT');
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setAtivaId(t.id)}
                        className={`flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors ${t.id === ativaId ? 'bg-black/[0.04] dark:bg-white/[0.06]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{t.subject}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {t.category ?? 'Geral'} · <span className={`font-semibold ${pendente ? 'text-rose-600 dark:text-rose-400' : s.cor}`}>{pendente && t.status !== 'WAITING_CLIENT' ? 'Respondida' : s.texto}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[11px] tabular text-ink-soft">{quando(t.lastMessageAt)}</span>
                          {pendente && <span className="h-2 w-2 rounded-full bg-rose-500" aria-label="Resposta nova" />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="px-1 text-xs leading-relaxed text-ink-soft">
              {escritorio.horario ? `Atendimento: ${escritorio.horario}. ` : ''}
              Para certidões, alterações e outros serviços, use{' '}
              <Link href="/mais/servicos" className="font-semibold text-ink underline-offset-4 hover:underline">
                Serviços Adicionais
              </Link>
              .
            </p>
          </section>

          {ativa ? (
            <Conversa key={ativa.id} conversa={ativa} onChanged={() => router.refresh()} />
          ) : (
            <div className="hidden items-center justify-center rounded-[28px] border border-dashed border-black/10 p-10 text-sm text-ink-soft lg:flex dark:border-white/10">
              Escolha uma conversa ao lado.
            </div>
          )}
        </div>
      </div>

      {nova && <NovaConversa onClose={() => setNova(false)} onDone={aberta} />}
      {reuniao && <PedirReuniao onClose={() => setReuniao(false)} onDone={aberta} />}
    </div>
  );
}

function Conversa({ conversa, onChanged }: { conversa: SupportTicketRow; onChanged: () => void }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vendo, setVendo] = useState<{ href: string; nome: string } | null>(null);
  const a = useAnexo();
  const fim = useRef<HTMLDivElement>(null);
  const s = SITUACAO[conversa.status];

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' });
  }, [conversa.messages.length]);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await sendSupportMessageAction(conversa.id, texto, a.anexo);
      if (!r.ok) return setErro(r.message);
      setTexto('');
      a.setAnexo(null);
      onChanged();
    } finally {
      setEnviando(false);
    }
  }

  async function concluir() {
    await concluirConversaAction(conversa.id);
    onChanged();
  }

  return (
    <section className="flex h-[calc(100vh-16rem)] min-h-[480px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
      <div className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-4 dark:border-white/10">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{conversa.subject}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {conversa.category ?? 'Geral'} · <span className={`font-semibold ${s.cor}`}>{s.texto}</span> · aberta em {quando(conversa.createdAt)}
          </p>
        </div>
        {!concluida(conversa) && (
          <button type="button" onClick={concluir} className="shrink-0 text-xs font-semibold text-ink-soft hover:text-ink">
            Marcar como resolvida
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {conversa.messages.map((m) => {
          const minha = m.sender === 'client';
          return (
            <div key={m.id} className={`flex flex-col ${minha ? 'items-end' : 'items-start'}`}>
              <span className="mb-1 px-1 text-[10px] text-ink-soft">
                {minha ? 'Você' : 'Contabilidade'} · {quando(m.em)}
              </span>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  minha ? 'rounded-br-md bg-hexxa-forest text-white dark:bg-hexxa-lime/15 dark:text-ink' : 'rounded-bl-md bg-black/[0.04] text-ink dark:bg-white/[0.06]'
                }`}
              >
                {m.text}
                {m.anexo && (
                  <button
                    type="button"
                    onClick={() => setVendo(m.anexo)}
                    className={`mt-2 flex items-center gap-1.5 text-xs font-semibold underline-offset-4 hover:underline ${minha ? 'text-hexxa-lime dark:text-ink' : 'text-ink'}`}
                  >
                    <Paperclip className="h-3.5 w-3.5" /> {m.anexo.nome}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      <div className="border-t border-black/5 px-4 py-3 dark:border-white/10">
        {a.anexo && (
          <p className="mb-2 flex items-center gap-2 px-2 text-xs text-ink-soft">
            <Paperclip className="h-3.5 w-3.5" /> {a.anexo.nome}
            <button type="button" onClick={() => a.setAnexo(null)} aria-label="Tirar anexo" className="text-ink-soft hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        )}
        {(erro || a.erro) && <p className="mb-2 px-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro || a.erro}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="flex items-end gap-2"
        >
          {a.input}
          <button type="button" onClick={a.abrir} aria-label="Anexar arquivo" title="Anexar PDF ou imagem" className="rounded-full p-2.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder={concluida(conversa) ? 'Escreva para reabrir a conversa…' : 'Escreva sua mensagem…'}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-black/5 bg-surface-card px-4 py-2.5 text-sm text-ink shadow-(--elev-inset) outline-none focus:ring-2 focus:ring-hexxa-green dark:border-white/5 dark:focus:ring-hexxa-lime"
          />
          <button type="submit" disabled={enviando || (!texto.trim() && !a.anexo)} aria-label="Enviar" className={`${botao} h-[42px] px-4`}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {vendo && <VisualizadorDeArquivo src={vendo.href} titulo={vendo.nome} onClose={() => setVendo(null)} />}
    </section>
  );
}

function Modal({ titulo, rotulo, onClose, children }: { titulo: string; rotulo: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-black/5 bg-surface p-6 shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="rotulo text-ink-soft">{rotulo}</p>
            <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{titulo}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ASSUNTOS = ['Impostos e guias', 'Notas fiscais', 'Contabilidade e relatórios', 'Pessoal e pró-labore', 'Outros'];

function NovaConversa({ onClose, onDone }: { onClose: () => void; onDone: (id: string | undefined, msg: string) => void }) {
  const [assunto, setAssunto] = useState('');
  const [categoria, setCategoria] = useState(ASSUNTOS[0]!);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const a = useAnexo();

  async function enviar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await createSupportTicketAction({ subject: assunto, category: categoria, initialText: texto, anexo: a.anexo });
      if (!r.ok) return setErro(r.message);
      onDone(r.id, r.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal rotulo="Nova conversa" titulo={assunto || 'Falar com a contabilidade'} onClose={onClose}>
      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="rotulo text-ink-soft">Assunto</span>
          <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Dúvida sobre a guia do mês" className={campo} />
        </label>
        <label className="block">
          <span className="rotulo text-ink-soft">Tema</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
            {ASSUNTOS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rotulo text-ink-soft">Mensagem</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={campo} />
        </label>
        {a.input}
        <button type="button" onClick={a.abrir} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
          <Paperclip className="h-3.5 w-3.5" /> {a.anexo ? a.anexo.nome : 'Anexar PDF ou imagem'}
        </button>
      </div>
      {(erro || a.erro) && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro || a.erro}</p>}
      <button type="button" onClick={enviar} disabled={salvando} className={`${botao} mt-5 w-full py-3 text-sm`}>
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Enviar
      </button>
    </Modal>
  );
}

function PedirReuniao({ onClose, onDone }: { onClose: () => void; onDone: (id: string | undefined, msg: string) => void }) {
  const amanha = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [pauta, setPauta] = useState('');
  const [data, setData] = useState(amanha);
  const [hora, setHora] = useState('10:00');
  const [formato, setFormato] = useState('VIDEO');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await scheduleMeetingAction({ topic: pauta, date: data, time: hora, formato });
      if (!r.ok) return setErro(r.message);
      onDone(r.id, r.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal rotulo="Pedir reunião" titulo={pauta || 'Reunião com a contabilidade'} onClose={onClose}>
      <p className="mt-3 text-xs text-ink-soft">Vira uma conversa com a data que você prefere. A contabilidade confirma ou sugere outro horário por lá.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="rotulo text-ink-soft">Assunto</span>
          <input value={pauta} onChange={(e) => setPauta(e.target.value)} placeholder="Ex.: Planejamento do imposto para 2027" className={campo} />
        </label>
        <label className="block">
          <span className="rotulo text-ink-soft">Data</span>
          <input type="date" value={data} min={amanha} onChange={(e) => setData(e.target.value)} className={campo} />
        </label>
        <label className="block">
          <span className="rotulo text-ink-soft">Horário</span>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
        </label>
        <label className="block sm:col-span-2">
          <span className="rotulo text-ink-soft">Formato</span>
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className={campo}>
            <option value="VIDEO">Por vídeo</option>
            <option value="PRESENCIAL">Presencial</option>
          </select>
        </label>
      </div>
      {erro && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
      <button type="button" onClick={enviar} disabled={salvando} className={`${botao} mt-5 w-full py-3 text-sm`}>
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Enviar pedido
      </button>
    </Modal>
  );
}
