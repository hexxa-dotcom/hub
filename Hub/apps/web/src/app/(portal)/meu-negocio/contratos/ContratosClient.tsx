'use client';

import { useState } from 'react';
import {
  Plus, Trash2, Upload, Loader2, CheckCircle2, AlertCircle,
  UserPlus, ExternalLink, RefreshCw, Clock, XCircle, Mail,
  ChevronDown, ChevronUp, QrCode
} from 'lucide-react';
import type { AutentiqueDocument, Signer } from '@/lib/autentique';
import { ContractWizard } from './ContractWizard';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';

// ── helpers ────────────────────────────────────────────────────────────────

const field =
  'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

const ACTION_PT: Record<string, string> = {
  SIGN: 'Assinar',
  APPROVE: 'Aprovar',
  SIGN_AS_A_WITNESS: 'Testemunha',
  RECOGNIZE: 'Reconhecer',
};

// ── SignerBadge ──────────────────────────────────────────────────────────────

function SignerBadge({ sig }: { sig: AutentiqueDocument['signatures'][0] }) {
  if (sig.rejected?.created_at)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-critical/10 px-2.5 py-0.5 text-xs font-medium text-critical">
        <XCircle className="h-3 w-3" /> Recusado
      </span>
    );
  if (sig.signed?.created_at)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
        <CheckCircle2 className="h-3 w-3" /> Assinado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn">
      <Clock className="h-3 w-3" /> Pendente
    </span>
  );
}

// ── DocStatus ────────────────────────────────────────────────────────────────

function DocStatus({ doc }: { doc: AutentiqueDocument }) {
  const total = doc.signatures.length;
  const signed = doc.signatures.filter(s => s.signed?.created_at).length;
  const rejected = doc.signatures.filter(s => s.rejected?.created_at).length;
  if (rejected > 0)
    return <span className="text-xs font-semibold text-critical">Recusado</span>;
  if (total > 0 && signed === total)
    return <span className="text-xs font-semibold text-ok">Concluído</span>;
  return <span className="text-xs font-semibold text-warn">{signed}/{total} assinado{signed !== 1 ? 's' : ''}</span>;
}

// ── DocRow ───────────────────────────────────────────────────────────────────

