import {  ArrowUpRight  } from '@phosphor-icons/react/dist/ssr';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import type { Route } from 'next';

type Trend = { label: string; positive?: boolean };

type Props = {
  title: string;
  value?: string;
  hint?: string;
  trend?: Trend;
  /** card principal indigo, texto branco. */
  highlight?: boolean;
  /** botão circular de seta no canto (estilo da referência). */
  action?: boolean;
  glass?: boolean;
  tone?: 'default' | 'ok' | 'warn' | 'critical';
  href?: Route;
  className?: string;
  children?: React.ReactNode;
};

const toneText: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  critical: 'text-critical',
};

export function GlassCard({
  title,
  value,
  hint,
  trend,
  highlight = false,
  action = false,
  glass = false,
  tone = 'default',
  href,
  className,
  children,
}: Props) {
  return (
    <section
      className={twMerge(
        'rounded-card p-5',
        highlight ? 'card-highlight' : glass ? 'glass' : 'card-flat',
        href && 'hover-lift',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className={twMerge('text-sm font-medium', highlight ? 'text-white/85' : 'text-ink-soft')}>
          {title}
        </h3>
        {action && (
          href ? (
            <Link
              href={href}
              title="Ver detalhes"
              className={twMerge(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors',
                highlight
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'border border-line text-ink-soft hover:bg-black/5 dark:hover:bg-white/10',
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              aria-label="Ver detalhes"
              className={twMerge(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors',
                highlight
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'border border-line text-ink-soft hover:bg-black/5 dark:hover:bg-white/10',
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {value && (
        <p
          className={twMerge(
            'mt-3 text-[28px] font-semibold tracking-tight tabular',
            highlight ? 'text-white' : toneText[tone],
          )}
        >
          {value}
        </p>
      )}

      {(trend || hint) && (
        <div className="mt-1.5 flex items-center gap-2">
          {trend && (
            <span
              className={twMerge(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                highlight
                  ? 'bg-white/20 text-white'
                  : trend.positive
                    ? 'bg-ok/10 text-ok'
                    : 'bg-critical/10 text-critical',
              )}
            >
              {trend.positive ? '▲' : '▼'} {trend.label}
            </span>
          )}
          {hint && (
            <span className={twMerge('text-xs', highlight ? 'text-white/70' : 'text-ink-soft')}>
              {hint}
            </span>
          )}
        </div>
      )}

      {children}
    </section>
  );
}
