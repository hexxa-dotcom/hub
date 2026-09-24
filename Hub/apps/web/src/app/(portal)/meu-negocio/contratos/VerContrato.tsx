'use client';

import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';

/** O contrato aberto dentro do Hub, quase em tela cheia — ler sem baixar. */
export function VerContrato({ id, titulo, onClose }: { id: string; titulo: string; onClose: () => void }) {
  return <VisualizadorDeArquivo src={`/api/contratos/${id}/pdf`} titulo={titulo} onClose={onClose} />;
}
