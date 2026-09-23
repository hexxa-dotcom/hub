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
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import {
  createSupportTicketAction,
  sendSupportMessageAction,
  scheduleMeetingAction,
  type SupportTicketRow,
} from './actions';

const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de atendimento da contabilidade.')}`;

const STATUS_LABEL: Record<SupportTicketRow['status'], { label: string; cls: string }> = {
  OPEN: { label: 'Aberto', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20' },
  IN_PROGRESS: { label: 'Em atendimento', cls: 'bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime border border-hexxa-forest/20' },
  WAITING_CLIENT: { label: 'Aguardando você', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20' },
  RESOLVED: { label: 'Concluído', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' },
  CLOSED: { label: 'Encerrado', cls: 'bg-black/5 text-ink-soft dark:bg-white/10 border border-black/5 dark:border-white/10' },
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
    <div className="space-y-16 animate-fade-up">
      <SectionHero
        subtitulo="Converse com a sua contabilidade"
        title="Chat de Suporte & Consultoria"
        infoTitle="Sobre Suporte & Consultoria"
        infoDescription="Canal direto de comunicação com seu time contábil e histórico unificado de chamados."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMeetingModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime" /> Agendar Reunião
            </button>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20b858] px-5 py-2 text-xs font-bold text-white shadow-(--elev-1) transition-all hover:scale-105 active:scale-95"
            >
              <PhoneCall className="h-3.5 w-3.5" /> WhatsApp Direto
            </a>
          </div>
        }
      />

      {banner && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-semibold shadow-(--elev-1) animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {banner}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[550px]">
        {/* COLUNA ESQUERDA: HISTÓRICO */}
        <Card level={1} className="lg:col-span-4 flex flex-col overflow-hidden p-0">
          <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-sm text-ink flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime" /> Histórico de Chamados
              </h2>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(true)}
                className="inline-flex items-center gap-1 rounded-full bg-hexxa-forest hover:brightness-110 px-3.5 py-1.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Chamado
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar por assunto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) pl-9 pr-4 py-2 text-xs text-ink placeholder:text-ink-soft/60 outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/10">
            {filteredTickets.length === 0 && (
              <p className="p-6 text-center text-xs text-ink-soft">Nenhum chamado ainda. Abra o primeiro em &quot;Novo Chamado&quot;.</p>
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
                    isSelected ? 'bg-hexxa-forest/10 dark:bg-white/10 border-l-4 border-hexxa-forest dark:border-hexxa-lime' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-ink-soft">
                    <span>{new Date(t.lastMessageAt).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <p className="text-xs font-bold text-ink line-clamp-1">{t.subject}</p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-ink-soft bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                      {t.category ?? 'Geral'}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* COLUNA DIREITA: CHAT */}
        <Card level={1} className="lg:col-span-8 flex flex-col overflow-hidden p-0">
          {!activeTicket ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-ink-soft p-8">
              <MessageSquare className="h-10 w-10 opacity-20 text-ink" />
              <p className="text-sm">Abra um chamado para conversar com a contabilidade.</p>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95"
              >
                <Plus className="h-4 w-4" /> Novo Chamado
              </button>
            </div>
          ) : (
            <>
              <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
                <div>
                  <h3 className="font-serif font-bold text-sm text-ink">{activeTicket.subject}</h3>
                  <p className="text-xs text-ink-soft mt-0.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime" />
                    {activeTicket.category ?? 'Geral'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_LABEL[activeTicket.status].cls}`}>
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
                    <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                      msg.sender === 'client'
                        ? 'bg-hexxa-forest text-white dark:text-hexxa-lime rounded-br-none shadow-(--elev-1)'
                        : 'bg-surface-card text-ink rounded-bl-none border border-black/5 dark:border-white/10 shadow-(--elev-inset)'
                    }`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="px-4 py-2 border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-bold text-ink-soft shrink-0">Atalhos:</span>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="whitespace-nowrap rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-3 py-1 text-[11px] font-bold text-ink-soft hover:text-ink shadow-(--elev-1) hover:brightness-105 active:scale-95 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <form
                onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                className="p-3 sm:p-4 border-t border-black/5 dark:border-white/10 flex items-center gap-2 bg-surface-card"
              >
                <button
                  type="button"
                  onClick={() => alert('Envio de anexos direto no chat em breve. Para enviar guias e extratos, use a seção Arquivos Permanentes.')}
                  className="p-2.5 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card text-ink-soft hover:text-ink shadow-(--elev-1) transition-all"
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
                  className="flex-1 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-xs text-ink placeholder:text-ink-soft/60 outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </button>
              </form>
            </>
          )}
        </Card>
      </div>

      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <Card level={2} tone="deep" className="card-finish w-full max-w-lg p-6 sm:p-8 shadow-(--elev-3)">
            <form onSubmit={handleCreateNewTicket} className="space-y-4">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
                <h3 className="font-serif font-bold text-base text-ink flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-hexxa-forest dark:text-hexxa-lime" />
                  Abrir Novo Chamado de Suporte
                </h3>
                <button type="button" onClick={() => setShowNewTicketModal(false)} className="rounded-full p-1.5 text-ink-soft hover:text-ink hover:bg-black/5">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">Assunto da Solicitação *</label>
                <input name="subject" required placeholder="Ex.: Dúvida sobre imposto DAS ou Folha de Pagamento" className="mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime" />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">Categoria *</label>
                <select name="category" className="mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime">
                  <option value="Fiscal / DAS">Fiscal / DAS & Impostos</option>
                  <option value="Contábil">Contábil & Balancete</option>
                  <option value="Departamento Pessoal">Gestão de Colaboradores & Pró-Labore</option>
                  <option value="Outros">Outros Assuntos</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">Descreva sua solicitação *</label>
                <textarea name="initialText" required rows={4} placeholder="Digite os detalhes da sua mensagem..." className="mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="w-full rounded-full bg-hexxa-forest hover:brightness-110 py-3 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95">
                  Abrir Chamado
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <Card level={2} tone="deep" className="card-finish w-full max-w-md p-6 sm:p-8 shadow-(--elev-3)">
            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
                <h3 className="font-serif font-bold text-base text-ink flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-hexxa-forest dark:text-hexxa-lime" />
                  Solicitar Reunião com o Contador
                </h3>
                <button type="button" onClick={() => setShowMeetingModal(false)} className="rounded-full p-1.5 text-ink-soft hover:text-ink hover:bg-black/5">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-ink-soft">Sua solicitação abre um chamado com a data e horário desejados. A equipe entrará em contato para confirmar.</p>

              <div>
                <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">Pauta da Reunião *</label>
                <input name="topic" required placeholder="Ex.: Planejamento Tributário / Revisão Fator R" className="mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">Data Desejada *</label>
                  <input name="date" type="date" required defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]} className="mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">Horário Desejado *</label>
                  <input name="time" type="time" defaultValue="14:30" required className="mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime" />
                </div>
              </div>

              <button type="submit" className="w-full rounded-full bg-hexxa-forest hover:brightness-110 py-3 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95">
                Enviar Solicitação
              </button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
