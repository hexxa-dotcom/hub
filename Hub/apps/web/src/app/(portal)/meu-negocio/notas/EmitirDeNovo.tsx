'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { emitirUmCliqueAction } from './emissao-actions';

/**
 * EMITIR DE NOVO — a nota em um clique, da ficha do cliente.
 *
 * Abre já com o valor e a descrição da última nota; confirmar emite pelo
 * caminho de sempre (`emitirNota`, com as travas). Nota igual no mês pede um
 * segundo "sim"; clique duplo não emite duas.
 */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function EmitirDeNovo({ customerId, valor: v0, descricao: d0 }: { customerId: string; valor: number; descricao: string }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(v0 ? v0.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const [descricao, setDescricao] = useState(d0);
  const [duplicada, setDuplicada] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const numero = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;

  const emitir = () =>
    iniciar(async () => {
      const r = await emitirUmCliqueAction(customerId, numero, descricao, duplicada);
      if (r.precisaConfirmar) setDuplicada(true);
      setMsg({ ok: r.ok, texto: r.message });
      if (r.ok) setTimeout(() => setAberto(false), 2500);
    });

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-ink-soft hover:text-ink">
        Emitir nota
      </button>
    );
  }
  return (
    <div className="w-full rounded-[28px] border border-white/60 bg-white/55 p-5 ring-1 ring-inset ring-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-serif text-lg text-ink-soft">R$</span>
        <input
          value={valor}
          onChange={(e) => {
            const n = e.target.value.replace(/\D/g, '');
            setValor(n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
            setDuplicada(false);
          }}
          inputMode="numeric"
          aria-label="Valor"
          className="w-40 bg-transparent font-serif text-2xl font-bold tabular text-ink outline-none"
        />
      </div>
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={2}
        aria-label="Descrição"
        className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white/60 px-4 py-2.5 text-sm font-normal text-ink outline-none dark:border-white/10 dark:bg-white/5"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pendente || numero <= 0 || !descricao.trim()}
          onClick={emitir}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2 text-xs font-semibold text-hexxa-lime disabled:opacity-40 dark:bg-hexxa-lime dark:text-hexxa-forest"
        >
          {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {duplicada ? 'Emitir mesmo assim' : `Emitir ${numero > 0 ? BRL.format(numero) : ''}`}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-ink-soft hover:text-ink">
          Cancelar
        </button>
      </div>
      {msg && <p className={`mt-3 text-xs font-normal ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : duplicada ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{msg.texto}</p>}
    </div>
  );
}
