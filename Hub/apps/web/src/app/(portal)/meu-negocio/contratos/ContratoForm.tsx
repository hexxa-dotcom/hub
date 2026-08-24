'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Loader2, CheckCircle2, AlertTriangle, UserPlus } from 'lucide-react';
import type { SignatureRequestSummary, SignerInput } from '@/lib/signature-types';

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

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
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md space-y-4 p-6 sm:p-8 shadow-sm">
      <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Novo Contrato para Assinatura</h2>

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
        <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 bg-white/40 dark:bg-white/5 px-4 py-4 transition-all hover:border-[#2F4A3C]">
          <Upload className="h-5 w-5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          <span className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            {file ? (
              <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{file.name} <span className="font-normal text-[#6E6A61]">({(file.size / 1024).toFixed(0)} KB)</span></span>
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
                <button type="button" onClick={() => removeSigner(i)} className="rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSigner}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline"
        >
          <UserPlus className="h-3.5 w-3.5" /> Adicionar signatário
        </button>
      </div>

      {/* Status */}
      {error && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-800 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Contrato enviado com sucesso! Os signatários receberão o link por e-mail.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {loading ? 'Enviando para assinatura…' : 'Enviar para Assinatura'}
      </button>
    </form>
  );
}

