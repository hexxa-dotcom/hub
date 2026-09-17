'use client';

import { useState, useTransition } from 'react';
import { liberar, reabrir } from './actions';

/**
 * Fila de conferência do contador.
 *
 * A tela é deliberadamente curta. A IA já fez o trabalho e já registrou o
 * raciocínio dela — o que o contador precisa aqui é **bater o olho**: o mês
 * fecha, isto foi consertado sozinho, isto sobrou. Se a tela exigir leitura
 * longa, ela falhou no propósito, porque o ganho de ter a IA operando some se
 * alguém tiver que reconstruir o trabalho dela para confiar.
 */

interface Parecer {
  podeFechar?: boolean;
  resumo?: string;
  resolvidoPelaIA?: { pendencia: string; acao: string }[];
  pedidosAoCliente?: { id: string; mensagem: string }[];
  ocorrencias?: { id: string; severidade: string; titulo: string; detalhe: string }[];
}

interface Item {
  companyId: string;
  empresa: string;
  mes: string;
  fechadoEm: Date | string | null;
  parecer: unknown;
}

const mesLegivel = (iso: string) => {
  const [a, m] = iso.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[Number(m) - 1]}/${a}`;
};

function Cartao({ item, onSaiu }: { item: Item; onSaiu: (chave: string) => void }) {
  const [pendente, startTransition] = useTransition();
  const [reabrindo, setReabrindo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const p = (item.parecer ?? {}) as Parecer;
  const chave = `${item.companyId}:${item.mes}`;

  function agir(acao: 'liberar' | 'reabrir') {
    startTransition(async () => {
      const r =
        acao === 'liberar'
          ? await liberar(item.companyId, item.mes)
          : await reabrir(item.companyId, item.mes, motivo);
      if (r.ok) onSaiu(chave);
      else setErro(r.message);
    });
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1A1A18]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">{item.empresa}</h3>
          <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            {mesLegivel(item.mes)} · fechado pela IA
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Razão fecha
        </span>
      </div>

      {p.resolvidoPelaIA?.length ? (
        <div className="mt-4 rounded-xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#6E6A61] dark:text-[#A8A49C]">
            A IA resolveu sozinha
          </p>
          <ul className="mt-2 space-y-1">
            {p.resolvidoPelaIA.map((r) => (
              <li key={r.pendencia} className="text-xs text-[#231F20] dark:text-[#F5F6F4]">
                · {r.acao}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Nada a consertar — o mês veio limpo.
        </p>
      )}

      {p.pedidosAoCliente?.length ? (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Perguntado ao cliente
          </p>
          {p.pedidosAoCliente.map((x) => (
            <p key={x.id} className="mt-1 text-xs text-[#231F20] dark:text-[#F5F6F4]">
              {x.mensagem}
            </p>
          ))}
        </div>
      ) : null}

      {erro && <p className="mt-3 text-xs font-bold text-red-600 dark:text-red-400">{erro}</p>}

      {reabrindo ? (
        <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#6E6A61] dark:text-[#A8A49C]">
            Por que reabrir? — muda número já apresentado como final
          </label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: cliente enviou nota que faltava."
            className="mt-2 w-full rounded-xl border border-black/10 bg-transparent p-2.5 text-xs text-[#231F20] outline-none focus:border-[#2F4A3C] dark:border-white/15 dark:text-[#F5F6F4]"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReabrindo(false)}
              className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-bold text-[#6E6A61] dark:border-white/15 dark:text-[#A8A49C]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => agir('reabrir')}
              disabled={pendente || motivo.trim().length < 5}
              className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            >
              Confirmar reabertura
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end gap-2 border-t border-black/5 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => setReabrindo(true)}
            disabled={pendente}
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-bold text-[#6E6A61] transition-colors hover:text-[#231F20] disabled:opacity-50 dark:border-white/15 dark:text-[#A8A49C]"
          >
            Reabrir
          </button>
          <button
            type="button"
            onClick={() => agir('liberar')}
            disabled={pendente}
            className="rounded-full bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#F5F6F4] transition-colors hover:bg-[#3D5F4C] disabled:opacity-50"
          >
            {pendente ? 'Liberando…' : 'Conferido — liberar'}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConferirClient({ inicial }: { inicial: Item[] }) {
  const [itens, setItens] = useState(inicial);

  if (!itens.length) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-8 text-center dark:border-white/10 dark:bg-[#1A1A18]">
        <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Nada aguardando conferência</p>
        <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Quando a IA fechar um mês, ele aparece aqui para você bater o olho e liberar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {itens.map((i) => (
        <Cartao
          key={`${i.companyId}:${i.mes}`}
          item={i}
          onSaiu={(chave) => setItens((x) => x.filter((y) => `${y.companyId}:${y.mes}` !== chave))}
        />
      ))}
    </div>
  );
}
