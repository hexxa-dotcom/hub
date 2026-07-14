'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

type Step = { id: string; label: string; done: boolean };
type ClienteOnboarding = {
  id: string;
  nome: string;
  plano: string;
  desde: string;
  responsavel: string;
  steps: Step[];
};

const STEP_LABELS = [
  'Dados cadastrais completos',
  'NF-e / NFSe configurada',
  'Certificado digital cadastrado',
  'Hub Financeiro — 1º lançamento',
  'Sócios e pró-labore configurados',
  'Primeiro contato com contador',
  'Trial convertido / plano ativo',
];

function makeSteps(done: boolean[]): Step[] {
  return STEP_LABELS.map((label, i) => ({ id: String(i), label, done: done[i] ?? false }));
}

const SEED: ClienteOnboarding[] = [
  {
    id: '1', nome: 'Hexxa Demo Serviços LTDA', plano: 'Início', desde: '2024-01-15', responsavel: 'Carlos Mendes',
    steps: makeSteps([true, true, true, true, true, true, true]),
  },
  {
    id: '2', nome: 'Tech Soluções ME', plano: 'Crescimento', desde: '2024-03-01', responsavel: 'Ana Beatriz Lima',
    steps: makeSteps([true, true, false, true, true, true, true]),
  },
  {
    id: '3', nome: 'Consultoria Silva & Cia', plano: 'Início', desde: '2024-06-10', responsavel: 'Roberto Silva',
    steps: makeSteps([true, true, true, true, false, true, true]),
  },
  {
    id: '4', nome: 'Studio Criativo LTDA', plano: 'Crescimento', desde: '2026-06-01', responsavel: 'Julia Castro',
    steps: makeSteps([true, false, false, false, false, true, false]),
  },
  {
    id: '5', nome: 'Advocacia Mendes Associados', plano: 'Início', desde: '2023-11-20', responsavel: 'Diego Mendes',
    steps: makeSteps([true, true, true, true, true, true, true]),
  },
  {
    id: '6', nome: 'DEF Comércio e Serviços ME', plano: 'Início', desde: '2025-02-14', responsavel: 'Fernanda Oliveira',
    steps: makeSteps([true, false, true, false, false, false, true]),
  },
];

function progress(steps: Step[]) {
  const done = steps.filter(s => s.done).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
}

function fmtDate(iso: string) { return iso.split('-').reverse().join('/'); }

export default function AdminOnboarding() {
  const [clientes, setClientes] = useState(SEED);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | 'pendente' | 'concluido'>('todos');

  function toggleStep(clienteId: string, stepId: string) {
    setClientes(prev => prev.map(c =>
      c.id === clienteId
        ? { ...c, steps: c.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s) }
        : c,
    ));
  }

  const filtered = clientes.filter(c => {
    const { pct } = progress(c.steps);
    if (filter === 'pendente') return pct < 100;
    if (filter === 'concluido') return pct === 100;
    return true;
  });

  const pendentes = clientes.filter(c => progress(c.steps).pct < 100).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Onboarding</h1>
        <p className="text-sm text-slate-500">{pendentes} cliente{pendentes !== 1 ? 's' : ''} com onboarding incompleto</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: clientes.length, cls: '' },
          { label: 'Pendentes', value: pendentes, cls: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Concluídos', value: clientes.length - pendentes, cls: 'text-green-600 dark:text-green-400' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center dark:border-slate-700 dark:bg-slate-900">
            <p className={`text-2xl font-semibold ${k.cls || 'text-slate-900 dark:text-white'}`}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['todos', 'pendente', 'concluido'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors capitalize ${filter === f ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
            {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendentes' : 'Concluídos'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(c => {
          const { done, total, pct } = progress(c.steps);
          const isExp = expanded === c.id;
          const completo = pct === 100;

          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button type="button" onClick={() => setExpanded(isExp ? null : c.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                {/* Avatar */}
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${completo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {c.nome.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{c.nome}</p>
                    {!completo && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />}
                  </div>
                  <p className="text-xs text-slate-400">{c.plano} · desde {fmtDate(c.desde)} · {c.responsavel}</p>
                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-1.5 rounded-full transition-all ${completo ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-semibold ${completo ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>{done}/{total}</span>
                  </div>
                </div>
                {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>

              {isExp && (
                <div className="border-t border-slate-100 px-5 pb-4 pt-3 dark:border-slate-800">
                  <ul className="space-y-2">
                    {c.steps.map(s => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-3">
                          <button type="button" onClick={() => toggleStep(c.id, s.id)}
                            className="shrink-0 transition-colors">
                            {s.done
                              ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                              : <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600" />}
                          </button>
                          <span className={`text-sm ${s.done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                            {s.label}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
