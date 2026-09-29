'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useAviso } from '@/components/ui/useAviso';
import type { PerguntaAberta, MovimentoAmbiguo } from '@/lib/server/agente-extrato';
import { responderPerguntaAction, escolherLancamentoAction, naoEhNenhumAction } from './extrato-actions';

/**
 * O EXTRATO PERGUNTA — o que o sistema não identificou com certeza.
 *
 * Não há porcentagem de confiança aqui, de propósito: ou o movimento foi
 * identificado com certeza (por um lançamento, pelo que já foi ensinado ou
 * pela IA com conferência), ou vira uma destas perguntas. Um clique responde,
 * e a resposta ensina o sistema — o mesmo movimento não é perguntado de novo.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

const painel =
  'overflow-hidden rounded-[28px] border border-white/60 bg-white/55 ring-1 ring-inset ring-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5';
const opcao =
  'inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[0.06]';
const sugerida = 'border-hexxa-forest/50 bg-hexxa-forest/[0.06] dark:border-hexxa-lime/40 dark:bg-hexxa-lime/[0.08]';

type Conta = { conta: string; nome: string; tipo: 'INCOME' | 'EXPENSE' | 'AMBOS' };

export function PerguntasDoExtrato({ perguntas, ambiguos, contas }: { perguntas: PerguntaAberta[]; ambiguos: MovimentoAmbiguo[]; contas: Conta[] }) {
  const [pendente, iniciar] = useTransition();
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const { avisar, elemento } = useAviso();
  const total = perguntas.length + ambiguos.length - feitas.size;

  const fazer = (id: string, acao: () => Promise<{ ok: boolean; mensagem: string }>) =>
    iniciar(async () => {
      const r = await acao();
      avisar(r.mensagem, r.ok);
      if (r.ok) setFeitas((f) => new Set(f).add(id));
    });

  if (perguntas.length + ambiguos.length === 0 || total <= 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-[28px] border border-dashed border-black/10 px-6 py-8 text-sm text-ink-soft dark:border-white/10">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Todo o extrato está identificado.
        {elemento}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {elemento}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="rotulo text-ink-soft">O extrato pergunta</p>
        <p className="text-xs text-ink-soft">
          {total} {total === 1 ? 'movimento' : 'movimentos'} para você dizer o que foi · cada resposta ensina o sistema
        </p>
      </div>

      <ul className={`${painel} entrada-lista divide-y divide-black/[0.08] dark:divide-white/[0.12]`}>
        {ambiguos
          .filter((a) => !feitas.has(a.id))
          .map((a) => (
            <li key={a.id} className="space-y-3 px-6 py-5">
              <Cabecalho descricao={a.descricao} data={a.data} valor={a.valor} />
              <p className="text-sm text-ink">{a.valor < 0 ? 'Qual destas contas foi paga?' : 'Qual destes recebimentos foi?'}</p>
              <div className="flex flex-wrap gap-2">
                {a.candidatos.map((c) => (
                  <button key={c.id} type="button" disabled={pendente} className={opcao} onClick={() => fazer(a.id, () => escolherLancamentoAction(a.id, c.id))}>
                    {c.descricao || 'Sem descrição'} · vence {br(c.vencimento)}
                  </button>
                ))}
                <button type="button" disabled={pendente} className={`${opcao} text-ink-soft`} onClick={() => fazer(a.id, () => naoEhNenhumAction(a.id))}>
                  Nenhum destes
                </button>
              </div>
            </li>
          ))}

        {perguntas
          .filter((p) => !feitas.has(p.id))
          .map((p) => (
            <Pergunta key={p.id} p={p} contas={contas} pendente={pendente} responder={(conta) => fazer(p.id, () => responderPerguntaAction(p.id, conta))} />
          ))}
      </ul>
    </div>
  );
}

function Cabecalho({ descricao, data, valor }: { descricao: string; data: string; valor: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="min-w-0 truncate text-sm font-medium text-ink">{descricao}</p>
      <p className="shrink-0 text-xs text-ink-soft">
        {br(data)} ·{' '}
        <span className={`font-serif text-sm font-bold tabular ${valor < 0 ? 'text-ink' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {valor < 0 ? '− ' : '+ '}
          {BRL.format(Math.abs(valor))}
        </span>
      </p>
    </div>
  );
}

function Pergunta({ p, contas, pendente, responder }: { p: PerguntaAberta; contas: Conta[]; pendente: boolean; responder: (conta: string) => void }) {
  const [outra, setOutra] = useState('');
  const doSentido = contas.filter((c) => c.tipo === 'AMBOS' || c.tipo === (p.valor < 0 ? 'EXPENSE' : 'INCOME'));
  const principal = p.opcoes[0];
  return (
    <li className="space-y-3 px-6 py-5">
      <Cabecalho descricao={p.descricao} data={p.data} valor={p.valor} />
      <p className="text-sm text-ink">
        {p.valor < 0 ? 'Para que foi este pagamento?' : 'De onde veio este dinheiro?'}
        {principal?.motivo && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-soft">
            <Sparkles className="h-3 w-3" /> {principal.motivo}
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {p.opcoes.map((o, i) => (
          <button key={o.conta} type="button" disabled={pendente} title={o.motivo ?? undefined} className={`${opcao} ${i === 0 && o.motivo ? sugerida : ''}`} onClick={() => responder(o.conta)}>
            {o.nome}
          </button>
        ))}
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
          <option value="">Outra…</option>
          {doSentido.map((c) => (
            <option key={c.conta} value={c.conta}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      {p.revisarContador && <p className="text-[11px] text-ink-soft">Valor alto: depois da sua resposta, a contabilidade confere.</p>}
    </li>
  );
}
