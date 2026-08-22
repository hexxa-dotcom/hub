'use client';
import { useState } from 'react';
import { PaperPlaneRight, X } from '@phosphor-icons/react';

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
    <div className="rounded-xl bg-surface-card border border-line p-4 shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink">Novo E-mail</h3>
        <button onClick={onCancel} className="text-ink-soft hover:text-ink">
          <X weight="bold" />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-critical/10 p-3 text-xs text-critical">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <input 
          type="text"
          placeholder="Assunto"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl bg-black/[0.03] border-none px-4 py-2 text-sm text-ink placeholder-ink-soft focus:ring-1 focus:ring-brand-500"
        />
        <textarea 
          placeholder="Escreva sua mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full rounded-xl bg-black/[0.03] border-none px-4 py-3 text-sm text-ink placeholder-ink-soft focus:ring-1 focus:ring-brand-500 resize-none"
        />
        
        <div className="flex justify-end pt-2">
          <button 
            onClick={handleSend}
            disabled={loading || !subject || !text}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <PaperPlaneRight weight="fill" />
            {loading ? 'Enviando...' : 'Enviar Mensagem'}
          </button>
        </div>
      </div>
    </div>
  );
}
