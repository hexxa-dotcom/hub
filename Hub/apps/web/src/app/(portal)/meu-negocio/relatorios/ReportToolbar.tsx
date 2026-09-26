'use client';

import { useState, useTransition } from 'react';
import { Download, PenTool, Loader2, X } from 'lucide-react';
import { sendReportForSignatureAction } from './report-actions';
import type { ReportType } from '@/lib/server/report-pdf-data';

export function ReportToolbar({
  reportType,
  query,
  documentTitle,
}: {
  reportType: ReportType;
  query: Record<string, string | undefined>;
  documentTitle: string;
}) {
  const [showSignForm, setShowSignForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const cleanQuery = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as Record<string, string>;
  const downloadHref = `/api/reports/${reportType}?${new URLSearchParams(cleanQuery).toString()}`;

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const res = await sendReportForSignatureAction(reportType, cleanQuery, documentTitle, name, email);
      setResult(res);
      if (res.ok) {
        setName('');
        setEmail('');
      }
    });
  }

  return (
    <div className="relative flex flex-col items-end gap-2 print:hidden">
      <div className="flex items-center gap-4">
        <a href={downloadHref} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
          <Download className="h-3.5 w-3.5" /> Baixar PDF
        </a>
        <button type="button" onClick={() => setShowSignForm((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
          <PenTool className="h-3.5 w-3.5" /> Enviar para assinatura
        </button>
      </div>

      {showSignForm && (
        <div className="absolute right-0 top-8 z-20 w-72 space-y-3 rounded-3xl border border-black/5 bg-surface p-5 shadow-(--elev-3) dark:border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">Enviar {documentTitle} para assinatura</p>
            <button type="button" onClick={() => setShowSignForm(false)} className="text-ink-soft hover:text-ink transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Nome do signatário"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3.5 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
          />
          <input
            type="email"
            placeholder="E-mail do signatário"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3.5 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-4 py-2 text-xs font-bold transition-all disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Enviar
          </button>
          {result && (
            <p className={`text-[11px] font-semibold ${result.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {result.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
