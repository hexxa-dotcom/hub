'use client';

import { useState } from 'react';
import { X, Loader2, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';

const field =
  'block w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none transition-all focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime';
const lbl = 'text-xs font-bold text-ink-soft uppercase tracking-wide';

export function EmailSetupForm({ connected, emailAddress }: { connected: boolean; emailAddress: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!connected);
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
          emailAddress: fd.get('emailAddress'),
          password: fd.get('password'),
          imapHost: fd.get('imapHost'),
          imapPort: fd.get('imapPort'),
          smtpHost: fd.get('smtpHost'),
          smtpPort: fd.get('smtpPort'),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Conta conectada com sucesso!');
        setEditing(false);
        router.refresh();
      } else {
        setStatus('Erro: ' + (data.error || data.details || 'Falha ao conectar'));
      }
    } catch {
      setStatus('Erro de conexão com o servidor');
    }
    setSubmitting(false);
  }

  if (connected && !editing) {
    return (
      <Card level={1} className="p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Conta conectada</p>
            <p className="text-xs text-ink-soft">{emailAddress}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-bold text-ink-soft hover:text-ink underline"
        >
          Trocar credenciais
        </button>
      </Card>
    );
  }

  return (
    <Card level={1} className="p-6 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h3 className="text-sm font-semibold text-ink">Conectar E-mail (IMAP / SMTP)</h3>
          {connected && (
            <button type="button" onClick={() => setEditing(false)} className="rounded-full p-1 text-ink-soft hover:text-ink hover:bg-black/5">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-ink-soft">
          Usada para enviar a NFS-e automaticamente para o tomador por e-mail assim que autorizada.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>E-mail Completo</label>
            <input name="emailAddress" type="email" required defaultValue={emailAddress ?? ''} placeholder="voce@suaempresa.com.br" className={`mt-1.5 ${field}`} />
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
          <p className={`rounded-2xl p-3 text-xs font-bold ${status.includes('Erro') ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'}`}>
            {status}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar e Conectar
        </button>
      </form>
    </Card>
  );
}
