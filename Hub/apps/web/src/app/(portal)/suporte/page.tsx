'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  PaperPlaneRight, ChatCircle, CalendarBlank, CheckCircle, Clock, 
  Plus, MagnifyingGlass, User, FileText, DownloadSimple, X, Check, CaretRight, PhoneCall, Paperclip
} from '@phosphor-icons/react';

const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de atendimento da contabilidade.')}`;

type Message = {
  id: string;
  sender: 'client' | 'accounting';
  senderName: string;
  text: string;
  time: string;
  attachmentName?: string;
};

type SupportTicket = {
  id: string;
  protocol: string;
  subject: string;
  category: 'Fiscal / DAS' | 'Contábil' | 'Departamento Pessoal' | 'Reunião' | 'Outros';
  status: 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'REUNIAO_AGENDADA';
  lastMessageTime: string;
  accountantName: string;
  messages: Message[];
};

const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 't-1',
    protocol: 'CH-2026-0841',
    subject: 'Dúvida sobre alíquota do Simples Nacional & Fator R',
    category: 'Fiscal / DAS',
    status: 'EM_ATENDIMENTO',
    lastMessageTime: '10:42',
    accountantName: 'Dr. Carlos Mendes (Contador Responsável)',
    messages: [
      { id: 'm-1', sender: 'client', senderName: 'Você', text: 'Olá Carlos! Consegue verificar se a nossa folha deste mês atingiu os 28% do Fator R?', time: '10:30' },
      { id: 'm-2', sender: 'accounting', senderName: 'Dr. Carlos Mendes', text: 'Olá! Analisei seu faturamento e folha. Ficou em 29.4%, garantindo a alíquota reduzida de 6% no Anexo III! 🎉', time: '10:38' },
      { id: 'm-3', sender: 'client', senderName: 'Você', text: 'Excelente! A guia do DAS do mês que vem já vem recalculada?', time: '10:42' },
    ],
  },
  {
    id: 't-2',
    protocol: 'CH-2026-0790',
    subject: 'Solicitação de Alteração de CNAE Secundário',
    category: 'Contábil',
    status: 'CONCLUIDO',
    lastMessageTime: 'Ontem',
    accountantName: 'Dra. Patricia Lima (Societário)',
    messages: [
      { id: 'm-10', sender: 'client', senderName: 'Você', text: 'Precisamos adicionar o CNAE de consultoria em TI no nosso CNPJ.', time: '14:00' },
      { id: 'm-11', sender: 'accounting', senderName: 'Dra. Patricia Lima', text: 'Alteração protocolada na Junta Comercial e Receita Federal. Certidão atualizada disponível em Arquivos Permanentes!', time: '16:30' },
    ],
  },
  {
    id: 't-3',
    protocol: 'REU-2026-012',
    subject: 'Reunião Trimestral de Alinhamento Tributário',
    category: 'Reunião',
    status: 'REUNIAO_AGENDADA',
    lastMessageTime: '15/Jul',
    accountantName: 'Equipe de Controladoria',
    messages: [
      { id: 'm-20', sender: 'accounting', senderName: 'Equipe Hexxa', text: 'Reunião agendada para 28/07 às 14:30 via Google Meet. Link enviado no e-mail cadastrado.', time: '11:00' },
    ],
  },
];

const QUICK_PROMPTS = [
  '💡 Como calcular o Fator R?',
  '📄 Solicitar Balancete Contábil',
  '🟢 Enviar comprovante de DAS',
  '📅 Agendar reunião com contador',
];

