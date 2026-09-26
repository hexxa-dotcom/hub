'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';

/**
 * LISTA EM COLUNAS — o padrão das listas do sistema (nasceu em Clientes).
 *
 * Painel arredondado, cabeçalho com rótulos finos, colunas alinhadas (valores
 * à direita), divisória visível entre as linhas, e o primeiro clique abrindo
 * o detalhe na própria linha. A página completa, quando existe, abre por um
 * botão discreto dentro do detalhe (`BotaoDiscreto`).
 *
 * Mudou aqui, muda em todas as listas.
 */

export interface Coluna {
  rotulo: string;
  /** Trilha do grid no desktop: 'minmax(0,1fr)', '8rem', 'auto'… */
  largura: string;
  alinhar?: 'esquerda' | 'direita';
  /** Some no celular (fica só o essencial). */
  soDesktop?: boolean;
}

export interface ListaEmColunasProps<T> {
  colunas: Coluna[];
  itens: T[];
  chave: (item: T) => string;
  celulas: (item: T) => React.ReactNode[];
  /** O que abre no primeiro clique. Sem ele, a linha é um link (`href`) ou fica parada. */
  detalhe?: (item: T) => React.ReactNode;
  href?: (item: T) => string | null;
  /** Clicar na linha faz algo (abrir uma conversa, um modal) em vez de abrir o detalhe. */
  aoClicar?: (item: T) => void;
  /** Linha esmaecida (pago, inativo, cancelado). */
  apagada?: (item: T) => boolean;
  /** Linha com alerta (vencido): um fio vermelho discreto à esquerda. */
  alerta?: (item: T) => boolean;
  vazio?: React.ReactNode;
  /** Id aberto controlado de fora (opcional). */
  abertoInicial?: string | null;
}

const painel =
  'overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5';

