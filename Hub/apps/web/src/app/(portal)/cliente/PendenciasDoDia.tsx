'use client';

import { CheckCircle2 } from 'lucide-react';
import { ListaEmColunas, BotaoDiscreto } from '@/components/ui/ListaEmColunas';
import type { Pendencia } from '@/lib/server/inicio';

/**
 * O QUE PEDE VOCÊ HOJE — uma lista só, de todas as áreas. Primeiro o que já
 * passou do prazo (ponto vermelho), depois o que vence logo (âmbar). Cada
 * linha leva direto para onde se resolve.
 */
export function PendenciasDoDia({ itens }: { itens: Pendencia[] }) {
  if (itens.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-[28px] border border-dashed border-black/10 px-6 py-10 text-sm text-ink-soft dark:border-white/10">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Nada pedindo você hoje. Tudo em dia.
      </p>
    );
  }
  return (
    <ListaEmColunas
      colunas={[
        { rotulo: 'Área', largura: '8rem', soDesktop: true },
        { rotulo: 'O que é', largura: 'minmax(0,1fr)' },
        { rotulo: '', largura: '7rem', alinhar: 'direita', soDesktop: true },
        { rotulo: '', largura: '8.5rem', alinhar: 'direita' },
      ]}
      itens={itens}
      chave={(p) => p.id}
      celulas={(p) => [
        <span key="a" className="inline-flex items-center gap-2 text-xs text-ink-soft">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.tom === 'alerta' ? 'bg-rose-500' : 'bg-amber-500'}`} />
          {p.area}
        </span>,
        <span key="t" className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{p.texto}</span>
          <span className="block truncate text-xs text-ink-soft sm:hidden">
            {p.area}
            {p.detalhe ? ` · ${p.detalhe}` : ''}
          </span>
        </span>,
        <span key="d" className="truncate text-xs tabular text-ink-soft">{p.detalhe ?? ''}</span>,
        <BotaoDiscreto key="b" href={p.href}>{p.acao}</BotaoDiscreto>,
      ]}
    />
  );
}
