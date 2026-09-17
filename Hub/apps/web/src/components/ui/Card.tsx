import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight } from 'lucide-react';

/**
 * Card único do sistema. Existe porque a base tinha 196 assinaturas de card
 * distintas para 593 cards — um estilo novo a cada três cards, o que lê como
 * ruído em vez de sistema.
 *
 * Profundidade é hierarquia, não enfeite: `level` diz o quanto a superfície
 * importa, e só isso muda a sombra. Superfície grande e importante lê como
 * mais espessa; card de apoio quase não descola do fundo.
 */

type Level = 1 | 2 | 3;
type Tone = 'default' | 'deep';

const LEVEL: Record<Level, string> = {
  1: 'shadow-(--elev-1)',
  2: 'shadow-(--elev-2)',
  3: 'shadow-(--elev-3)',
};

const TONE: Record<Tone, string> = {
  default: 'bg-surface-card text-ink',
  // O tom escuro carrega o número principal da tela. `hero-surface` traz o
  // gradiente e o próprio acabamento — ele é escuro nos dois temas, então não
  // pode herdar o brilho e o grão que são definidos por tema. O bisel continua
  // vindo da escala de elevação: box-shadow declarado em dois lugares se
  // sobrescreve em vez de somar.
  // No neumorfismo não existe card escuro: tudo é a mesma superfície, e o
  // destaque vem do relevo, não da cor.
  deep: 'bg-surface-card text-ink',
};

export function Card({
  level = 1,
  tone = 'default',
  interactive = false,
  className,
  children,
}: {
  level?: Level;
  tone?: Tone;
  /** Marque quando o card inteiro leva a algum lugar — só então ele reage ao
   *  ponteiro. Card que não vai a lugar nenhum se mexendo é ruído. */
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={twMerge(
        'rounded-3xl p-6 sm:p-7',
        TONE[tone],
        LEVEL[level],
        // Acabamento (brilho + grão) só nos cards que carregam a tela. Em card
        // de apoio ele não aparece e ainda custa duas camadas de pintura.
        (level > 1 || tone === 'deep') && 'card-finish',
        interactive && 'liftable cursor-pointer',
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * Cabeçalho padrão: sobrancelha discreta + ação opcional à direita.
 * O rótulo recua para o dado poder crescer — é o número que a pessoa veio ver,
 * não o título da caixa.
 */
export function CardHeader({
  label,
  icon: Icon,
  href,
  hrefLabel = 'Ver tudo',
  aside,
  className,
}: {
  label: string;
  /**
   * Opcional de propósito. O ícone só entra quando ajuda a achar o card numa
   * varredura rápida da tela; num card que já se explica pelo rótulo ele vira
   * mais uma forma competindo com o dado. Herda a cor e a opacidade da
   * sobrancelha, então nunca grita mais alto que ela.
   */
  icon?: React.ComponentType<{ className?: string; weight?: 'bold' | 'duotone' | 'regular' }>;
  href?: Route;
  hrefLabel?: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={twMerge('flex items-center justify-between gap-4', className)}>
      {/* Cor por herança (opacidade sobre currentColor) para a mesma
          sobrancelha funcionar em card claro e em card escuro. */}
      <h2 className="inline-flex items-center gap-1.5 text-caption uppercase opacity-60">
        {Icon && <Icon weight="bold" className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </h2>
      {aside}
      {href && (
        <Link
          href={href}
          className="tap-target pressable focusable inline-flex shrink-0 items-center gap-1 text-footnote font-semibold opacity-60 transition-opacity hover:opacity-100"
        >
          {hrefLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </header>
  );
}

/**
 * Valor monetário em destaque. `tabular` trava a largura dos dígitos para o
 * número não "dançar" quando atualiza.
 */
export function Metric({
  value,
  size = 'title',
  className,
}: {
  value: string;
  size?: 'hero' | 'display' | 'title' | 'title2';
  className?: string;
}) {
  const sizeCls = { hero: 'text-hero', display: 'text-display', title: 'text-title', title2: 'text-title2' }[size];

  return <p className={twMerge('font-serif tabular', sizeCls, className)}>{value}</p>;
}
