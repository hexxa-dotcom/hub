'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle } from 'lucide-react';

const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com minha contabilidade.')}`;

type Msg = { id: string; from: 'client' | 'accounting'; text: string; time: string };

function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const SEED: Msg[] = [
  { id: '1', from: 'accounting', text: 'Olá! Aqui é a equipe da Hexxa Contabilidade 👋 Como podemos ajudar?', time: '09:01' },
  { id: '2', from: 'client', text: 'Preciso da guia do DAS deste mês.', time: '09:02' },
  { id: '3', from: 'accounting', text: 'Claro! Já deixamos disponível em Minha Contabilidade → Guias de Impostos, com o Pix para copiar. 😊', time: '09:03' },
];

const QUICK = ['Dúvida sobre uma guia', 'Enviar um documento', 'Falar sobre distribuição de lucros'];

export default function Page() {
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  function send(value: string) {
    const t = value.trim();
    if (!t) return;
    setMsgs((prev) => [...prev, { id: crypto.randomUUID(), from: 'client', text: t, time: now() }]);
    setText('');
    // resposta automática de demonstração
    setTimeout(() => {
      setMsgs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          from: 'accounting',
          text: 'Recebemos sua mensagem! Um contador vai te responder em instantes. ✅',
          time: now(),
        },
      ]);
    }, 700);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Atendimento</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Fale com a sua contabilidade quando precisar.</p>
        </div>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-105"
        >
          <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
        </a>
      </header>

      <div className="card-flat mt-5 flex min-h-0 flex-1 flex-col rounded-card">
        {/* mensagens */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'client' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.from === 'client'
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface text-ink dark:bg-white/10'
                }`}
              >
                <p>{m.text}</p>
                <span className={`mt-1 block text-[10px] ${m.from === 'client' ? 'text-white/70' : 'text-ink-soft'}`}>
                  {m.time}
                </span>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* atalhos */}
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              {q}
            </button>
          ))}
        </div>

        {/* input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-center gap-2 border-t border-line p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva sua mensagem..."
            className="flex-1 rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none placeholder:text-ink-soft"
          />
          <button
            type="submit"
            aria-label="Enviar"
            className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white transition-colors hover:bg-brand-600"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