export default function Page() {
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  const [activeTicketId, setActiveTicketId] = useState<string>('t-1');
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modais
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingSuccess, setMeetingSuccess] = useState<string | null>(null);

  const activeTicket = tickets.find(t => t.id === activeTicketId) ?? tickets[0]!;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  function handleSendMessage(textToSend?: string) {
    const text = (textToSend ?? inputText).trim();
    if (!text) return;

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'client',
      senderName: 'Você',
      text,
      time: now,
    };

    setTickets(prev => prev.map(t => {
      if (t.id !== activeTicketId) return t;
      return {
        ...t,
        lastMessageTime: now,
        messages: [...t.messages, newMsg],
      };
    }));

    setInputText('');

    // Simulação de resposta da Contabilidade em 1.5s
    setTimeout(() => {
      const replyMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'accounting',
        senderName: activeTicket.accountantName,
        text: 'Mensagem recebida! Nossa equipe contábil está analisando sua solicitação. Resposta estimada em até 15 minutos.',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setTickets(prev => prev.map(t => {
        if (t.id !== activeTicketId) return t;
        return {
          ...t,
          messages: [...t.messages, replyMsg],
        };
      }));
    }, 1200);
  }

  function handleCreateNewTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const subject = String(fd.get('subject'));
    const category = fd.get('category') as SupportTicket['category'];
    const initialText = String(fd.get('initialText'));
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newTicket: SupportTicket = {
      id: crypto.randomUUID(),
      protocol: `CH-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      subject,
      category,
      status: 'EM_ATENDIMENTO',
      lastMessageTime: now,
      accountantName: 'Equipe de Atendimento Contábil',
      messages: [
        { id: 'm-new', sender: 'client', senderName: 'Você', text: initialText, time: now },
      ],
    };

    setTickets(prev => [newTicket, ...prev]);
    setActiveTicketId(newTicket.id);
    setShowNewTicketModal(false);
  }

  function handleScheduleMeeting(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get('date'));
    const time = String(fd.get('time'));
    const topic = String(fd.get('topic'));

    setMeetingSuccess(`Reunião agendada com sucesso para o dia ${date} às ${time}! Enviamos o link do Google Meet por e-mail.`);
    setShowMeetingModal(false);
    setTimeout(() => setMeetingSuccess(null), 6000);
  }

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.protocol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header da Seção */}
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

      {meetingSuccess && (
        <div className="flex items-center gap-3 rounded-2xl bg-ok/10 border border-ok/30 p-4 text-sm text-ok font-medium animate-in fade-in">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {meetingSuccess}
        </div>
      )}

      {/* PAINEL DUPLO DE ATENDIMENTO (Histórico à esquerda + Chat Ativo à direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[550px]">
        {/* COLUNA ESQUERDA: HISTÓRICO DE CHAMADOS & REUNIÕES */}
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

            {/* Busca de Chamados */}
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar por assunto ou protocolo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-line bg-black/5 dark:bg-white/5 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-brand-400"
              />
            </div>
          </div>

          {/* Lista Scrollável de Chamados */}
          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {filteredTickets.map(ticket => {
              const isSelected = ticket.id === activeTicketId;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setActiveTicketId(ticket.id)}
                  className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 ${
                    isSelected ? 'bg-brand-500/10 border-l-4 border-brand-500' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-ink-soft">
                    <span className="font-semibold text-brand-600 dark:text-brand-400">{ticket.protocol}</span>
                    <span>{ticket.lastMessageTime}</span>
                  </div>

                  <p className="text-xs font-bold text-ink line-clamp-1">{ticket.subject}</p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-ink-soft bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                      {ticket.category}
                    </span>

                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      ticket.status === 'CONCLUIDO' ? 'bg-ok/10 text-ok' :
                      ticket.status === 'REUNIAO_AGENDADA' ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' :
                      'bg-warn/10 text-warn'
                    }`}>
                      {ticket.status === 'CONCLUIDO' ? '🟢 Concluído' :
                       ticket.status === 'REUNIAO_AGENDADA' ? '📅 Reunião' : '🟡 Em Atendimento'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COLUNA DIREITA: CHAT INTERATIVO ATIVO */}
        <div className="lg:col-span-8 rounded-2xl border border-line bg-surface-card flex flex-col overflow-hidden">
          {/* Header do Chat */}
          <div className="p-4 border-b border-line flex items-center justify-between bg-black/5 dark:bg-white/5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">{activeTicket.subject}</h3>
                <span className="text-xs text-ink-soft">({activeTicket.protocol})</span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-brand-500" />
                {activeTicket.accountantName}
              </p>
            </div>

            <span className="text-xs text-ok font-semibold flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ok animate-pulse" /> Atendimento Online
            </span>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTicket.messages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'client' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-ink-soft mb-1 px-1">
                  {msg.senderName} · {msg.time}
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

          {/* Atalhos Rápidos */}
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

          {/* Formulário de Envio de Mensagem */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-line flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => alert('Anexe arquivos em PDF ou imagem para enviar ao seu contador.')}
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
              className="flex-1 rounded-xl border border-line bg-surface-card px-4 py-2.5 text-xs outline-none focus:border-brand-400"
            />

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-600 shadow-sm"
            >
              <PaperPlaneRight className="h-4 w-4" /> Enviar
            </button>
          </form>
        </div>
      </div>

      {/* MODAL NOVO CHAMADO */}
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

      {/* MODAL AGENDAR REUNIÃO */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleScheduleMeeting} className="w-full max-w-md rounded-2xl bg-surface-card border border-line p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <CalendarBlank className="h-5 w-5 text-brand-500" />
                Agendar Reunião com o Contador
              </h3>
              <button type="button" onClick={() => setShowMeetingModal(false)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Pauta da Reunião *</label>
              <input name="topic" required placeholder="Ex.: Planejamento Tributário / Revisão Fator R" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-soft">Data *</label>
                <input name="date" type="date" required defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]} className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Horário Desejado *</label>
                <input name="time" type="time" defaultValue="14:30" required className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>
            </div>

            <button type="submit" className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              Confirmar Agendamento
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
