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
    <div className="flex items-center gap-3">
      <select
        className="appearance-none rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2 text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
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
        className="flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors cursor-pointer"
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </button>
    </div>
  );
}