function DocRow({ doc, onResend }: { doc: AutentiqueDocument; onResend: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  async function handleResend(publicId: string) {
    setResending(publicId);
    try {
      await fetch(`/api/contratos/reenviar/${publicId}`, { method: 'POST' });
      onResend(publicId);
    } finally {
      setResending(null);
    }
  }

  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{doc.name}</p>
          <p className="text-xs text-ink-soft">
            {new Date(doc.created_at).toLocaleDateString('pt-BR')} ·{' '}
            {doc.signatures.length} signatário{doc.signatures.length !== 1 ? 's' : ''}
          </p>
        </div>
        <DocStatus doc={doc} />
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />}
      </button>

      {open && (
        <div className="mb-3 ml-2 space-y-2 rounded-xl bg-black/[0.07] p-3 dark:bg-white/5">
          {doc.signatures.map(sig => (
            <div key={sig.public_id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{sig.name ?? sig.email}</p>
                {sig.name && <p className="text-xs text-ink-soft">{sig.email}</p>}
                <p className="text-xs text-ink-soft">{ACTION_PT[sig.action?.name ?? ''] ?? sig.action?.name ?? 'Assinar'}</p>
              </div>
              <div className="flex items-center gap-2">
                <SignerBadge sig={sig} />
                {sig.link?.short_link && !sig.signed?.created_at && (
                  <>
                    <a
                      href={sig.link.short_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/20 dark:text-brand-400"
                    >
                      <ExternalLink className="h-3 w-3" /> Link
                    </a>
                    <button
                      type="button"
                      disabled={resending === sig.public_id}
                      onClick={() => handleResend(sig.public_id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-ink/5 px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-ink/10 disabled:opacity-50"
                    >
                      {resending === sig.public_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      Reenviar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ContratosClient({ initial }: { initial: AutentiqueDocument[] }) {
  const [docs, setDocs] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<'upload' | 'generate'>('upload');
  const [pixModalOpen, setPixModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [signers, setSigners] = useState<Signer[]>([{ email: '', action: 'SIGN' }]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/contratos');
      if (res.ok) setDocs(await res.json());
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setFormError('Selecione um arquivo PDF.'); return; }
    const valid = signers.filter(s => s.email.trim());
    if (!valid.length) { setFormError('Adicione ao menos um signatário com e-mail.'); return; }

    setSubmitting(true);
    setFormError(null);

    const form = new FormData();
    form.append('name', name);
    form.append('signers', JSON.stringify(valid));
    form.append('file', file);

    try {
      const res = await fetch('/api/contratos/criar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Erro ao criar contrato.'); return; }
      setDocs(d => [data, ...d]);
      setName('');
      setSigners([{ email: '', action: 'SIGN' }]);
      setFile(null);
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 5000);
    } catch {
      setFormError('Falha na conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const pending = docs.filter(d =>
    d.signatures.some(s => !s.signed?.created_at && !s.rejected?.created_at),
  ).length;
  const concluded = docs.filter(d =>
    d.signatures.length > 0 && d.signatures.every(s => s.signed?.created_at),
  ).length;

  return (
    <div className="space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Total de contratos</p>
          <p className="mt-1 text-2xl font-semibold">{docs.length}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Aguardando assinatura</p>
          <p className="mt-1 text-2xl font-semibold text-warn">{pending}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Concluídos</p>
          <p className="mt-1 text-2xl font-semibold text-ok">{concluded}</p>
        </div>
      </div>

      {/* Formulário novo contrato */}
      {mode === 'generate' ? (
        <ContractWizard 
          onCancel={() => setMode('upload')}
          onGenerated={(generatedFile) => {
            setFile(generatedFile);
            if (!name) setName(generatedFile.name.replace('.pdf', ''));
            setMode('upload');
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} className="card-flat rounded-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between border-b border-line pb-4 mb-4 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">Enviar contrato para assinatura</h2>
              <button 
                type="button" 
                onClick={() => setPixModalOpen(true)}
                className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 transition-colors flex items-center gap-1.5"
              >
                <QrCode className="h-3.5 w-3.5" /> Cobrar via PIX
              </button>
            </div>
            <button 
              type="button" 
              onClick={() => setMode('generate')}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Criar modelo padrão +
            </button>
          </div>

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

        <div>
          <label className={lbl}>Arquivo PDF (máx. 5MB — plano gratuito)</label>
          <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line bg-surface-card/50 px-4 py-4 transition-colors hover:border-brand-400 hover:bg-brand-500/5">
            <Upload className="h-5 w-5 shrink-0 text-brand-500" />
            <span className="text-sm">
              {file ? (
                <span className="font-medium text-ink">
                  {file.name}{' '}
                  <span className="font-normal text-ink-soft">({(file.size / 1024).toFixed(0)} KB)</span>
                </span>
              ) : (
                <span className="text-ink-soft">Clique para selecionar o PDF do contrato</span>
              )}
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div>
          <label className={lbl}>Signatários</label>
          <div className="mt-1 space-y-2">
            {signers.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder={`email${i + 1}@empresa.com`}
                  value={s.email}
                  onChange={e => setSigners(sg => sg.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                  className={`flex-1 ${field}`}
                />
                <select
                  value={s.action}
                  onChange={e => setSigners(sg => sg.map((x, idx) => idx === i ? { ...x, action: e.target.value as Signer['action'] } : x))}
                  className="rounded-xl border border-line bg-surface-card px-2 py-2 text-sm outline-none focus:border-brand-400"
                >
                  {Object.entries(ACTION_PT).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {signers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSigners(sg => sg.filter((_, idx) => idx !== i))}
                    className="text-ink-soft transition-colors hover:text-critical"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSigners(sg => [...sg, { email: '', action: 'SIGN' }])}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 transition-colors hover:text-brand-600"
          >
            <UserPlus className="h-3.5 w-3.5" /> Adicionar signatário
          </button>
        </div>

        {formError && (
          <p className="flex items-center gap-2 rounded-xl bg-critical/10 px-3 py-2 text-sm text-critical">
            <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
          </p>
        )}
        {formSuccess && (
          <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Contrato enviado! Os signatários receberão o link por e-mail.
          </p>
        )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? 'Enviando para assinatura…' : 'Enviar para assinatura'}
          </button>
        </form>
      )}

      {/* Lista de contratos */}
      <section className="card-flat rounded-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Contratos enviados</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {docs.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nenhum contrato enviado ainda. Use o formulário acima.</p>
        ) : (
          <div className="mt-3">
            {docs.map(doc => (
              <DocRow key={doc.id} doc={doc} onResend={() => {}} />
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-ink-soft">
        Assinatura digital via{' '}
        <a href="https://autentique.com.br" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
          Autentique
        </a>{' '}
        · Plano gratuito (5MB por documento)
      </p>

      <GeneratePixModal 
        isOpen={pixModalOpen} 
        onClose={() => setPixModalOpen(false)} 
        initialDescription={`Referente a contrato`}
      />
    </div>
  );
}
