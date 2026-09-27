'use client';

import { useState, useTransition } from 'react';
import { Building2, Check } from 'lucide-react';
import { useAviso } from '@/components/ui/useAviso';
import type { PerguntaDoEscritorio } from '@/lib/server/agente-extrato';
import { responderPerguntaComoContador } from './actions';

/**
 * As perguntas do extrato, de todos os clientes.
 *
 * Duas situações: a pergunta ainda aberta (o contador pode responder antes do
 * empresário) e a de valor alto que o empresário já respondeu — aqui ela só
 * precisa de um "está certo" ou da conta certa. A resposta do contador pesa
 * mais que a de qualquer outro na base de conhecimento.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const botao =
  'inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[0.06]';

type Conta = { conta: string; nome: string; tipo: 'INCOME' | 'EXPENSE' | 'AMBOS' };

export function PerguntasDoEscritorio({ perguntas, contas }: { perguntas: PerguntaDoEscritorio[]; contas: Record<string, Conta[]> }) {
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [pendente, iniciar] = useTransition();
  const { avisar, elemento } = useAviso();
  const vivas = perguntas.filter((p) => !feitas.has(p.id));

  const responder = (p: PerguntaDoEscritorio, conta: string) =>
    iniciar(async () => {
      const r = await responderPerguntaComoContador(p.companyId, p.id, conta);
      avisar(r.mensagem, r.ok);
      if (r.ok) setFeitas((f) => new Set(f).add(p.id));
    });

  if (!vivas.length) return null;

  return (
    <section className="space-y-3">
      {elemento}
      <div>
        <h2 className="rotulo text-ink-soft">Perguntas do extrato</h2>
        <p className="mt-1 text-xs text-ink-soft">
          O que não foi identificado com certeza nos extratos dos clientes, e os valores altos que o empresário respondeu e esperam a sua
          conferência.
        </p>
      </div>
      <ul className="divide-y divide-black/[0.08] overflow-hidden rounded-[28px] border border-white/60 bg-white/55 ring-1 ring-inset ring-white/40 backdrop-blur-2xl dark:divide-white/[0.12] dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
        {vivas.map((p) => (
          <Linha key={p.id} p={p} contas={contas[p.companyId] ?? []} pendente={pendente} responder={(c) => responder(p, c)} />
        ))}
      </ul>
    </section>
  );
}

function Linha({ p, contas, pendente, responder }: { p: PerguntaDoEscritorio; contas: Conta[]; pendente: boolean; responder: (conta: string) => void }) {
  const [outra, setOutra] = useState('');
  const doSentido = contas.filter((c) => c.tipo === 'AMBOS' || c.tipo === (p.valor < 0 ? 'EXPENSE' : 'INCOME'));
  const conferir = p.status === 'RESPONDIDA';
  return (
    <li className="space-y-3 px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 truncate text-sm font-medium text-ink">{p.descricao}</p>
        <p className="shrink-0 text-xs text-ink-soft">
          {br(p.data)} ·{' '}
          <span className="font-serif text-sm font-bold tabular text-ink">
            {p.valor < 0 ? '− ' : '+ '}
            {BRL.format(Math.abs(p.valor))}
          </span>
        </p>
      </div>
      <p className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
        <Building2 className="h-3.5 w-3.5" /> {p.empresa}
        {conferir && (
          <>
            {' '}
            · o empresário respondeu <strong className="text-ink">{p.respostaNome ?? p.resposta}</strong>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {conferir && p.resposta ? (
          <button type="button" disabled={pendente} className={botao} onClick={() => responder(p.resposta!)}>
            <Check className="h-3.5 w-3.5" /> Está certo
          </button>
        ) : (
          p.opcoes.map((o) => (
            <button key={o.conta} type="button" disabled={pendente} title={o.motivo ?? undefined} className={botao} onClick={() => responder(o.conta)}>
              {o.nome}
            </button>
          ))
        )}
        <select
          value={outra}
          disabled={pendente}
          onChange={(e) => {
            setOutra(e.target.value);
            if (e.target.value) responder(e.target.value);
          }}
          className="rounded-full border border-black/15 bg-transparent px-3 py-1.5 text-xs text-ink-soft dark:border-white/20"
          aria-label="Outra conta"
        >
          <option value="">{conferir ? 'Corrigir para…' : 'Outra…'}</option>
          {doSentido.map((c) => (
            <option key={c.conta} value={c.conta}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}
