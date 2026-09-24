'use client';

import Link from 'next/link';

/**
 * FILTROS EM TEXTO — o padrão dos filtros e submenus do sistema.
 *
 * A página já tem um menu em pílula (SegmentedTabs) para as seções. Filtro
 * dentro de uma seção não repete a pílula: é texto, o ativo sublinhado com
 * um traço, e a contagem ao lado em tom mais claro. Três pílulas empilhadas
 * numa tela era ruído — ver a Central de Guias, onde o padrão nasceu.
 *
 * `badge` é para o que pede ação (vencido, não lido): número vermelho, igual
 * ao das abas.
 */

export interface FiltroDeTexto<T extends string = string> {
  id: T;
  label: React.ReactNode;
  /** Quantos itens o filtro mostra — aparece discreto ao lado do rótulo. */
  count?: number;
  /** O que pede ação: número vermelho. */
  badge?: number;
  /** Quando o filtro é uma rota (relatórios por ano, por exemplo). */
  href?: string;
}

export function FiltrosEmTexto<T extends string = string>({
  filtros,
  ativo,
  onChange,
  className = '',
}: {
  filtros: readonly FiltroDeTexto<T>[];
  ativo: T;
  onChange?: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      {filtros.map((f) => {
        const cls = `inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
          ativo === f.id ? 'text-ink' : 'text-ink-soft hover:text-ink'
        }`;
        // O traço fica só sob o rótulo — a contagem ao lado não é sublinhada.
        const conteudo = (
          <>
            <span className={ativo === f.id ? 'underline decoration-2 underline-offset-8' : ''}>{f.label}</span>
            {f.count !== undefined && <span className="tabular opacity-60">{f.count}</span>}
            {f.badge ? (
              <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white no-underline">{f.badge}</span>
            ) : null}
          </>
        );
        return f.href ? (
          <Link key={f.id} href={f.href as never} className={cls}>
            {conteudo}
          </Link>
        ) : (
          <button key={f.id} type="button" onClick={() => onChange?.(f.id)} className={cls}>
            {conteudo}
          </button>
        );
      })}
    </div>
  );
}
