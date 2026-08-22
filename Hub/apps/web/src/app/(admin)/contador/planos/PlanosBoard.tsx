'use client';

import { useState } from 'react';
import { Check, PencilSimple, X, Plus, Spinner } from '@phosphor-icons/react';
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
  brand: { badge: 'bg-brand-500/10 text-brand-700 dark:text-brand-400' },
  violet: { badge: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  amber: { badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const fi = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Editar plano: {plano.nome}</h2>
          <button onClick={onClose} className="rounded-xl p-1 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Nome</p>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={fi} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Preço mensal (R$)</p>
              <input type="number" step="0.01" value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: Number(e.target.value) }))} className={fi} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Descrição</p>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={fi} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Recursos incluídos</p>
            <ul className="space-y-1.5 mb-2">
              {form.recursos.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  <span className="flex-1">{r}</span>
                  <button onClick={() => removeRecurso(i)} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input value={novoRecurso} onChange={e => setNovoRecurso(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRecurso()}
                placeholder="Adicionar recurso…" className={`flex-1 ${fi}`} />
              <button onClick={addRecurso} className="rounded-xl bg-brand-500 px-3 py-2 text-white hover:bg-brand-600 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded accent-brand-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Plano ativo (visível para novos clientes)</span>
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button disabled={saving} onClick={() => onSave(form)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60 transition-colors">
            {saving && <Spinner className="h-4 w-4 animate-spin" />} Salvar alterações
          </button>
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 transition-colors">
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
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Planos</h1>
          <p className="text-sm text-slate-500">MRR total: <span className="font-semibold text-slate-700 dark:text-slate-300">{BRL.format(mrrTotal)}</span></p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {planos.map(p => {
          const cor = (COR_MAP[p.cor] ?? COR_MAP.brand)!;
          return (
            <div key={p.id} className={`relative rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900 ${!p.ativo ? 'opacity-60 border-dashed border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700'}`}>
              {!p.ativo && (
                <span className="absolute right-3 top-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">Inativo</span>
              )}
              <div className="flex items-start justify-between mb-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cor.badge}`}>{p.nome}</span>
                <button onClick={() => setEditId(p.id)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors">
                  <PencilSimple className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {BRL.format(p.preco)}
                <span className="text-sm font-normal text-slate-500"> /mês</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{p.descricao || 'Sem descrição.'}</p>

              <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />

              <ul className="space-y-2">
                {p.recursos.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {r}
                  </li>
                ))}
                {p.recursos.length === 0 && <li className="text-sm text-slate-400">Nenhum recurso listado.</li>}
              </ul>

              <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="text-xs text-slate-500">Clientes ativos</span>
                <span className="text-base font-semibold text-slate-800 dark:text-slate-200">{p.clientes}</span>
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
