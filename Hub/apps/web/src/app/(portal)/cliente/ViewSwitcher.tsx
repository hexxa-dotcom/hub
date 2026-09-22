'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { SquaresFour, ListBullets, type Icon } from '@phosphor-icons/react';
import { spring, crossFade } from '@/lib/motion';
import { VIEWS, DEFAULT_VIEW, type ViewId } from './views';

/**
 * O ícone mora aqui, e não em `views.ts`, para o módulo de dados continuar sem
 * componentes — é ele que o servidor importa, e valor de módulo client chega
 * lá como proxy, não como o dado em si — o servidor lia `VIEWS` e recebia algo
 * sem `.some()`. Constante compartilhada entre os dois lados mora num módulo
 * que nenhum dos dois marca.
 *
 * `SquaresFour` é o mesmo ícone da seção Início na barra lateral: o menu e a
 * pílula falam do mesmo lugar, então usam o mesmo símbolo.
 */
const ICONS: Record<ViewId, Icon> = {
  resumo: SquaresFour,
  detalhes: ListBullets,
};

/**
 * Seletor de vista em pílula, mesmo padrão do Hub Financeiro — a pílula já é o
 * controle de troca de vista do sistema, então repetir a forma aqui poupa a
 * pessoa de aprender dois jeitos de fazer a mesma coisa.
 *
 * São links, não botões: a vista mora na URL (`?v=`), o que mantém o estado
 * compartilhável, navegável pelo histórico e recarregável.
 */
export function ViewSwitcher({ active }: { active: ViewId }) {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();

  const getHref = (id: ViewId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === DEFAULT_VIEW) {
      params.delete('v');
    } else {
      params.set('v', id);
    }
    const qs = params.toString();
    return qs ? `/cliente?${qs}` : '/cliente';
  };

  return (
    <nav className="segmented-track inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1.5 no-scrollbar">
      {VIEWS.map((v) => {
        const isActive = v.id === active;
        const Icon = ICONS[v.id];
        return (
          <Link
            key={v.id}
            href={getHref(v.id) as never}
            aria-current={isActive ? 'page' : undefined}
            className={`tap-target pressable focusable relative z-10 inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-footnote font-semibold transition-colors sm:px-5 ${
              isActive ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={reduceMotion ? undefined : 'clienteViewPill'}
                transition={reduceMotion ? crossFade : spring.snappy}
                className="segmented-thumb absolute inset-0 -z-10 rounded-full"
              />
            )}
            {/* Peso `bold` e não `duotone` como na barra lateral: a 16px a
                camada preenchida do duotone vira borrão. Peso acompanha o
                tamanho — é a mesma família, na densidade que o tamanho pede. */}
            <Icon weight="bold" className="h-4 w-4 shrink-0" />
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
