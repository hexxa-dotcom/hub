'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Loader2, CheckCircle2, AlertTriangle, UserPlus } from 'lucide-react';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';

const field =
  'w-full rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-caption font-bold text-ink-soft uppercase tracking-wider';

type Props = { onCreated: (doc: SignatureRequestSummary) => void };

export function ContratoForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [signers, setSigners] = useState<SignerInput[]>([{ name: '', email: '', role: '' }]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addSigner() {
    setSigners(s => [...s, { name: '', email: '', role: '' }]);
  }

  function removeSigner(i: number) {
    setSigners(s => s.filter((_, idx) => idx !== i));
  }

  function updateSigner(i: number, patch: Partial<SignerInput>) {
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
      setSigners([{ name: '', email: '', role: '' }]);
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

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-surface-card shadow-(--elev-2) border border-black/5 dark:border-white/5 space-y-4 p-6 sm:p-8 card-finish">
      <h2 className="font-serif font-bold text-base text-ink">Novo Contrato para Assinatura</h2>

      {/* Nome */}
      <div>
        <label className={lbl}>Nome do documento</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Ex.: Contrato de Prestação de Serviços — João Silva"
          className={`mt-1.5 ${field}`}
        />
      </div>

      {/* Upload PDF */}
      <div>
        <label className={lbl}>Arquivo PDF</label>
        <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 bg-surface-card shadow-(--elev-inset) px-4 py-4 transition-all hover:border-hexxa-green dark:hover:border-hexxa-lime">
          <Upload className="h-5 w-5 shrink-0 text-hexxa-green dark:text-hexxa-lime" />
          <span className="text-footnote text-ink-soft">
            {file ? (
              <span className="font-bold text-ink">{file.name} <span className="font-normal text-ink-soft">({(file.size / 1024).toFixed(0)} KB)</span></span>
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
        <div className="mt-1.5 space-y-2">
          {signers.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nome do signatário"
                value={s.name}
                onChange={e => updateSigner(i, { name: e.target.value })}
                className={`flex-1 ${field}`}
              />
              <input
                type="email"
                placeholder={`email${i + 1}@empresa.com`}
                value={s.email}
                onChange={e => updateSigner(i, { email: e.target.value })}
                className={`flex-1 ${field}`}
              />
              {signers.length > 1 && (
                <button type="button" onClick={() => removeSigner(i)} className="rounded-full p-2 text-ink-soft hover:bg-status-danger/10 hover:text-status-danger transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSigner}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-hexxa-green dark:text-hexxa-lime hover:underline"
        >
          <UserPlus className="h-3.5 w-3.5" /> Adicionar signatário
        </button>
      </div>

      {/* Status */}
      {error && (
        <p className="flex items-center gap-2 rounded-2xl bg-status-danger/10 border border-status-danger/20 p-3 text-xs font-bold text-status-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 rounded-2xl bg-status-success/10 border border-status-success/20 p-3 text-xs font-bold text-status-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Contrato enviado com sucesso! Os signatários receberão o link por e-mail.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {loading ? 'Enviando para assinatura…' : 'Enviar para Assinatura'}
      </button>
    </form>
  );
}

