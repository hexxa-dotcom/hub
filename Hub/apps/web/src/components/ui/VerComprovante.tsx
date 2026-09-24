'use client';

import { useState, type ReactNode } from 'react';
import { VisualizadorDeArquivo } from './VisualizadorDeArquivo';

/** Botão que abre o comprovante de um lançamento dentro do Hub. */
export function VerComprovante({ id, nome, className, children }: { id: string; nome?: string | null; className?: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        className={className}
      >
        {children}
      </button>
      {aberto && <VisualizadorDeArquivo src={`/api/comprovantes/${id}`} titulo={nome || 'Comprovante'} onClose={() => setAberto(false)} />}
    </>
  );
}
