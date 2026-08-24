'use client';
import { useState } from 'react';
import { Send, X, Loader2 } from 'lucide-react';

type EmailComposerProps = {
  customerId: string;
  companyId: string;
  defaultSubject?: string;
  onSent: () => void;
  onCancel: () => void;
};

export default function EmailComposer({ customerId, companyId, defaultSubject = '', onSent, onCancel }: EmailComposerProps) {
  const [subject, setSubject] = useState(defaultSubject.startsWith('Re:') ? defaultSubject : (defaultSubject ? `Re: ${defaultSubject}` : ''));
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!subject || !text) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          customerId,
          subject,
          text
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao enviar e-mail');
      }
      onSent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-5 sm:p-6 shadow-lg animate-in fade-in space-y-4">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Compor Nova Mensagem</h3>
        <button onClick={onCancel} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <input 
          type="text"
          placeholder="Assunto da mensagem"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]"
        />
        <textarea 
          placeholder="Escreva sua mensagem aqui..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-3 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] resize-none"
        />
        
        <div className="flex justify-end gap-2 pt-2">
          <button 
            type="button"
            onClick={onCancel}
            className="rounded-full border border-black/10 dark:border-white/10 px-5 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
          >
            Descartar
          </button>
          <button 
            onClick={handleSend}
            disabled={loading || !subject || !text}
            className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {loading ? 'Enviando...' : 'Enviar Mensagem'}
          </button>
        </div>
      </div>
    </div>
  );
}

