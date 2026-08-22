'use client';

import { useState } from 'react';
import { EnvelopeSimple, PaperPlaneRight, X, Gear, User } from '@phosphor-icons/react';
import EmailViewer from '@/components/crm/EmailViewer';
import EmailComposer from '@/components/crm/EmailComposer';

type Customer = {
  id: string;
  name: string;
  email: string | null;
};

const field = 'block w-full rounded-xl border border-line bg-surface px-4 py-2 text-sm text-ink outline-none transition-shadow focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20';
const lbl = 'text-xs font-medium text-ink-soft';

export function HubEmails({ companyId, initialCustomers }: { companyId: string; initialCustomers: Customer[] }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomers[0]?.id || '');
  const [showConfig, setShowConfig] = useState(false);
  const [replyingEmail, setReplyingEmail] = useState<any>(null);

  const selectedCustomer = initialCustomers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-4">
      {/* Top Banner / Actions */}
      <div className="card-flat rounded-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
            <EnvelopeSimple className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Central de E-mails CRM</h2>
            <p className="text-xs text-ink-soft">Conecte sua caixa postal e gerencie suas mensagens enviadas e recebidas.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowConfig(v => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-surface-card border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-black/5"
        >
          <Gear className="h-4 w-4" /> Configurar Provedor (IMAP/SMTP)
        </button>
      </div>

      {showConfig && <EmailConfigForm companyId={companyId} onClose={() => setShowConfig(false)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Seletor de Cliente */}
        <div className="card-flat rounded-card p-4 space-y-3 lg:col-span-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-brand-500" />
            Selecione o Cliente
          </h3>
          {initialCustomers.length === 0 ? (
            <p className="text-sm text-ink-soft py-4 text-center">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {initialCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomerId(c.id); setReplyingEmail(null); }}
                  className={`w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between ${
                    selectedCustomerId === c.id 
                      ? 'bg-brand-500 text-white font-medium shadow-sm' 
                      : 'bg-surface-card border border-line text-ink hover:bg-black/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{c.name}</p>
                    <p className={`truncate text-xs ${selectedCustomerId === c.id ? 'text-white/80' : 'text-ink-soft'}`}>
                      {c.email || 'Sem e-mail'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Área de E-mail do Cliente */}
        <div className="card-flat rounded-card p-5 lg:col-span-2 space-y-4">
          {selectedCustomer ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h3 className="text-base font-semibold text-ink">{selectedCustomer.name}</h3>
                  <p className="text-xs text-ink-soft">{selectedCustomer.email || 'Aviso: Cliente não possui e-mail cadastrado.'}</p>
                </div>
                {!replyingEmail && (
                  <button 
                    onClick={() => setReplyingEmail({ subject: '' })}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600"
                  >
                    <PaperPlaneRight weight="fill" />
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
            <div className="py-16 text-center text-sm text-ink-soft">
              Selecione um cliente ao lado para ver o histórico de e-mails.
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
    } catch (err) {
      setStatus('Erro de conexão com o servidor');
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Configurar E-mail (IMAP/SMTP)</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-xs text-ink-soft">Conecte sua conta de e-mail profissional para enviar e receber mensagens direto no CRM da Hexx.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>E-mail Completo</label>
          <input name="emailAddress" type="email" required placeholder="voce@suaempresa.com.br" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Senha (ou Senha de App)</label>
          <input name="password" type="password" required placeholder="••••••••" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Servidor IMAP (Entrada)</label>
          <div className="flex gap-2">
            <input name="imapHost" required placeholder="imap.mail.com" className={`mt-1 flex-1 ${field}`} />
            <input name="imapPort" defaultValue="993" className={`mt-1 w-20 ${field}`} />
          </div>
        </div>
        <div>
          <label className={lbl}>Servidor SMTP (Saída)</label>
          <div className="flex gap-2">
            <input name="smtpHost" required placeholder="smtp.mail.com" className={`mt-1 flex-1 ${field}`} />
            <input name="smtpPort" defaultValue="465" className={`mt-1 w-20 ${field}`} />
          </div>
        </div>
      </div>
      {status && <p className={`text-xs ${status.includes('Erro') ? 'text-critical' : 'text-ok'}`}>{status}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          Salvar e Conectar
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      </div>
    </form>
  );
}
