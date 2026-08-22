'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Signature, ShieldCheck, File as FileIcon, DownloadSimple, Plus, X, Trash, Spinner, type Icon } from '@phosphor-icons/react';
import type { DocRow } from './actions';
import { createDocumentAction, deleteDocumentAction } from './actions';

type Category = DocRow['category'];

const CATS: Record<Category, { label: string; icon: Icon; badge: string }> = {
  ALVARA: { label: 'Alvarás', icon: FileText, badge: 'bg-brand-500/10 text-brand-700 dark:text-brand-300' },
  CONTRATO: { label: 'Contratos', icon: Signature, badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' },
  CND: { label: 'CNDs', icon: ShieldCheck, badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  OUTRO: { label: 'Outros', icon: FileIcon, badge: 'bg-surface-card border border-line text-ink-soft dark:bg-white/10' },
};

const FILTERS: ('TODOS' | Category)[] = ['TODOS', 'ALVARA', 'CONTRATO', 'CND', 'OUTRO'];
const field = 'mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm';
const lbl = 'text-xs font-medium text-ink-soft';

function fmt(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function validity(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return { label: 'Vencida', cls: 'bg-critical/10 text-critical' };
  if (diff <= 30) return { label: `Vence em ${diff} dia${diff === 1 ? '' : 's'}`, cls: 'bg-warn/10 text-warn' };
  return { label: 'Válida', cls: 'bg-ok/10 text-ok' };
}

export function ArquivosClient({ initialDocs }: { initialDocs: DocRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<'TODOS' | Category>('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const docs = useMemo(
    () => (filter === 'TODOS' ? initialDocs : initialDocs.filter((d) => d.category === filter)),
    [filter, initialDocs],
  );

  const alerts = initialDocs.filter((d) => {
    const v = validity(d.expiresAt);
    return v && v.label !== 'Válida';
  }).length;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createDocumentAction({
        category: String(fd.get('category')) as Category,
        name: String(fd.get('name')),
        issuedAt: String(fd.get('issuedAt') ?? ''),
        expiresAt: String(fd.get('expiresAt') ?? ''),
        fileUrl: String(fd.get('fileUrl') ?? ''),
      });
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteDocumentAction(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {alerts > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {alerts} certidão(ões) vencendo ou vencida(s) — vale renovar.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/5 dark:hover:bg-white/10'}`}>
              {f === 'TODOS' ? 'Todos' : CATS[f].label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Adicionar documento
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-brand-400/30 bg-brand-500/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-600 dark:text-brand-400">Novo documento</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={lbl}>Nome do documento</label>
              <input name="name" required placeholder="Ex.: Alvará de Funcionamento" className={field} />
            </div>
            <div>
              <label className={lbl}>Categoria</label>
              <select name="category" className={field}>
                {(Object.keys(CATS) as Category[]).map((c) => <option key={c} value={c}>{CATS[c].label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Link do arquivo (opcional)</label>
              <input name="fileUrl" type="url" placeholder="https://..." className={field} />
            </div>
            <div>
              <label className={lbl}>Emitido em</label>
              <input name="issuedAt" type="date" className={field} />
            </div>
            <div>
              <label className={lbl}>Validade</label>
              <input name="expiresAt" type="date" className={field} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar documento'}
          </button>
        </form>
      )}

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
              {d.fileUrl && (
                <a href={d.fileUrl} target="_blank" rel="noreferrer" aria-label={`Baixar ${d.name}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10">
                  <DownloadSimple className="h-4 w-4" /> Abrir
                </a>
              )}
              <button type="button" onClick={() => handleDelete(d.id)} disabled={busyId === d.id}
                className="shrink-0 text-ink-soft hover:text-critical disabled:opacity-50">
                {busyId === d.id ? <Spinner className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
              </button>
            </div>
          );
        })}
        {docs.length === 0 && <p className="p-5 text-sm text-ink-soft">Nenhum documento nesta categoria ainda.</p>}
      </section>
    </div>
  );
}