export function ListaEmColunas<T>({ colunas, itens, chave, celulas, detalhe, href, aoClicar, apagada, alerta, vazio, abertoInicial = null }: ListaEmColunasProps<T>) {
  const [aberto, setAberto] = useState<string | null>(abertoInicial);
  const comSeta = Boolean(detalhe);
  // Celular: duas colunas (o título e o principal); desktop: as trilhas da lista, via variável.
  const grid = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 sm:grid-cols-(--trilhas)';
  const estiloGrid = { ['--trilhas' as string]: [...colunas.map((c) => c.largura), ...(comSeta ? ['1rem'] : [])].join(' ') } as React.CSSProperties;

  if (itens.length === 0) {
    return (
      <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
        {vazio ?? 'Nada por aqui.'}
      </p>
    );
  }

  const classeDaCelula = (c: Coluna, i: number) =>
    [
      c.alinhar === 'direita' ? 'text-right justify-self-end' : '',
      // No celular ficam a primeira coluna e a primeira que não é "soDesktop" depois dela.
      c.soDesktop || (i > 0 && i !== primeiraVisivelNoCelular) ? 'hidden sm:block' : '',
    ].join(' ');
  const primeiraVisivelNoCelular = colunas.findIndex((c, i) => i > 0 && !c.soDesktop);

  return (
    <div className={painel}>
      <div className={`lista-colunas ${grid} border-b border-black/[0.08] px-6 py-3 dark:border-white/[0.12]`} style={estiloGrid}>
        {colunas.map((c, i) => (
          <span key={c.rotulo || i} className={`rotulo text-ink-soft ${classeDaCelula(c, i)}`}>
            {c.rotulo}
          </span>
        ))}
        {comSeta && <span className="hidden sm:block" />}
      </div>
      <ul className="entrada-lista divide-y divide-black/[0.08] dark:divide-white/[0.12]">
        {itens.map((item) => {
          const id = chave(item);
          const estaAberto = aberto === id;
          const linkDaLinha = !detalhe && href ? href(item) : null;
          const conteudo = (
            <>
              {celulas(item).map((cel, i) => (
                <span key={i} className={`min-w-0 ${classeDaCelula(colunas[i]!, i)}`}>
                  {cel}
                </span>
              ))}
              {comSeta && <ChevronDown className={`hidden h-4 w-4 text-ink-soft transition-transform duration-200 sm:block ${estaAberto ? 'rotate-180' : ''}`} />}
            </>
          );
          const classeDaLinha = `lista-colunas ${grid} w-full px-6 py-3.5 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035] ${
            estaAberto ? 'bg-black/[0.025] dark:bg-white/[0.035]' : ''
          } ${apagada?.(item) ? 'opacity-60' : ''} ${alerta?.(item) ? 'shadow-[inset_2px_0_0_0_rgb(225_29_72/0.7)]' : ''}`;
          return (
            <li key={id}>
              {detalhe ? (
                <button type="button" onClick={() => setAberto(estaAberto ? null : id)} aria-expanded={estaAberto} className={classeDaLinha} style={estiloGrid}>
                  {conteudo}
                </button>
              ) : aoClicar ? (
                <button type="button" onClick={() => aoClicar(item)} className={classeDaLinha} style={estiloGrid}>
                  {conteudo}
                </button>
              ) : linkDaLinha ? (
                <Link href={linkDaLinha as never} className={classeDaLinha} style={estiloGrid}>
                  {conteudo}
                </Link>
              ) : (
                <div className={classeDaLinha} style={estiloGrid}>
                  {conteudo}
                </div>
              )}
              {detalhe && estaAberto && (
                <div className="border-t border-black/[0.06] bg-black/[0.015] px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.02]">{detalhe(item)}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Nome em cima, linha de apoio embaixo — a primeira coluna de quase toda lista. */
export function Titulo({ nome, apoio, monograma, apagado }: { nome: React.ReactNode; apoio?: React.ReactNode; monograma?: string; apagado?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {monograma && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hexxa-forest/[0.08] text-[11px] font-semibold tracking-wide text-hexxa-forest dark:bg-hexxa-lime/10 dark:text-hexxa-lime">
          {monograma}
        </span>
      )}
      <span className="min-w-0">
        <span className={`block truncate text-sm font-medium ${apagado ? 'text-ink-soft' : 'text-ink'}`}>{nome}</span>
        {apoio && <span className="block truncate text-xs text-ink-soft">{apoio}</span>}
      </span>
    </span>
  );
}

/** Valor em serifada, alinhado; "—" discreto quando não há. */
export function Valor({ children, tom = 'padrao', vazio }: { children: React.ReactNode; tom?: 'padrao' | 'entrada' | 'saida' | 'alerta' | 'suave'; vazio?: boolean }) {
  if (vazio) return <span className="font-serif text-sm text-ink-soft/60">—</span>;
  const cor = {
    padrao: 'font-bold text-ink',
    entrada: 'font-bold text-emerald-700 dark:text-emerald-400',
    saida: 'font-bold text-ink',
    alerta: 'font-bold text-amber-700 dark:text-amber-400',
    suave: 'text-ink-soft',
  }[tom];
  return <span className={`font-serif text-sm tabular ${cor}`}>{children}</span>;
}

/** Situação: um ponto colorido e o texto — sem pílula. */
export function Situacao({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cor}`} />
      {children}
    </span>
  );
}

/** O botão de contorno das listas: abrir a página completa sem gritar. */
export function BotaoDiscreto({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls =
    'inline-flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]';
  if (href)
    return (
      <Link href={href as never} className={cls}>
        {children} <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Campo do detalhe: rótulo fino e o valor embaixo. */
export function Campo({ rotulo, children, largo }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="rotulo text-ink-soft">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Grade do detalhe: campos à esquerda, ações à direita. */
export function Detalhe({ children, acoes }: { children: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">{children}</dl>
      {acoes && <div className="flex flex-wrap items-start gap-2 sm:justify-end">{acoes}</div>}
    </div>
  );
}
