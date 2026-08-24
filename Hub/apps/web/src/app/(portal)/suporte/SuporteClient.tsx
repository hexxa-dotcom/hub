'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Plus,
  Search,
  User,
  X,
  PhoneCall,
  Paperclip,
  Loader2,
  Headphones,
} from 'lucide-react';
import {
  createSupportTicketAction,
  sendSupportMessageAction,
  scheduleMeetingAction,
  type SupportTicketRow,
} from './actions';

const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de atendimento da contabilidade.')}`;

const STATUS_LABEL: Record<SupportTicketRow['status'], { label: string; cls: string }> = {
  OPEN: { label: 'Aberto', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  IN_PROGRESS: { label: 'Em atendimento', cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]' },
  WAITING_CLIENT: { label: 'Aguardando você', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  RESOLVED: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  CLOSED: { label: 'Encerrado', cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]' },
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Headphones className="h-3.5 w-3.5" />
              Atendimento Contábil
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Chat de Suporte & Consultoria
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Canal direto de comunicação com seu time contábil e histórico unificado de chamados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMeetingModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all shadow-sm"
          >
            <Calendar className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Agendar Reunião
          </button>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20b858] px-5 py-2 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
          >
            <PhoneCall className="h-3.5 w-3.5" /> WhatsApp Emergencial
          </a>
        </div>
      </header>

      {banner && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-semibold animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {banner}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[550px]">
        {/* COLUNA ESQUERDA: HISTÓRICO */}
        <div className="lg:col-span-4 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Histórico de Chamados
              </h2>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(true)}
                className="inline-flex items-center gap-1 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-3.5 py-1.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Chamado
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />
              <input
                type="text"
                placeholder="Buscar por assunto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] pl-9 pr-4 py-2 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/10">
            {filteredTickets.length === 0 && (
              <p className="p-6 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nenhum chamado ainda. Abra o primeiro em &quot;Novo Chamado&quot;.</p>
            )}
            {filteredTickets.map(t => {
              const isSelected = t.id === activeTicketId;
              const st = STATUS_LABEL[t.status];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTicketId(t.id)}
                  className={`w-full text-left p-4 sm:p-5 transition-colors flex flex-col gap-1.5 ${
                    isSelected ? 'bg-[#1E3328]/10 dark:bg-white/10 border-l-4 border-[#1E3328] dark:border-[#DFFFAE]' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                    <span>{new Date(t.lastMessageAt).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] line-clamp-1">{t.subject}</p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                      {t.category ?? 'Geral'}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COLUNA DIREITA: CHAT */}
        <div className="lg:col-span-8 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md flex flex-col overflow-hidden shadow-sm">
          {!activeTicket ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-[#6E6A61] dark:text-[#A8A49C] p-8">
              <MessageSquare className="h-10 w-10 opacity-20" />
              <p className="text-sm">Abra um chamado para conversar com a contabilidade.</p>
              <button type="button" onClick={() => setShowNewTicketModal(true)} className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
                <Plus className="h-4 w-4" /> Novo Chamado
              </button>
            </div>
          ) : (
            <>
              <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{activeTicket.subject}</h3>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                    {activeTicket.category ?? 'Geral'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_LABEL[activeTicket.status].cls}`}>
                  {STATUS_LABEL[activeTicket.status].label}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeTicket.messages.length === 0 && (
                  <p className="text-center text-xs text-[#6E6A61] dark:text-[#A8A49C] py-8">Nenhuma mensagem ainda.</p>
                )}
                {activeTicket.messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender === 'client' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-[#6E6A61] dark:text-[#A8A49C] mb-1 px-1">
                      {msg.sender === 'client' ? 'Você' : 'Contabilidade'} · {msg.time}
                    </span>
                    <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                      msg.sender === 'client'
                        ? 'bg-[#1E3328] text-[#FEFDF3] rounded-br-none'
                        : 'bg-[#FEFDF3] dark:bg-[#121614] text-[#231F20] dark:text-[#FEFDF3] rounded-bl-none border border-black/5 dark:border-white/10'
                    }`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="px-4 py-2 border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-bold text-[#6E6A61] dark:text-[#A8A49C] shrink-0">Atalhos:</span>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="whitespace-nowrap rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-1 text-[11px] font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <form
                onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                className="p-3 sm:p-4 border-t border-black/5 dark:border-white/10 flex items-center gap-2 bg-[#FEFDF3] dark:bg-[#121614]"
              >
                <button
                  type="button"
                  onClick={() => alert('Envio de anexos direto no chat em breve. Para enviar guias e extratos, use a seção Arquivos Permanentes.')}
                  className="p-2.5 rounded-2xl border border-black/10 dark:border-white/10 text-[#6E6A61] hover:bg-black/5 transition-all"
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
                  className="flex-1 rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-4 py-2.5 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleCreateNewTicket} className="w-full max-w-lg rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                Abrir Novo Chamado de Suporte
              </h3>
              <button type="button" onClick={() => setShowNewTicketModal(false)} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Assunto da Solicitação *</label>
              <input name="subject" required placeholder="Ex.: Dúvida sobre imposto DAS ou Folha de Pagamento" className="mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]" />
            </div>

            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Categoria *</label>
              <select name="category" className="mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]">
                <option value="Fiscal / DAS">Fiscal / DAS & Impostos</option>
                <option value="Contábil">Contábil & Balancete</option>
                <option value="Departamento Pessoal">Gestão de Colaboradores & Pró-Labore</option>
                <option value="Outros">Outros Assuntos</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Descreva sua solicitação *</label>
              <textarea name="initialText" required rows={4} placeholder="Digite os detalhes da sua mensagem..." className="mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="w-full rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-3 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
                Abrir Chamado
              </button>
            </div>
          </form>
        </div>
      )}

      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleScheduleMeeting} className="w-full max-w-md rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
              <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                Solicitar Reunião com o Contador
              </h3>
              <button type="button" onClick={() => setShowMeetingModal(false)} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sua solicitação abre um chamado com a data e horário desejados. A equipe entrará em contato para confirmar.</p>

            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Pauta da Reunião *</label>
              <input name="topic" required placeholder="Ex.: Planejamento Tributário / Revisão Fator R" className="mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Data Desejada *</label>
                <input name="date" type="date" required defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]} className="mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-4 py-2.5 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Horário Desejado *</label>
                <input name="time" type="time" defaultValue="14:30" required className="mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-4 py-2.5 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]" />
              </div>
            </div>

            <button type="submit" className="w-full rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-3 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
              Enviar Solicitação
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

