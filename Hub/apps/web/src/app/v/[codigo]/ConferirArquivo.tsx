'use client';

import { useRef, useState } from 'react';
import { FileCheck2, FileX2, Upload } from 'lucide-react';

/**
 * Confere se o PDF que a pessoa tem nas mãos é o original: calcula o SHA-256
 * do arquivo aqui mesmo, no navegador (o arquivo não sai do computador dela),
 * e compara com o hash registrado quando o contrato foi criado.
 */
export function ConferirArquivo({ hash }: { hash: string }) {
  const [resultado, setResultado] = useState<'igual' | 'diferente' | null>(null);
  const [nome, setNome] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  async function conferir(file: File | undefined) {
    if (!file) return;
    setNome(file.name);
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setResultado(hex === hash ? 'igual' : 'diferente');
  }

  return (
    <div className="rounded-2xl border border-dashed border-black/15 p-5">
      <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={(e) => conferir(e.target.files?.[0])} />
      <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-2 text-sm font-semibold text-[#0C110E]">
        <Upload className="h-4 w-4" /> Conferir o meu arquivo
      </button>
      <p className="mt-1 text-xs text-black/50">O PDF é conferido no seu navegador e não é enviado a lugar nenhum.</p>
      {resultado === 'igual' && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <FileCheck2 className="h-4 w-4" /> {nome} é idêntico ao documento assinado.
        </p>
      )}
      {resultado === 'diferente' && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-rose-600">
          <FileX2 className="h-4 w-4" /> {nome} não é o documento assinado — o arquivo foi alterado ou é outro.
        </p>
      )}
    </div>
  );
}
