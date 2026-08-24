'use client';

import { useState } from 'react';
import { UploadCloud, FileText, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { processPGDAS } from './actions';

export function UploadPGDASForm({ companyId }: { companyId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await processPGDAS(companyId, formData);
    setIsUploading(false);

    if (res.success) {
      setResult(res);
      setFile(null); // Limpar após sucesso
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-black/15 dark:border-white/15 rounded-3xl p-8 text-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex flex-col items-center justify-center cursor-pointer"
          onClick={() => document.getElementById('pgdas-upload')?.click()}
        >
          <input
            id="pgdas-upload"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setFile(e.target.files[0]);
                setResult(null);
                setError(null);
              }
            }}
          />
          <div className="h-12 w-12 rounded-2xl bg-[#EFFFD6] dark:bg-[#2F4A3C]/40 flex items-center justify-center mb-3">
            <UploadCloud className="h-6 w-6 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">
            Clique para selecionar ou arraste o PDF
          </p>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">Somente arquivos .pdf do PGDAS</p>
        </div>
      ) : (
        <div className="border border-black/10 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between bg-[#FEFDF3] dark:bg-[#121614]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#EFFFD6] dark:bg-[#2F4A3C]/40 text-[#2F4A3C] dark:text-[#DFFFAE] rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] truncate max-w-[200px]">
                {file.name}
              </p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFile(null)}
              disabled={isUploading}
              className="p-2 text-[#6E6A61] hover:text-red-500 rounded-full hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-2 bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE] text-xs font-bold rounded-full transition-all flex items-center gap-2 disabled:opacity-70 shadow-xs"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando
                </>
              ) : (
                'Processar Recibo'
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl text-xs font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-xs">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <p className="font-bold text-sm">Recibo processado com sucesso!</p>
            <p className="text-emerald-700/80 dark:text-emerald-400/80 text-xs mt-1">
              RBA12 e Alíquota do mês {result.referenceMonth} foram extraídos e atualizados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

