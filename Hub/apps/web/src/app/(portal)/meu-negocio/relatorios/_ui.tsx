/**
 * Peças comuns dos relatórios — o mesmo desenho do resto do sistema: rótulo
 * fino no alto, o conteúdo num painel arredondado, números em serifada e
 * filtros em texto. Sem o cabeçalho verde-escuro de antes.
 */

export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const th = 'py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft';
export const num = 'font-serif tabular';
export const corDoResultado = (v: number) => (v >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');

export function Painel({
  titulo,
  acao,
  id,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="rotulo text-ink-soft">{titulo}</p>
        {acao && <div className="print:hidden">{acao}</div>}
      </div>
      <div className="overflow-x-auto rounded-[28px] border border-white/70 bg-white/75 px-6 py-2 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5 print:border-0 print:bg-transparent print:px-0 print:ring-0">
        {children}
      </div>
    </section>
  );
}

export function Nota({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink-soft">{children}</p>;
}

export function Rodape({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[11px] text-ink-soft">{children}</p>;
}
