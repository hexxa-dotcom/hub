'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { ServicoDoCatalogo } from '@/lib/server/servicos';
import { textoDoPreco, type TipoDePreco } from '@/lib/servicos-preco';
import { salvarServicoAction } from './actions';

const TIPOS: { id: TipoDePreco; label: string }[] = [
  { id: 'INCLUSO', label: 'Incluso no plano' },
  { id: 'A_PARTIR', label: 'A partir de' },
  { id: 'FIXO', label: 'Valor fixo' },
  { id: 'ORCAMENTO', label: 'Sob orçamento' },
];

export function CatalogoDoEscritorio({ catalogo }: { catalogo: ServicoDoCatalogo[] }) {
  const categorias = Array.from(new Set(catalogo.map((s) => s.categoria)));
  return (
    <div className="space-y-8">
      {categorias.map((cat) => (
        <section key={cat} className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6E6A61] dark:text-[#A8A49C]">{cat}</p>
          <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white/60 dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.03]">
            {catalogo
              .filter((s) => s.categoria === cat)
              .map((s) => (
                <Linha key={s.id} servico={s} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Linha({ servico }: { servico: ServicoDoCatalogo }) {
  const [tipo, setTipo] = useState<TipoDePreco>(servico.precoTipo);
  const [valor, setValor] = useState(servico.preco != null ? String(servico.preco).replace('.', ',') : '');
  const [ativo, setAtivo] = useState(servico.ativo);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const precisaValor = tipo === 'A_PARTIR' || tipo === 'FIXO';
  const numero = Number(valor.replace(/\./g, '').replace(',', '.'));
  const mudou = tipo !== servico.precoTipo || ativo !== servico.ativo || (precisaValor && numero !== servico.preco);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await salvarServicoAction(servico.id, { precoTipo: tipo, preco: precisaValor ? numero : null, ativo });
      setMsg(r.ok ? 'Salvo' : r.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${ativo ? '' : 'opacity-50'}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#231F20] dark:text-[#F5F6F4]">{servico.nome}</p>
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Cliente vê: {textoDoPreco(tipo, precisaValor ? numero || null : null)} · {servico.prazo}</p>
      </div>
      <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDePreco)} className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-xs dark:border-white/10">
        {TIPOS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {precisaValor && (
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="R$ 0,00" className="w-24 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-right text-xs dark:border-white/10" />
      )}
      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> No catálogo
      </label>
      <button
        type="button"
        onClick={salvar}
        disabled={!mudou || salvando}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-30"
      >
        {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Salvar
      </button>
      {msg && <span className="text-[11px] text-[#6E6A61]">{msg}</span>}
    </li>
  );
}
