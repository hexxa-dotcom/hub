import Link from 'next/link';
import type { Route } from 'next';
import { CheckCircle2 } from 'lucide-react';
import type { Area, Pendencia } from '@/lib/server/inicio';
import { BotaoDiscreto } from '@/components/ui/ListaEmColunas';
import { Cartao } from './Cartao';

/**
 * O QUE PEDE VOCÊ — um cartão por área, só das áreas que têm algo.
 *
 * Cada cartão mostra quantos itens são, os três mais urgentes com o prazo à
 * direita (vermelho = passou, âmbar = vence logo) e o caminho para resolver.
 * Área em dia não ganha cartão — vira uma linha no fim, para a tela não
 * encher de "nada aqui".
 */

const GRUPOS: { area: Area; titulo: string; href: string; acao: string; unidade: [string, string] }[] = [
  { area: 'Contabilidade', titulo: 'Contabilidade', href: '/minha-contabilidade/guias', acao: 'Ver guias', unidade: ['item', 'itens'] },
  { area: 'Notas', titulo: 'Notas a emitir', href: '/meu-negocio/notas', acao: 'Emitir', unidade: ['nota', 'notas'] },
  { area: 'Contratos', titulo: 'Contratos', href: '/meu-negocio/contratos', acao: 'Ver contratos', unidade: ['item', 'itens'] },
  { area: 'Clientes', titulo: 'Clientes e CRM', href: '/relacionamento', acao: 'Ver tarefas', unidade: ['item', 'itens'] },
  { area: 'Atendimento', titulo: 'Atendimento', href: '/suporte', acao: 'Abrir', unidade: ['item', 'itens'] },
  { area: 'Documentos', titulo: 'Documentos', href: '/minha-contabilidade/arquivos', acao: 'Ver documentos', unidade: ['item', 'itens'] },
  { area: 'Financeiro', titulo: 'Contas a pagar', href: '/meu-negocio/hub-financeiro?aba=pagar', acao: 'Ver contas', unidade: ['item', 'itens'] },
];

export const COR_DO_PRAZO = {
  alerta: 'text-rose-600 dark:text-rose-400',
  atencao: 'text-amber-700 dark:text-amber-400',
  aviso: 'text-ink-soft',
} as const;

/**
 * Os tamanhos do mosaico conforme quantas áreas têm algo. O primeiro (o mais
 * urgente) só ganha duas linhas de altura quando tem itens para preenchê-las.
 */
function tamanhos(n: number, primeiroAlto: boolean): string[] {
  const largo = 'sm:col-span-2 lg:col-span-12';
  if (n === 1) return [largo];
  if (n === 2) return ['lg:col-span-7', 'lg:col-span-5'];
  if (n === 3) return ['sm:col-span-2 lg:col-span-5', 'lg:col-span-4', 'lg:col-span-3'];
  if (primeiroAlto) {
    const base = ['sm:col-span-2 lg:col-span-5 lg:row-span-2', 'lg:col-span-4', 'lg:col-span-3', 'lg:col-span-4', 'lg:col-span-3'];
    if (n === 4) return [...base.slice(0, 3), 'lg:col-span-7'];
    if (n === 5) return base;
    if (n === 6) return [...base, largo];
    return [...base, 'lg:col-span-6', 'lg:col-span-6'];
  }
  if (n === 4) return ['lg:col-span-3', 'lg:col-span-3', 'lg:col-span-3', 'lg:col-span-3'];
  if (n === 5) return ['lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-6', 'lg:col-span-6'];
  if (n === 6) return Array(6).fill('lg:col-span-4');
  return ['lg:col-span-3', 'lg:col-span-3', 'lg:col-span-3', 'lg:col-span-3', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4'];
}

/** As áreas sem nada pendente — vão numa linha ao lado do título do bloco. */
export function areasEmDia(itens: Pendencia[]): string[] {
  return GRUPOS.filter((g) => g.area !== 'Financeiro' && !itens.some((p) => p.area === g.area)).map((g) => g.titulo.toLowerCase());
}

export function PendenciasDoDia({ itens }: { itens: Pendencia[] }) {
  const peso = { alerta: 0, atencao: 1, aviso: 2 } as const;
  const grupos = GRUPOS.map((g) => ({ ...g, itens: itens.filter((p) => p.area === g.area) }))
    .filter((g) => g.itens.length > 0)
    // A área com o item mais grave primeiro; empate, a que tem mais itens.
    .sort((a, b) => peso[a.itens[0]!.tom] - peso[b.itens[0]!.tom] || b.itens.length - a.itens.length);

  if (grupos.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-[28px] border border-dashed border-black/10 px-6 py-10 text-sm text-ink-soft dark:border-white/10">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Nada pedindo você hoje. Tudo em dia.
      </p>
    );
  }

  const primeiroAlto = grupos.length >= 4 && grupos[0]!.itens.length >= 3;
  const spans = tamanhos(grupos.length, primeiroAlto);
  return (
    <div>
      <div className="entrada-grade grid grid-flow-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {grupos.map((g, i) => {
          const vencidos = g.itens.filter((p) => p.tom === 'alerta').length;
          const grande = i === 0 && primeiroAlto;
          const mostra = g.itens.slice(0, grande ? 5 : 3);
          return (
            <Cartao key={g.area} rotulo={g.titulo} className={spans[i]}>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p className="font-serif text-2xl font-bold tracking-tight tabular text-ink">
                  {g.itens.length} <span className="font-sans text-xs font-normal text-ink-soft">{g.itens.length === 1 ? g.unidade[0] : g.unidade[1]}</span>
                </p>
                {vencidos > 0 && g.itens.length > mostra.length && <span className={`text-xs font-semibold ${COR_DO_PRAZO.alerta}`}>{vencidos} com prazo vencido</span>}
              </div>
              <ul className="mt-3 divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {mostra.map((p) => (
                  <li key={p.id}>
                    <Link href={p.href as Route} className="flex items-baseline justify-between gap-3 py-2 text-sm transition-colors hover:text-ink">
                      <span className="min-w-0 truncate text-ink">
                        {p.texto}
                        {p.detalhe && <span className="text-xs text-ink-soft"> · {p.detalhe}</span>}
                      </span>
                      {p.prazo && <span className={`shrink-0 text-xs font-medium ${COR_DO_PRAZO[p.tom]}`}>{p.prazo}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                {/* O botão leva ao item mais urgente — "Ver guias" num cartão que só tem o fechamento confundia. */}
                <BotaoDiscreto href={g.itens.length === 1 ? g.itens[0]!.href : g.href}>{g.itens.length === 1 ? g.itens[0]!.acao : g.acao}</BotaoDiscreto>
                {g.itens.length > mostra.length && <span className="text-xs text-ink-soft">+ {g.itens.length - mostra.length} {g.itens.length - mostra.length === 1 ? 'outro' : 'outros'}</span>}
              </div>
            </Cartao>
          );
        })}
      </div>
    </div>
  );
}
