'use client';
import { useState, useEffect } from 'react';
import { Envelope, ArrowCounterClockwise, ArrowElbowDownLeft } from '@phosphor-icons/react';

type EmailMessage = {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  bodyText: string;
  sentAt: string;
};

export default function EmailViewer({ customerId, companyId, onReply }: { customerId: string; companyId: string; onReply: (msg: EmailMessage) => void }) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/emails/sync?customerId=${customerId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao sincronizar e-mails');
      }
      const data = await res.json();
      setEmails(data.messages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [customerId]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Envelope weight="duotone" className="text-brand-500" />
          Histórico de E-mails
        </h3>
        <button 
          onClick={fetchEmails} 
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface-card border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-black/5 disabled:opacity-50"
        >
          <ArrowCounterClockwise className={loading ? 'animate-spin' : ''} />
          Sincronizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-critical/10 p-3 text-xs text-critical">
          {error}
        </div>
      )}

      {emails.length === 0 && !loading && !error && (
        <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          Nenhum e-mail sincronizado para este cliente.
        </div>
      )}

      <div className="space-y-3">
        {emails.map(email => (
          <div key={email.id} className="rounded-xl bg-surface-card border border-line p-4 shadow-sm relative group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium text-sm text-ink">{email.subject}</p>
                <p className="text-xs text-ink-soft">De: {email.fromAddress} • Para: {email.toAddress}</p>
              </div>
              <span className="text-xs text-ink-soft">{new Date(email.sentAt).toLocaleDateString()}</span>
            </div>
            <div className="text-sm text-ink-soft whitespace-pre-wrap mt-2 bg-black/[0.03] p-3 rounded-xl max-h-40 overflow-y-auto">
              {email.bodyText}
            </div>
            
            <button 
              onClick={() => onReply(email)}
              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/[0.07] p-1.5 rounded-lg text-ink hover:bg-black/10"
              title="Responder"
            >
              <ArrowElbowDownLeft weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
