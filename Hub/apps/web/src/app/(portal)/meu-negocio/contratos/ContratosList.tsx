'use client';

import { useState } from 'react';
import { ExternalLink, RefreshCw, CheckCircle2, Clock, XCircle, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import type { AutentiqueDocument } from '@/lib/autentique';

const ACTION_PT: Record<string, string> = {
  SIGN: 'Assinar',
  APPROVE: 'Aprovar',
  SIGN_AS_A_WITNESS: 'Testemunha',
  RECOGNIZE: 'Reconhecer',
};

function SignerBadge({ sig }: { sig: AutentiqueDocument['signatures'][0] }) {
  if (sig.rejected?.created_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-critical/10 px-2.5 py-0.5 text-xs font-medium text-critical">
        <XCircle className="h-3 w-3" /> Recusado
      </span>
    );
  }
  if (sig.signed?.created_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
        <CheckCircle2 className="h-3 w-3" /> Assinado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn">
      <Clock className="h-3 w-3" /> Pendente
    </span>
  );
}

function DocStatus({ doc }: { doc: AutentiqueDocument }) {
  const total = doc.signatures.length;
  const signed = doc.signatures.filter(s => s.signed?.created_at).length;
  const rejected = doc.signatures.filter(s => s.rejected?.created_at).length;
  if (rejected > 0) return <span className="text-xs font-medium text-critical">Recusado</span>;
  if (signed === total) return <span className="text-xs font-medium text-ok">Concluído</span>;
  return <span className="text-xs font-medium text-warn">{signed}/{total} assinados</span>;
}

function DocRow({ doc, onResend }: { doc: AutentiqueDocument; onResend: (publicId: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-line last:border-0">
      <div
        className="flex cursor-pointer items-center gap-3 py-3 hover:bg-black/5 dark:hover:bg-white/5 px-2 rounded-xl transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{doc.name}</p>
          <p className="text-xs text-ink-soft">
            {new Date(doc.created_at).toLocaleDateString('pt-BR')} · {doc.signatures.length} signatário{doc.signatures.length !== 1 ? 's' : ''}
          </p>
        </div>
        <DocStatus doc={doc} />
        {expanded ? <ChevronUp className="h-4 w-4 text-ink-soft shrink-0" /> : <ChevronDown className="h-4 w-4 text-ink-soft shrink-0" />}
      </div>

      {expanded && (
        <div className="mb-3 ml-2 space-y-2 rounded-xl bg-black/[0.07] dark:bg-white/5 p-3">
          {doc.signatures.map(sig => (
            <div key={sig.public_id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{sig.name ?? sig.email}</p>
                {sig.name && <p className="text-xs text-ink-soft">{sig.email}</p>}
                <p className="text-xs text-ink-soft">{ACTION_PT[sig.action.name] ?? sig.action.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <SignerBadge sig={sig} />
                {sig.link?.short_link && !sig.signed?.created_at && (
                  <>
                    <a
                      href={sig.link.short_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-500/20 transition-colors dark:text-brand-400"
                    >
                      <ExternalLink className="h-3 w-3" /> Link
                    </a>
                    <button
                      onClick={() => onResend(sig.public_id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-ink/5 px-2 py-1 text-xs font-medium text-ink-soft hover:bg-ink/10 transition-colors"
                    >
                      <Mail className="h-3 w-3" /> Reenviar
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

type Props = { initial: AutentiqueDocument[] };

export function ContratosList({ initial }: Props) {
  const [docs, setDocs] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/contratos');
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function resend(publicId: string) {
    await fetch(`/api/contratos/reenviar/${publicId}`, { method: 'POST' });
  }

  // Called by parent after creating a new doc
  function prepend(doc: AutentiqueDocument) {
    setDocs(d => [doc, ...d]);
  }

  return { docs, prepend, node: (
    <section className="card-flat rounded-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contratos enviados</h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {docs.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">Nenhum contrato enviado ainda. Use o formulário acima.</p>
      ) : (
        <div className="mt-3">
          {docs.map(doc => <DocRow key={doc.id} doc={doc} onResend={resend} />)}
        </div>
      )}
    </section>
  )};
}
