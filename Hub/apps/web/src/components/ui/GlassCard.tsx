import { ArrowUpRight } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import type { Route } from 'next';

type Trend = { label: string; positive?: boolean };

type Props = {
  title: string;
  value?: string;
  hint?: string;
  trend?: Trend;
  /** card principal verde floresta escuro com texto claro */
  highlight?: boolean;
  /** botão circular de seta no canto */
  action?: boolean;
  glass?: boolean;
  tone?: 'default' | 'ok' | 'warn' | 'critical';
  href?: Route;
  className?: string;
  children?: React.ReactNode;
};

const toneText: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-[#231F20] dark:text-[#FEFDF3]',
  ok: 'text-[#2F4A3C] dark:text-[#DFFFAE]',
  warn: 'text-[#c27803] dark:text-[#fbbf24]',
  critical: 'text-[#e11d48] dark:text-[#fb7185]',
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
        'rounded-3xl p-5 md:p-6 transition-all duration-300',
        highlight
          ? 'bg-[#1E3328] text-[#FEFDF3] shadow-lg border border-[#2F4A3C]'
          : glass
            ? 'glass text-[#231F20] dark:text-[#FEFDF3]'
            : 'bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 text-[#231F20] dark:text-[#FEFDF3] shadow-sm hover:border-black/10 dark:hover:border-white/20',
        href && 'hover:-translate-y-1 hover:shadow-md cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className={twMerge(
            'text-xs font-semibold uppercase tracking-wider',
            highlight ? 'text-[#DFFFAE]' : 'text-[#6E6A61] dark:text-[#A8A49C]'
          )}
        >
          {title}
        </h3>
        {action && (
          href ? (
            <Link
              href={href}
              title="Ver detalhes"
              className={twMerge(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-200',
                highlight
                  ? 'bg-[#2F4A3C] text-[#DFFFAE] hover:bg-[#DFFFAE] hover:text-[#1E3328]'
                  : 'bg-black/5 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-[#DFFFAE] hover:text-[#231F20]',
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              aria-label="Ver detalhes"
              className={twMerge(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-200',
                highlight
                  ? 'bg-[#2F4A3C] text-[#DFFFAE] hover:bg-[#DFFFAE] hover:text-[#1E3328]'
                  : 'bg-black/5 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-[#DFFFAE] hover:text-[#231F20]',
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
            'mt-3 text-2xl sm:text-3xl font-semibold tracking-tight font-serif tabular',
            highlight ? 'text-[#FEFDF3]' : toneText[tone],
          )}
        >
          {value}
        </p>
      )}

      {(trend || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {trend && (
            <span
              className={twMerge(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                highlight
                  ? 'bg-[#DFFFAE] text-[#1E3328]'
                  : trend.positive
                    ? 'bg-[#EFFFD6] dark:bg-[#2F4A3C] text-[#2F4A3C] dark:text-[#DFFFAE]'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
              )}
            >
              {trend.positive ? '↑' : '↓'} {trend.label}
            </span>
          )}
          {hint && (
            <span className={twMerge('text-xs', highlight ? 'text-[#FEFDF3]/80' : 'text-[#6E6A61] dark:text-[#A8A49C]')}>
              {hint}
            </span>
          )}
        </div>
      )}

      {children}
    </section>
  );
}
