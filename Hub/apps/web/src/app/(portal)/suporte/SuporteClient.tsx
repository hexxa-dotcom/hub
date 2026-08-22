'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PaperPlaneRight, ChatCircle, CalendarBlank, CheckCircle,
  Plus, MagnifyingGlass, User, X, PhoneCall, Paperclip
} from '@phosphor-icons/react';
import {
  createSupportTicketAction,
  sendSupportMessageAction,
  scheduleMeetingAction,
  type SupportTicketRow,
} from './actions';

const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de atendimento da contabilidade.')}`;

const STATUS_LABEL: Record<SupportTicketRow['status'], { label: string; cls: string }> = {
  OPEN: { label: '🟡 Aberto', cls: 'bg-warn/10 text-warn' },
  IN_PROGRESS: { label: '🔵 Em atendimento', cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400' },
  WAITING_CLIENT: { label: '🟠 Aguardando você', cls: 'bg-warn/10 text-warn' },
  RESOLVED: { label: '🟢 Concluído', cls: 'bg-ok/10 text-ok' },
  CLOSED: { label: '⚪ Encerrado', cls: 'bg-ink/10 text-ink-soft' },
};

const QUICK_PROMPTS = [
  'Como calcular o Fator R?',
  'Solicito o Balancete Contábil',
  'Enviei o comprovante do DAS por aqui',
];

export function SuporteClient({ initialTickets }: { initialTickets: SupportTicketRow[] }) {
  const router = useRouter();
  const [activeTicketId, setActiveTicketId] = useState<string | null>(initialTickets[0]?.id ?? null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const activeTicket = initialTickets.find(t => t.id === activeTicketId) ?? initialTickets[0] ?? null;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages.length]);

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend ?? inputText).trim();
    if (!text || !activeTicket) return;
    setSending(true);
    setInputText('');
    await sendSupportMessageAction(activeTicket.id, text);
    setSending(false);
    router.refresh();
  }

  async function handleCreateNewTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = await createSupportTicketAction({
      subject: String(fd.get('subject')),
      category: String(fd.get('category')),
      initialText: String(fd.get('initialText')),
    });
    setShowNewTicketModal(false);
    if (result.id) setActiveTicketId(result.id);
    router.refresh();
  }

  async function handleScheduleMeeting(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = await scheduleMeetingAction({
      topic: String(fd.get('topic')),
      date: String(fd.get('date')),
      time: String(fd.get('time')),
    });
    setShowMeetingModal(false);
    setBanner(result.message);
    setTimeout(() => setBanner(null), 8000);
    router.refresh();
  }

  const filteredTickets = initialTickets.filter(t =>
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Chat de Suporte & Atendimento Contábil</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Canal direto de comunicação com seu contador e histórico unificado de chamados e reuniões.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMeetingModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-card px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink hover:bg-black/5"
          >
            <CalendarBlank className="h-4 w-4 text-brand-500" /> Agendar Reunião
          </button>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
          >
            <PhoneCall className="h-4 w-4" /> WhatsApp Emergencial
          </a>
        </div>
      </header>

      {banner && (
        <div className="flex items-center gap-3 rounded-2xl bg-ok/10 border border-ok/30 p-4 text-sm text-ok font-medium animate-in fade-in">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {banner}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[550px]">
        {/* COLUNA ESQUERDA: HISTÓRICO */}
        <div className="lg:col-span-4 rounded-2xl border border-line bg-surface-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-line space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <ChatCircle className="h-4 w-4 text-brand-500" /> Histórico de Contatos
              </h2>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(true)}
                className="inline-flex items-center gap-1 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Chamado
              </button>
            </div>

            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar por assunto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-line bg-black/5 dark:bg-white/5 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-brand-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {filteredTickets.length === 0 && (
              <p className="p-4 text-center text-xs text-ink-soft">Nenhum chamado ainda. Abra o primeiro em &quot;Novo Chamado&quot;.</p>
            )}
            {filteredTickets.map(t => {
              const isSelected = t.id === activeTicketId;
              const st = STATUS_LABEL[t.status];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTicketId(t.id)}
                  className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 ${
                    isSelected ? 'bg-brand-500/10 border-l-4 border-brand-500' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-ink-soft">
                    <span>{new Date(t.lastMessageAt).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <p className="text-xs font-bold text-ink line-clamp-1">{t.subject}</p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-ink-soft bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                      {t.category ?? 'Geral'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COLUNA DIREITA: CHAT */}
        <div className="lg:col-span-8 rounded-2xl border border-line bg-surface-card flex flex-col overflow-hidden">
          {!activeTicket ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-ink-soft p-8">
              <ChatCircle className="h-10 w-10 opacity-20" />
              <p className="text-sm">Abra um chamado para conversar com a contabilidade.</p>
              <button type="button" onClick={() => setShowNewTicketModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                <Plus className="h-4 w-4" /> Novo chamado
              </button>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-line flex items-center justify-between bg-black/5 dark:bg-white/5">
                <div>
                  <h3 className="text-sm font-bold text-ink">{activeTicket.subject}</h3>
                  <p className="text-xs text-ink-soft mt-0.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-brand-500" />
                    {activeTicket.category ?? 'Geral'}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_LABEL[activeTicket.status].cls}`}>
                  {STATUS_LABEL[activeTicket.status].label}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeTicket.messages.length === 0 && (
                  <p className="text-center text-xs text-ink-soft py-8">Nenhuma mensagem ainda.</p>
                )}
                {activeTicket.messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender === 'client' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-ink-soft mb-1 px-1">
                      {msg.sender === 'client' ? 'Você' : 'Contabilidade'} · {msg.time}
                    </span>
                    <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                      msg.sender === 'client'
                        ? 'bg-brand-500 text-white rounded-br-none'
                        : 'bg-black/5 dark:bg-white/10 text-ink rounded-bl-none border border-line'
                    }`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="px-4 py-2 border-t border-line bg-black/5 dark:bg-white/5 flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-semibold text-ink-soft shrink-0">Atalhos:</span>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="whitespace-nowrap rounded-full border border-line bg-surface-card px-3 py-1 text-[11px] font-medium text-ink-soft hover:text-ink hover:border-brand-400 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <form
                onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                className="p-3 border-t border-line flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => alert('Envio de anexos ainda não está disponível por aqui. Envie o documento em Arquivos Permanentes ou pelo WhatsApp.')}
                  className="p-2.5 rounded-xl border border-line text-ink-soft hover:text-ink hover:bg-black/5"
                  title="Anexar documento"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Digite sua mensagem para a contabilidade..."
                  disabled={sending}
                  className="flex-1 rounded-xl border border-line bg-surface-card px-4 py-2.5 text-xs outline-none focus:border-brand-400 disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-600 shadow-sm disabled:opacity-60"
                >
                  <PaperPlaneRight className="h-4 w-4" /> Enviar
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleCreateNewTicket} className="w-full max-w-lg rounded-2xl bg-surface-card border border-line p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <ChatCircle className="h-5 w-5 text-brand-500" />
                Abrir Novo Chamado de Suporte
              </h3>
              <button type="button" onClick={() => setShowNewTicketModal(false)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Assunto da Solicitação *</label>
              <input name="subject" required placeholder="Ex.: Dúvida sobre imposto DAS ou Folha de Pagamento" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Categoria *</label>
              <select name="category" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400">
                <option value="Fiscal / DAS">Fiscal / DAS & Impostos</option>
                <option value="Contábil">Contábil & Balancete</option>
                <option value="Departamento Pessoal">Departamento Pessoal & Pró-Labore</option>
                <option value="Outros">Outros Assuntos</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Descreva sua solicitação *</label>
              <textarea name="initialText" required rows={4} placeholder="Digite os detalhes da sua mensagem..." className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
                Abrir Chamado
              </button>
            </div>
          </form>
        </div>
      )}

      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleScheduleMeeting} className="w-full max-w-md rounded-2xl bg-surface-card border border-line p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <CalendarBlank className="h-5 w-5 text-brand-500" />
                Solicitar Reunião com o Contador
              </h3>
              <button type="button" onClick={() => setShowMeetingModal(false)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-ink-soft">Sua solicitação abre um chamado com a data e horário desejados. A contabilidade confirma por aqui.</p>

            <div>
              <label className="text-xs font-medium text-ink-soft">Pauta da Reunião *</label>
              <input name="topic" required placeholder="Ex.: Planejamento Tributário / Revisão Fator R" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-soft">Data desejada *</label>
                <input name="date" type="date" required defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]} className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Horário Desejado *</label>
                <input name="time" type="time" defaultValue="14:30" required className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>
            </div>

            <button type="submit" className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              Enviar Solicitação
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
