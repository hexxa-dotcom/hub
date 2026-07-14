'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Loader2, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react';
import type { AutentiqueDocument, Signer } from '@/lib/autentique';

const field = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

type Props = { onCreated: (doc: AutentiqueDocument) => void };

export function ContratoForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [signers, setSigners] = useState<Signer[]>([{ email: '', action: 'SIGN' }]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addSigner() {
    setSigners(s => [...s, { email: '', action: 'SIGN' }]);
  }

  function removeSigner(i: number) {
    setSigners(s => s.filter((_, idx) => idx !== i));
  }

  function updateSigner(i: number, patch: Partial<Signer>) {
    setSigners(s => s.map((sg, idx) => (idx === i ? { ...sg, ...patch } : sg)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Selecione um arquivo PDF.'); return; }
    const validSigners = signers.filter(s => s.email.trim());
    if (!validSigners.length) { setError('Adicione ao menos um signatário com e-mail.'); return; }

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append('name', name);
    form.append('signers', JSON.stringify(validSigners));
    form.append('file', file);

    try {
      const res = await fetch('/api/contratos/criar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao criar contrato.'); return; }
      setSuccess(true);
      setName('');
      setSigners([{ email: '', action: 'SIGN' }]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onCreated(data);
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError('Falha na conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const ACTION_LABELS: Record<string, string> = {
    SIGN: 'Assinar',
    APPROVE: 'Aprovar',
    SIGN_AS_A_WITNESS: 'Testemunha',
    RECOGNIZE: 'Reconhecer',
  };

  return (
    <form onSubmit={handleSubmit} className="card-flat rounded-card space-y-4 p-5">
      <h2 className="text-lg font-semibold">Novo contrato</h2>

      {/* Nome */}
      <div>
        <label className={lbl}>Nome do documento</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Ex.: Contrato de Prestação de Serviços — João Silva"
          className={`mt-1 ${field}`}
        />
      </div>

      {/* Upload PDF */}
      <div>
        <label className={lbl}>Arquivo PDF</label>
        <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line bg-surface-card/50 px-4 py-4 transition-colors hover:border-brand-400 hover:bg-brand-500/5">
          <Upload className="h-5 w-5 shrink-0 text-brand-500" />
          <span className="text-sm text-ink-soft">
            {file ? (
              <span className="font-medium text-ink">{file.name} <span className="font-normal text-ink-soft">({(file.size / 1024).toFixed(0)} KB)</span></span>
            ) : (
              'Clique para selecionar o PDF do contrato (máx. 5MB)'
            )}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {/* Signatários */}
      <div>
        <label className={lbl}>Signatários</label>
        <div className="mt-1 space-y-2">
          {signers.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="email"
                placeholder={`email${i + 1}@empresa.com`}
                value={s.email}
                onChange={e => updateSigner(i, { email: e.target.value })}
                className={`flex-1 ${field}`}
              />
              <select
                value={s.action}
                onChange={e => updateSigner(i, { action: e.target.value as Signer['action'] })}
                className="rounded-xl border border-line bg-surface-card px-2 py-2 text-sm outline-none focus:border-brand-400"
              >
                {Object.entries(ACTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {signers.length > 1 && (
                <button type="button" onClick={() => removeSigner(i)} className="text-ink-soft hover:text-critical transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSigner}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" /> Adicionar signatário
        </button>
      </div>

      {/* Status */}
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Contrato enviado! Os signatários receberão o link por e-mail.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {loading ? 'Enviando para assinatura…' : 'Enviar para assinatura'}
      </button>
    </form>
  );
}
