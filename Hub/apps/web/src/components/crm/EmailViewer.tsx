'use client';
import { useState, useEffect } from 'react';
import { Mail, RotateCw, CornerDownLeft, Loader2 } from 'lucide-react';

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
        <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          Histórico de E-mails
        </h3>
        <button 
          onClick={fetchEmails} 
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 disabled:opacity-50 transition-all"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {emails.length === 0 && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          Nenhum e-mail sincronizado para este cliente.
        </div>
      )}

      <div className="space-y-3">
        {emails.map(email => (
          <div key={email.id} className="rounded-2xl bg-white/80 dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 shadow-sm relative group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{email.subject}</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">De: {email.fromAddress} • Para: {email.toAddress}</p>
              </div>
              <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{new Date(email.sentAt).toLocaleDateString()}</span>
            </div>
            <div className="text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] whitespace-pre-wrap mt-2 bg-black/[0.03] dark:bg-white/5 p-3 rounded-xl max-h-40 overflow-y-auto">
              {email.bodyText}
            </div>
            
            <button 
              onClick={() => onReply(email)}
              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/[0.07] dark:bg-white/10 p-1.5 rounded-lg text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/15"
              title="Responder"
            >
              <CornerDownLeft className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

