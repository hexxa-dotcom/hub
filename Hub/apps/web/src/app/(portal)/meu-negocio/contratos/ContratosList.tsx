'use client';

import { useState } from 'react';
import { ArrowsClockwise, CheckCircle, Clock, XCircle } from '@phosphor-icons/react';
import type { SignatureRequestSummary } from '@/lib/signature-types';

const STATUS_PT: Record<string, { label: string; icon: typeof CheckCircle; cls: string }> = {
  SIGNED: { label: 'Assinado', icon: CheckCircle, cls: 'bg-ok/10 text-ok' },
  REFUSED: { label: 'Recusado', icon: XCircle, cls: 'bg-critical/10 text-critical' },
  EXPIRED: { label: 'Expirado', icon: XCircle, cls: 'bg-critical/10 text-critical' },
  SENT: { label: 'Pendente', icon: Clock, cls: 'bg-warn/10 text-warn' },
  PENDING: { label: 'Pendente', icon: Clock, cls: 'bg-warn/10 text-warn' },
};

function DocRow({ doc }: { doc: SignatureRequestSummary }) {
  const status = STATUS_PT[doc.status] ?? STATUS_PT.PENDING!;
  const Icon = status.icon;
  return (
    <div className="flex items-center gap-3 border-b border-line px-2 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.title ?? 'Documento sem título'}</p>
        <p className="text-xs text-ink-soft">
          {doc.signerName ?? doc.signerEmail} · {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>
        <Icon className="h-3 w-3" /> {status.label}
      </span>
    </div>
  );
}

type Props = { initial: SignatureRequestSummary[] };

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

  function prepend(doc: SignatureRequestSummary) {
    setDocs(d => [doc, ...d]);
  }

  return {
    docs,
    prepend,
    node: (
      <section className="card-flat rounded-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Contratos enviados</h2>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowsClockwise className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {docs.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nenhum contrato enviado ainda. Use o formulário acima.</p>
        ) : (
          <div className="mt-3">
            {docs.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        )}
      </section>
    ),
  };
}
