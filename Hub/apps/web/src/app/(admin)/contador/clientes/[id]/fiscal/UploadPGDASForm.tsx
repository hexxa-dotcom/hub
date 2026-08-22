'use client';

import { useState } from 'react';
import { CloudArrowUp, File, X, CheckCircle, WarningCircle, Spinner } from '@phosphor-icons/react';
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
          className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col items-center justify-center cursor-pointer"
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
          <div className="h-12 w-12 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-3">
            <CloudArrowUp className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Clique para selecionar ou arraste o PDF
          </p>
          <p className="text-xs text-slate-400 mt-1">Somente arquivos .pdf do PGDAS</p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded flex items-center justify-center">
              <File className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                {file.name}
              </p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFile(null)}
              disabled={isUploading}
              className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-70"
            >
              {isUploading ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin" /> Processando
                </>
              ) : (
                'Processar Recibo'
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
          <WarningCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-sm">
          <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Recibo processado com sucesso!</p>
            <p className="text-green-600/80 dark:text-green-400/80 text-xs mt-1">
              RBA12 e Alíquota do mês {result.referenceMonth} foram extraídos e atualizados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
