'use client';

import { useState } from 'react';
import { Mail, Send, X, Settings, User, Sparkles, Loader2 } from 'lucide-react';
import EmailViewer from '@/components/crm/EmailViewer';
import EmailComposer from '@/components/crm/EmailComposer';

export type Customer = {
  id: string;
  name: string;
  email: string | null;
};

const field =
  'block w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none transition-all focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

export function HubEmails({ companyId, initialCustomers }: { companyId: string; initialCustomers: Customer[] }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomers[0]?.id || '');
  const [showConfig, setShowConfig] = useState(false);
  const [replyingEmail, setReplyingEmail] = useState<any>(null);

  const selectedCustomer = initialCustomers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#1E3328] text-[#DFFFAE] shadow-sm">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Central Integrada de Mensagens</h2>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Conecte sua caixa postal corporativa e sincronize comunicações com clientes.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowConfig(v => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all shadow-sm"
        >
          <Settings className="h-4 w-4" /> Configurar Servidor (IMAP/SMTP)
        </button>
      </div>

      {showConfig && <EmailConfigForm companyId={companyId} onClose={() => setShowConfig(false)} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Seletor de Cliente */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 sm:p-6 space-y-4 lg:col-span-1 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            Clientes Cadastrados
          </h3>
          {initialCustomers.length === 0 ? (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] py-8 text-center">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {initialCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomerId(c.id); setReplyingEmail(null); }}
                  className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-center justify-between ${
                    selectedCustomerId === c.id 
                      ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm font-medium' 
                      : 'bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/10 text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className={`truncate text-xs mt-0.5 ${selectedCustomerId === c.id ? 'text-[#DFFFAE]/80' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
                      {c.email || 'Sem e-mail cadastrado'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Área de E-mail do Cliente */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 lg:col-span-2 space-y-4 shadow-sm">
          {selectedCustomer ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{selectedCustomer.name}</h3>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{selectedCustomer.email || 'Aviso: Cliente não possui e-mail cadastrado.'}</p>
                </div>
                {!replyingEmail && (
                  <button 
                    onClick={() => setReplyingEmail({ subject: '' })}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Escrever E-mail
                  </button>
                )}
              </div>

              {replyingEmail ? (
                <EmailComposer 
                  companyId={companyId} 
                  customerId={selectedCustomer.id} 
                  defaultSubject={replyingEmail.subject} 
                  onSent={() => setReplyingEmail(null)} 
                  onCancel={() => setReplyingEmail(null)} 
                />
              ) : (
                <EmailViewer 
                  companyId={companyId} 
                  customerId={selectedCustomer.id} 
                  onReply={(msg) => setReplyingEmail(msg)} 
                />
              )}
            </>
          ) : (
            <div className="py-16 text-center text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Selecione um cliente ao lado para visualizar o histórico de correspondências.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailConfigForm({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setStatus('Conectando e testando credenciais...');
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/emails/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          emailAddress: fd.get('emailAddress'),
          password: fd.get('password'),
          imapHost: fd.get('imapHost'),
          imapPort: fd.get('imapPort'),
          smtpHost: fd.get('smtpHost'),
          smtpPort: fd.get('smtpPort')
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Conta conectada com sucesso!');
        setTimeout(onClose, 2000);
      } else {
        setStatus('Erro: ' + (data.error || data.details || 'Falha ao conectar'));
      }
    } catch {
      setStatus('Erro de conexão com o servidor');
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 backdrop-blur-md p-6 space-y-4 shadow-md animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Configurar Provedor de E-mail (IMAP / SMTP)</h3>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Conecte sua conta de e-mail profissional para enviar e receber mensagens direto no CRM da Hexxa.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>E-mail Completo</label>
          <input name="emailAddress" type="email" required placeholder="voce@suaempresa.com.br" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Senha (ou Senha de App)</label>
          <input name="password" type="password" required placeholder="••••••••" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Servidor IMAP (Entrada)</label>
          <div className="flex gap-2">
            <input name="imapHost" required placeholder="imap.mail.com" className={`mt-1.5 flex-1 ${field}`} />
            <input name="imapPort" defaultValue="993" className={`mt-1.5 w-20 ${field}`} />
          </div>
        </div>
        <div>
          <label className={lbl}>Servidor SMTP (Saída)</label>
          <div className="flex gap-2">
            <input name="smtpHost" required placeholder="smtp.mail.com" className={`mt-1.5 flex-1 ${field}`} />
            <input name="smtpPort" defaultValue="465" className={`mt-1.5 w-20 ${field}`} />
          </div>
        </div>
      </div>
      {status && (
        <p className={`rounded-2xl p-3 text-xs font-bold ${status.includes('Erro') ? 'bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'}`}>
          {status}
        </p>
      )}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60">
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar e Conectar
        </button>
        <button type="button" onClick={onClose} className="rounded-full border border-black/10 dark:border-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
          Cancelar
        </button>
      </div>
    </form>
  );
}

