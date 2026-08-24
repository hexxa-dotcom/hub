'use client';

import { useState } from 'react';
import { Check, Pencil, X, Plus, Loader2 } from 'lucide-react';
import { updatePlanoAction } from './actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type Plano = {
  id: string;
  nome: string;
  preco: number;
  cor: string;
  descricao: string;
  recursos: string[];
  ativo: boolean;
  clientes: number;
};

const COR_MAP: Record<string, { badge: string }> = {
  brand: { badge: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]' },
  violet: { badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  amber: { badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
};

const fi = 'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-3.5 py-2.5 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none transition-colors focus:border-[#2F4A3C]';

function EditModal({ plano, saving, onSave, onClose }: { plano: Plano; saving: boolean; onSave: (p: Plano) => void; onClose: () => void }) {
  const [form, setForm] = useState(plano);
  const [novoRecurso, setNovoRecurso] = useState('');

  function addRecurso() {
    if (!novoRecurso.trim()) return;
    setForm(f => ({ ...f, recursos: [...f.recursos, novoRecurso.trim()] }));
    setNovoRecurso('');
  }
  function removeRecurso(idx: number) {
    setForm(f => ({ ...f, recursos: f.recursos.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-5 border-b border-black/5 dark:border-white/10 pb-4">
          <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">Editar plano: {plano.nome}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">Nome</p>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={fi} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">Preço mensal (R$)</p>
              <input type="number" step="0.01" value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: Number(e.target.value) }))} className={fi} />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">Descrição</p>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={fi} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-2">Recursos incluídos</p>
            <ul className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {form.recursos.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] bg-black/5 dark:bg-white/5 p-2 rounded-xl">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="flex-1 font-medium">{r}</span>
                  <button onClick={() => removeRecurso(i)} className="text-[#6E6A61] hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input value={novoRecurso} onChange={e => setNovoRecurso(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRecurso()}
                placeholder="Adicionar recurso…" className={`flex-1 ${fi}`} />
              <button onClick={addRecurso} className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-[#DFFFAE] transition-all shadow-xs">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded accent-[#1E3328]" />
            <span className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Plano ativo (visível para novos clientes)</span>
          </label>
        </div>
        <div className="mt-6 flex gap-3 pt-2">
          <button disabled={saving} onClick={() => onSave(form)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-3 text-xs font-bold text-[#DFFFAE] disabled:opacity-60 transition-all shadow-xs">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
          </button>
          <button onClick={onClose}
            className="flex-1 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 py-3 text-xs font-bold text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlanosBoard({ initial }: { initial: Plano[] }) {
  const [planos, setPlanos] = useState(initial);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editingPlano = editId ? planos.find(p => p.id === editId) ?? null : null;

  async function savePlano(updated: Plano) {
    setSaving(true);
    const res = await updatePlanoAction(updated.id, {
      nome: updated.nome,
      preco: updated.preco,
      features: { descricao: updated.descricao, cor: updated.cor, ativo: updated.ativo, recursos: updated.recursos },
    });
    if (!('error' in res)) {
      setPlanos(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditId(null);
    }
    setSaving(false);
  }

  const mrrTotal = planos.reduce((s, p) => s + p.preco * p.clientes, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Planos</h1>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">MRR total: <span className="font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(mrrTotal)}</span></p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {planos.map(p => {
          const cor = (COR_MAP[p.cor] ?? COR_MAP.brand)!;
          return (
            <div key={p.id} className={`relative rounded-3xl border bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm transition-all hover:shadow-md ${!p.ativo ? 'opacity-60 border-dashed border-black/20 dark:border-white/20' : 'border-black/5 dark:border-white/10'}`}>
              {!p.ativo && (
                <span className="absolute right-4 top-4 rounded-full bg-black/10 px-2.5 py-0.5 text-[10px] font-bold text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]">Inativo</span>
              )}
              <div className="flex items-start justify-between mb-4">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${cor.badge}`}>{p.nome}</span>
                <button onClick={() => setEditId(p.id)}
                  className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3]">
                {BRL.format(p.preco)}
                <span className="text-xs font-normal text-[#6E6A61] dark:text-[#A8A49C]"> /mês</span>
              </p>
              <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{p.descricao || 'Sem descrição.'}</p>

              <div className="my-4 h-px bg-black/5 dark:bg-white/10" />

              <ul className="space-y-2.5">
                {p.recursos.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3]">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{r}</span>
                  </li>
                ))}
                {p.recursos.length === 0 && <li className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nenhum recurso listado.</li>}
              </ul>

              <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 px-4 py-2.5">
                <span className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Clientes ativos</span>
                <span className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{p.clientes}</span>
              </div>
            </div>
          );
        })}
      </div>

      {editingPlano && (
        <EditModal plano={editingPlano} saving={saving} onSave={savePlano} onClose={() => setEditId(null)} />
      )}
    </div>
  );
}

