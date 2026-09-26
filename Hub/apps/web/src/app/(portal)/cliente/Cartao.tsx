import Link from 'next/link';
import type { Route } from 'next';
import { ArrowUpRight } from 'lucide-react';

/**
 * O cartão da Início: vidro claro (ou escuro com brilho verde-limão, no
 * destaque), rótulo fino no alto e, ao passar o mouse, a seta de que leva a
 * algum lugar. Os tamanhos variam pelo mosaico — o cartão só dá a pele.
 */
export function Cartao({
  rotulo,
  href,
  destaque,
  className = '',
  children,
}: {
  rotulo: string;
  href?: string;
  destaque?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pele = destaque
    ? 'border-emerald-500/20 bg-[#0A0D0B]/85 text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] ring-white/10 dark:bg-[#0A0D0B]/75'
    : 'border-white/70 bg-white/75 ring-white/60 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5';
  const conteudo = (
    <>
      {destaque && <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[#D4FF00]/15 blur-3xl" />}
      <div className="relative flex items-center justify-between gap-2">
        <p className={`rotulo ${destaque ? 'text-white/70' : 'text-ink-soft'}`}>{rotulo}</p>
        {href && <ArrowUpRight className={`h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 ${destaque ? 'text-white/70' : 'text-ink-soft'}`} />}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </>
  );
  const cls = `group relative flex flex-col overflow-hidden rounded-[28px] border p-5 ring-1 ring-inset backdrop-blur-xl transition-colors sm:p-6 ${pele} ${className}`;
  return href ? (
    <Link href={href as Route} className={`${cls} ${destaque ? '' : 'hover:bg-white/90 dark:hover:bg-[#1b201c]/85'}`}>
      {conteudo}
    </Link>
  ) : (
    <div className={cls}>{conteudo}</div>
  );
}
