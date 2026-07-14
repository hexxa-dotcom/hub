'use client';

import { useMemo, useState } from 'react';
import {
  FileCheck,
  FileSignature,
  ShieldCheck,
  File as FileIcon,
  Download,
  Upload,
  type LucideIcon,
} from 'lucide-react';

type Category = 'ALVARA' | 'CONTRATO' | 'CND' | 'OUTRO';

type Doc = {
  id: string;
  category: Category;
  name: string;
  issuedAt?: string;
  expiresAt?: string;
};

const CATS: Record<Category, { label: string; icon: LucideIcon; badge: string }> = {
  ALVARA: { label: 'Alvarás', icon: FileCheck, badge: 'bg-brand-500/10 text-brand-700 dark:text-brand-300' },
  CONTRATO: { label: 'Contratos', icon: FileSignature, badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' },
  CND: { label: 'CNDs', icon: ShieldCheck, badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  OUTRO: { label: 'Outros', icon: FileIcon, badge: 'bg-black/[0.07] text-ink-soft dark:bg-white/10' },
};

const today = new Date();
function addDays(n: number) {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmt(iso?: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function validity(expiresAt?: string) {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt).getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: 'Vencida', cls: 'bg-critical/10 text-critical' };
  if (diff <= 30) return { label: `Vence em ${diff} dia${diff === 1 ? '' : 's'}`, cls: 'bg-warn/10 text-warn' };
  return { label: 'Válida', cls: 'bg-ok/10 text-ok' };
}

const DOCS: Doc[] = [
  { id: '1', category: 'ALVARA', name: 'Alvará de Funcionamento', issuedAt: '2025-01-15' },
  { id: '2', category: 'ALVARA', name: 'Alvará do Corpo de Bombeiros (AVCB)', issuedAt: '2025-03-02', expiresAt: addDays(120) },
  { id: '3', category: 'CONTRATO', name: 'Contrato Social', issuedAt: '2020-05-10' },
  { id: '4', category: 'CONTRATO', name: 'Última Alteração Contratual', issuedAt: '2024-08-22' },
  { id: '5', category: 'CND', name: 'CND Federal (Receita / PGFN)', expiresAt: addDays(95) },
  { id: '6', category: 'CND', name: 'CND Estadual', expiresAt: addDays(12) },
  { id: '7', category: 'CND', name: 'CND Municipal', expiresAt: addDays(-8) },
  { id: '8', category: 'CND', name: 'CRF / FGTS', expiresAt: addDays(40) },
  { id: '9', category: 'OUTRO', name: 'Cartão CNPJ', issuedAt: '2025-02-01' },
];

const FILTERS: ('TODOS' | Category)[] = ['TODOS', 'ALVARA', 'CONTRATO', 'CND', 'OUTRO'];

export default function Page() {
  const [filter, setFilter] = useState<'TODOS' | Category>('TODOS');

  const docs = useMemo(
    () => (filter === 'TODOS' ? DOCS : DOCS.filter((d) => d.category === filter)),
    [filter],
  );

  const alerts = DOCS.filter((d) => {
    const v = validity(d.expiresAt);
    return v && v.label !== 'Válida';
  }).length;

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Arquivos Permanentes</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Documentos da empresa sempre à mão — alvarás, contratos, CNDs e mais. Disponibilizados pela sua contabilidade.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
          <Upload className="h-4 w-4" /> Enviar arquivo
        </button>
      </header>

      {alerts > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {alerts} certidão(ões) vencendo ou vencida(s) — vale renovar.
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f;
          const labelTxt = f === 'TODOS' ? 'Todos' : CATS[f].label;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-brand-500 text-white'
                  : 'border border-line text-ink-soft hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {labelTxt}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <section className="card-flat divide-y divide-line rounded-card">
        {docs.map((d) => {
          const cat = CATS[d.category];
          const Icon = cat.icon;
          const v = validity(d.expiresAt);
          return (
            <div key={d.id} className="flex items-center gap-4 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{d.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cat.badge}`}>{cat.label}</span>
                  {v && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${v.cls}`}>{v.label}</span>}
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {d.issuedAt && <>Emitido em {fmt(d.issuedAt)}</>}
                  {d.issuedAt && d.expiresAt && ' · '}
                  {d.expiresAt && <>Validade {fmt(d.expiresAt)}</>}
                  {!d.issuedAt && !d.expiresAt && 'Documento permanente'}
                </p>
              </div>
              <a
                href="#"
                aria-label={`Baixar ${d.name}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Download className="h-4 w-4" /> Baixar
              </a>
            </div>
          );
        })}
        {docs.length === 0 && <p className="p-5 text-sm text-ink-soft">Nenhum documento nesta categoria.</p>}
      </section>
    </div>
  );
}
