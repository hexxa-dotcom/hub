'use client';

import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';

/**
 * Seletor de mês e botão de imprimir.
 *
 * Moravam dentro da página, que é componente de servidor — e componente de
 * servidor não pode passar função (`onChange`, `onClick`) para elemento
 * nenhum. A página quebrava na renderização para toda empresa com fechamento
 * registrado.
 */
export function ControlesDoRelatorio({
  meses,
  atual,
}: {
  meses: { valor: string; rotulo: string }[];
  atual: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-5">
      <select
        className="cursor-pointer border-b border-black/15 bg-transparent pb-1 text-xs font-semibold capitalize text-ink outline-none dark:border-white/20"
        defaultValue={atual}
        onChange={(e) => router.push(`/meu-negocio/relatorios/fechamento?month=${e.target.value}` as never)}
      >
        {meses.map((m) => (
          <option key={m.valor} value={m.valor}>{m.rotulo}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
      >
        <Printer className="h-3.5 w-3.5" />
        Imprimir
      </button>
    </div>
  );
}
