'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { definirHonorarios } from './honorarios-actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Honorários do cliente: plano, desconto e o que de fato vai na fatura.
 *
 * O valor final aparece enquanto se digita, porque é o número que o cliente
 * vai receber — e é nele, não no preço de tabela, que um erro de digitação
 * no desconto se revela.
 */
export function HonorariosEditor({
  companyId,
  planos,
  atual,
}: {
  companyId: string;
  planos: { id: string; nome: string; valor: number }[];
  atual: { planId: string | null; desconto: number; motivo: string | null; status: string | null };
}) {
  const [planId, setPlanId] = useState(atual.planId ?? '');
  const [desconto, setDesconto] = useState(atual.desconto ? String(atual.desconto) : '');
  const [motivo, setMotivo] = useState(atual.motivo ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, salvar] = useTransition();

  const plano = planos.find((p) => p.id === planId);
  const valorDesconto = Number(desconto.replace(',', '.')) || 0;
  const final = plano ? plano.valor - valorDesconto : null;

  function gravar() {
    setMsg(null);
    salvar(async () => {
      const r = await definirHonorarios(companyId, planId, valorDesconto, motivo);
      setMsg({ ok: r.ok, texto: r.mensagem });
    });
  }

  const campo =
    'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]';

  return (
    <div className="space-y-3">
      <label className="block text-xs">
        <span className="font-bold text-[#231F20] dark:text-[#F5F6F4]">Plano</span>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={campo}>
          <option value="">— escolher —</option>
          {planos.map((p) => (
            <option key={p.id} value={p.id}>{p.nome} · {BRL.format(p.valor)}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <label className="block text-xs">
          <span className="font-bold text-[#231F20] dark:text-[#F5F6F4]">Desconto (R$)</span>
          <input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" placeholder="0" className={campo} />
        </label>
        <label className="block text-xs">
          <span className="font-bold text-[#231F20] dark:text-[#F5F6F4]">Motivo</span>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="cliente antigo" className={campo} />
        </label>
      </div>

      {final !== null && (
        <div className="rounded-2xl bg-[#EFFFD6] px-4 py-3 dark:bg-[#2F4A3C]/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#2F4A3C]/80 dark:text-[#DFFFAE]/80">Vai na fatura</p>
          <p className="font-serif text-xl font-bold tabular text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(final)}/mês</p>
          {valorDesconto > 0 && (
            <p className="text-xs text-[#2F4A3C]/80 dark:text-[#DFFFAE]/80">
              {BRL.format(plano!.valor)} − {BRL.format(valorDesconto)} de desconto
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={gravar}
        disabled={!planId || salvando}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
      >
        {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Salvar honorários
      </button>

      {msg && (
        <p className={`flex items-start gap-1.5 text-xs ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {msg.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {msg.texto}
        </p>
      )}
    </div>
  );
}
