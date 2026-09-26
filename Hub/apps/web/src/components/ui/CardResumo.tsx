'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';

/**
 * CARD DE RESUMO — o padrão dos números no topo das telas.
 *
 * Nasceu na Central de Guias, a partir do Início: rótulo pequeno, o valor em
 * destaque e uma linha de texto embaixo. Sem ícone no canto e sem pílula — a
 * cor aparece só no valor, quando ela diz alguma coisa (atraso, prejuízo).
 * O primeiro card da fila pode ser o `destaque`: escuro, valor em verde-limão.
 *
 * Clicável inteiro quando leva a algum lugar (`href`) ou filtra algo
 * (`onClick`); sem seta — ela se repetia em todos os cards.
 */

export type TomDoValor = 'padrao' | 'alerta' | 'positivo' | 'negativo';

const COR_DO_VALOR: Record<TomDoValor, string> = {
  padrao: 'text-ink',
  alerta: 'text-amber-600 dark:text-amber-400',
  positivo: 'text-emerald-700 dark:text-emerald-400',
  negativo: 'text-rose-600 dark:text-rose-400',
};

export interface CardResumoProps {
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  /** A linha de baixo: contexto em texto, nunca pílula. */
  nota?: React.ReactNode;
  /** O card escuro da fila — um por fila, o número principal. */
  destaque?: boolean;
  tom?: TomDoValor;
  /** Ativo quando ele é o filtro aplicado na lista abaixo. */
  ativo?: boolean;
  href?: string;
  onClick?: () => void;
  /** Conteúdo extra à direita do valor (um anel, um mini gráfico). */
  lateral?: React.ReactNode;
  className?: string;
}

export function CardResumo({ rotulo, valor, nota, destaque, tom = 'padrao', ativo, href, onClick, lateral, className = '' }: CardResumoProps) {
  const miolo = destaque ? (
    <div
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] border border-emerald-500/20 bg-[#0A0D0B]/85 p-5 text-left text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] ring-1 ring-inset ring-white/10 backdrop-blur-xl sm:p-6 dark:bg-[#0A0D0B]/75 ${className}`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#D4FF00]/15 blur-2xl" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rotulo text-white/70">{rotulo}</p>
          <p className="mt-3 break-words font-serif text-[28px] font-extrabold leading-none tracking-tight text-[#D4FF00] tabular xl:text-[32px]">{valor}</p>
        </div>
        {lateral}
      </div>
      {nota && <p className="relative z-10 mt-5 text-xs text-white/70">{nota}</p>}
    </div>
  ) : (
    <Card
      level={1}
      interactive={Boolean(href || onClick)}
      className={`flex h-full flex-col justify-between p-5 text-left sm:p-6 ${ativo ? 'ring-2 ring-hexxa-forest/40 dark:ring-hexxa-lime/40' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rotulo text-ink-soft">{rotulo}</p>
          <p className={`mt-2 font-serif text-2xl font-bold tracking-tight tabular sm:text-3xl ${COR_DO_VALOR[tom]}`}>{valor}</p>
        </div>
        {lateral}
      </div>
      {nota && <p className="mt-5 text-xs text-ink-soft">{nota}</p>}
    </Card>
  );

  const clicavel = 'block h-full text-left transition-transform hover:scale-[1.01]';
  if (href) {
    return (
      <Link href={href as never} className={clicavel}>
        {miolo}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${clicavel} w-full`}>
        {miolo}
      </button>
    );
  }
  return miolo;
}

/** A fila de cards: até quatro lado a lado, empilhados no celular. */
export function GradeDeResumo({ children, colunas = 4 }: { children: React.ReactNode; colunas?: 2 | 3 | 4 }) {
  const cols = colunas === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : colunas === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return <div className={`entrada-grade grid grid-cols-1 gap-4 ${cols}`}>{children}</div>;
}
