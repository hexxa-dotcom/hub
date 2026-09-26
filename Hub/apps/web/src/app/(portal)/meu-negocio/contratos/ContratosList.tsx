'use client';

import { useState } from 'react';
import { RotateCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { SignatureRequestSummary } from '@/lib/signature-types';

const STATUS_PT: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  SIGNED: { label: 'Assinado', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  REFUSED: { label: 'Recusado', icon: XCircle, cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  EXPIRED: { label: 'Expirado', icon: XCircle, cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  SENT: { label: 'Pendente', icon: Clock, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  PENDING: { label: 'Pendente', icon: Clock, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
};

function DocRow({ doc }: { doc: SignatureRequestSummary }) {
  const status = STATUS_PT[doc.status] ?? STATUS_PT.PENDING!;
  const Icon = status.icon;
  return (
    <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 px-2 py-3.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{doc.title ?? 'Documento sem título'}</p>
        <p className="text-footnote text-ink-soft">
          {doc.signerName ?? doc.signerEmail} · {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${status.cls}`}>
        <Icon className="h-3.5 w-3.5" /> {status.label}
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
      <section className="rounded-3xl bg-surface-card shadow-(--elev-1) border border-black/5 dark:border-white/5 p-6 sm:p-8 space-y-4 card-finish">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
          <h2 className="rotulo text-ink-soft">Contratos Enviados</h2>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-all"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">Nenhum contrato enviado ainda. Use o formulário acima.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {docs.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        )}
      </section>
    ),
  };
}

