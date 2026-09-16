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
    <div className="flex flex-col items-end gap-2 print:hidden">
      <div className="flex items-center gap-2">
        <a
          href={downloadHref}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#1A201C] px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm"
        >
          <Download className="h-3.5 w-3.5" /> Baixar PDF
        </a>
        <button
          type="button"
          onClick={() => setShowSignForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] transition-colors shadow-sm"
        >
          <PenTool className="h-3.5 w-3.5" /> Enviar para Assinatura
        </button>
      </div>

      {showSignForm && (
        <div className="w-72 rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-4 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Enviar {documentTitle} para assinatura</p>
            <button type="button" onClick={() => setShowSignForm(false)} className="text-[#6E6A61] hover:text-[#231F20]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Nome do signatário"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121614] px-3 py-2 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]"
          />
          <input
            type="email"
            placeholder="E-mail do signatário"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121614] px-3 py-2 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] transition-colors disabled:opacity-60"
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
