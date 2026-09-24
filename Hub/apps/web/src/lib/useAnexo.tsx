'use client';

import { useRef, useState } from 'react';

export type Anexo = { dataUrl: string; nome: string } | null;

/** Um anexo (PDF ou imagem, até 3 MB) lido como data URL — Serviços e Atendimento. */
export function useAnexo() {
  const [anexo, setAnexo] = useState<Anexo>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  function ler(f: File | undefined) {
    if (!f) return;
    if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/.test(f.type)) return setErro('Anexe um PDF ou uma imagem.');
    if (f.size > 3 * 1024 * 1024) return setErro('O anexo pode ter até 3 MB.');
    setErro(null);
    const r = new FileReader();
    r.onload = () => setAnexo({ dataUrl: String(r.result), nome: f.name });
    r.readAsDataURL(f);
  }
  const input = (
    <input
      ref={ref}
      type="file"
      accept="application/pdf,image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={(e) => {
        ler(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );
  return { anexo, setAnexo, erro, abrir: () => ref.current?.click(), input };
}
