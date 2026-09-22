'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  FileSignature,
  ShieldCheck,
  File,
  IdCard,
  Users,
  Plus,
  X,
  Trash2,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import type { DocRow } from './actions';
import { createDocumentAction, deleteDocumentAction } from './actions';

type Category = DocRow['category'];

const CATS: Record<Category, { label: string; icon: React.FC<{ className?: string }>; badge: string }> = {
  CNPJ: { label: 'CNPJ', icon: IdCard, badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20' },
  CONTRATO: { label: 'Contratos', icon: FileSignature, badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20' },
  SOCIOS: { label: 'Sócios', icon: Users, badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20' },
  ALVARA: { label: 'Alvarás', icon: FileText, badge: 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)' },
  CND: { label: 'CNDs', icon: ShieldCheck, badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' },
  OUTRO: { label: 'Outros', icon: File, badge: 'bg-black/5 text-ink-soft dark:bg-white/10 border border-black/5 dark:border-white/10' },
};

const FILTERS: ('TODOS' | Category)[] = ['TODOS', 'CNPJ', 'CONTRATO', 'SOCIOS', 'ALVARA', 'CND', 'OUTRO'];
const field =
  'mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-xs font-bold text-ink-soft tracking-wide uppercase';

function fmt(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function validity(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return { label: 'Vencida', cls: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20' };
  if (diff <= 30) return { label: `Vence em ${diff} dia${diff === 1 ? '' : 's'}`, cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20' };
  return { label: 'Válida', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' };
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
    <div className="space-y-8">
      {alerts > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs font-bold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {alerts} certidão(ões) ou documento(s) com vencimento próximo ou expirado.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            tabs={FILTERS.map((f) => ({
              id: f,
              label: f === 'TODOS' ? 'Todos' : CATS[f].label,
              icon: f === 'TODOS' ? undefined : CATS[f].icon,
            }))}
            activeTab={filter}
            onChange={setFilter}
            layoutId="arquivosFilterIndicator"
          />

          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="tap-target pressable focusable inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 text-hexxa-lime shadow-(--elev-1) active:scale-95 px-5 py-2 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Novo Documento
          </button>
        </div>
      </div>

      {showForm && (
        <Card level={1} className="p-6 sm:p-8 space-y-4 card-finish animate-in fade-in">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
            <h3 className="font-serif font-bold text-base text-ink">Novo Documento Permanente</h3>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full p-1 text-ink-soft hover:bg-black/5">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={lbl}>Nome do Documento</label>
                <input name="name" required placeholder="Ex.: Alvará de Localização e Funcionamento" className={field} />
              </div>
              <div>
                <label className={lbl}>Categoria</label>
                <select name="category" className={field}>
                  {(Object.keys(CATS) as Category[]).map((c) => <option key={c} value={c}>{CATS[c].label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Link do Arquivo (opcional)</label>
                <input name="fileUrl" type="url" placeholder="https://..." className={field} />
              </div>
              <div>
                <label className={lbl}>Data de Emissão</label>
                <input name="issuedAt" type="date" className={field} />
              </div>
              <div>
                <label className={lbl}>Data de Validade</label>
                <input name="expiresAt" type="date" className={field} />
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest text-hexxa-lime hover:brightness-110 active:scale-95 px-6 py-2.5 text-xs font-bold shadow-(--elev-1) transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'Salvando...' : 'Salvar Documento'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card level={1} className="divide-y divide-black/5 dark:divide-white/10 overflow-hidden card-finish">
        {docs.map((d) => {
          const cat = CATS[d.category];
          const Icon = cat.icon;
          const v = validity(d.expiresAt);
          return (
            <div key={d.id} className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-sm text-ink">{d.name}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cat.badge}`}>{cat.label}</span>
                  {v && <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${v.cls}`}>{v.label}</span>}
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {d.issuedAt && <>Emitido em {fmt(d.issuedAt)}</>}
                  {d.issuedAt && d.expiresAt && ' · '}
                  {d.expiresAt && <>Validade: {fmt(d.expiresAt)}</>}
                  {!d.issuedAt && !d.expiresAt && 'Documento permanente'}
                </p>
              </div>
              {d.fileUrl && (
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Visualizar ${d.name}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </a>
              )}
              <button
                type="button"
                onClick={() => handleDelete(d.id)}
                disabled={busyId === d.id}
                className="shrink-0 rounded-full p-2 text-ink-soft hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 transition-colors"
              >
                {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          );
        })}
        {docs.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-soft">Nenhum documento encontrado nesta categoria.</p>
        )}
      </Card>
    </div>
  );
}

