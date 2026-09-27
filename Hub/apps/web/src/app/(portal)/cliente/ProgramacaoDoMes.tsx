'use client';

import { useState } from 'react';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { ListaEmColunas, Titulo, Valor, Situacao, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';
import type { CompromissoDoMes } from '@/lib/server/detalhes';

/**
 * A programação do mês: o que vence, a pagar e a receber, no padrão das listas.
 * Mostra os primeiros lançamentos e o resto num "exibir todos" — com o mês
 * cheio, a lista inteira virava uma tela sem fim.
 */

const LIMITE = 8;

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

type Filtro = 'todos' | 'pagar' | 'receber' | 'atrasados';

const SITUACAO = {
  PAGO: { cor: 'bg-black/25 dark:bg-white/30', texto: 'Pago' },
  ABERTO: { cor: 'bg-amber-500', texto: 'Em aberto' },
  ATRASADO: { cor: 'bg-rose-500', texto: 'Atrasado' },
} as const;

export function ProgramacaoDoMes({ itens }: { itens: CompromissoDoMes[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [todos, setTodos] = useState(false);
  const atrasados = itens.filter((i) => i.situacao === 'ATRASADO').length;
  const visiveis = itens.filter((i) =>
    filtro === 'pagar' ? !i.entrada : filtro === 'receber' ? i.entrada : filtro === 'atrasados' ? i.situacao === 'ATRASADO' : true,
  );

  const mostrados = todos ? visiveis : visiveis.slice(0, LIMITE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="rotulo text-ink-soft">Programação do mês</p>
        <FiltrosEmTexto<Filtro>
          ativo={filtro}
          onChange={(f) => {
            setFiltro(f);
            setTodos(false);
          }}
          filtros={[
            { id: 'todos', label: 'Todos', count: itens.length },
            {
              id: 'pagar',
              label: 'A pagar',
              count: itens.filter((i) => !i.entrada).length,
            },
            {
              id: 'receber',
              label: 'A receber',
              count: itens.filter((i) => i.entrada).length,
            },
            {
              id: 'atrasados',
              label: 'Atrasados',
              badge: atrasados || undefined,
            },
          ]}
        />
      </div>
      <ListaEmColunas
        colunas={[
          { rotulo: 'Lançamento', largura: 'minmax(0,1fr)' },
          { rotulo: 'Vence', largura: '6rem', soDesktop: true },
          { rotulo: 'Situação', largura: '7rem', soDesktop: true },
          { rotulo: 'Valor', largura: '8rem', alinhar: 'direita' },
        ]}
        itens={mostrados}
        chave={(i) => i.id}
        apagada={(i) => i.situacao === 'PAGO'}
        alerta={(i) => i.situacao === 'ATRASADO'}
        celulas={(i) => [
          <Titulo key="t" nome={i.titulo} apoio={i.categoria ?? (i.entrada ? 'A receber' : 'A pagar')} />,
          <span key="v" className="text-xs tabular text-ink-soft">
            {br(i.vencimento)}
          </span>,
          <Situacao key="s" cor={SITUACAO[i.situacao].cor}>
            {SITUACAO[i.situacao].texto}
          </Situacao>,
          <Valor key="r" tom={i.entrada ? 'entrada' : 'saida'}>
            {i.entrada ? '+ ' : '− '}
            {BRL.format(i.valor)}
          </Valor>,
        ]}
        detalhe={(i) => (
          <Detalhe acoes={<BotaoDiscreto href="/meu-negocio/hub-financeiro">Abrir no financeiro</BotaoDiscreto>}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Campo rotulo="Tipo">{i.entrada ? 'A receber' : 'A pagar'}</Campo>
              <Campo rotulo="Vencimento">{br(i.vencimento)}</Campo>
              <Campo rotulo="Categoria">{i.categoria ?? '—'}</Campo>
            </dl>
          </Detalhe>
        )}
        vazio={filtro === 'todos' ? 'Nada vence neste mês.' : 'Nenhum lançamento neste filtro.'}
      />
      {visiveis.length > LIMITE && (
        <div className="flex justify-center">
          <BotaoDiscreto onClick={() => setTodos(!todos)}>{todos ? 'Mostrar menos' : `Exibir todos (${visiveis.length})`}</BotaoDiscreto>
        </div>
      )}
    </div>
  );
}
