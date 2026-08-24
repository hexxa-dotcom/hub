'use client';

import { useState } from 'react';
import {
  Receipt,
  Layers,
  Plus,
  X,
  Loader2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { TaxGuideRecord, TaxGuideStatusValue } from '@hexxa/db';
import { enviarGuiaAction, criarParcelamentoAction, excluirGuiaAction } from './actions';
import { categoriaDe, type GuiaCategoria } from '@/lib/guias';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CAT_CONFIG: Record<GuiaCategoria, string> = {
  DAS: 'DAS',
  DARF: 'DARF',
  ISS: 'ISS',
  PARCELAMENTO: 'Parcelamento',
  FGTS: 'FGTS',
  DIVERSA: 'Diversa',
};

const STATUS_CONFIG: Record<TaxGuideStatusValue, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  OPEN: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', icon: Clock },
  PAID: { label: 'Paga', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', icon: CheckCircle2 },
  OVERDUE: { label: 'Em atraso', cls: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300', icon: AlertTriangle },
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-colors';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] tracking-wide uppercase';

function EnviarGuiaForm({ companyId, onClose, onDone }: { companyId: string; onClose: () => void; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const tipo = String(fd.get('categoria') ?? '');
    const descricao = String(fd.get('descricao') ?? '').trim();
    const competencia = String(fd.get('competencia') ?? '').trim(); // MM/AAAA
    const dueDate = String(fd.get('vencimento') ?? '');
    const [mes, ano] = competencia.split('/');
    const referenceMonth = ano && mes ? `${ano}-${mes.padStart(2, '0')}-01` : dueDate;

    setSubmitting(true);
    setError(null);
    const res = await enviarGuiaAction(companyId, {
      taxName: `${CAT_CONFIG[tipo as GuiaCategoria] ?? tipo} — ${descricao}`,
      referenceMonth,
      dueDate,
      amount: Number(String(fd.get('valor') ?? '0').replace(',', '.')),
      pixCode: String(fd.get('pix') ?? '').trim() || null,
    });
    setSubmitting(false);
    if ('error' in res) {
      setError(res.error!);
      return;
    }
    onDone();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 p-6 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Enviar Guia pro Cliente</p>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>Tipo de Guia</label>
          <select name="categoria" className={`mt-1.5 ${field}`}>
            <option value="DAS">DAS — Simples Nacional</option>
            <option value="DARF">DARF — Federal</option>
            <option value="ISS">ISS — Municipal</option>
            <option value="FGTS">FGTS</option>
            <option value="DIVERSA">Guia Diversa</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Competência</label>
          <input name="competencia" required placeholder="MM/AAAA" pattern="\d{2}/\d{4}" className={`mt-1.5 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição</label>
          <input name="descricao" required placeholder="Ex.: Simples Nacional — Junho/2026" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Vencimento</label>
          <input name="vencimento" type="date" required className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Valor (R$)</label>
          <input name="valor" inputMode="decimal" required placeholder="0,00" className={`mt-1.5 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Código Pix (opcional)</label>
          <input name="pix" placeholder="Cole aqui o código Pix copia e cola da guia" className={`mt-1.5 ${field}`} />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] transition-all hover:scale-105 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enviar Guia
        </button>
        <button type="button" onClick={onClose} className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function NovoParcelamentoForm({ companyId, onClose, onDone }: { companyId: string; onClose: () => void; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    const res = await criarParcelamentoAction(companyId, {
      description: String(fd.get('descricao') ?? '').trim(),
      installmentCount: Number(fd.get('parcelas') ?? '0'),
      installmentAmount: Number(String(fd.get('valorParcela') ?? '0').replace(',', '.')),
      firstDueDate: String(fd.get('primeiroVencimento') ?? ''),
      pixCode: String(fd.get('pix') ?? '').trim() || null,
    });
    setSubmitting(false);
    if ('error' in res) {
      setError(res.error!);
      return;
    }
    onDone();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 p-6 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Cadastrar Novo Parcelamento</p>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Descrição do parcelamento</label>
          <input name="descricao" required placeholder="Ex.: Simples Nacional — débitos 2025" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Nº de parcelas</label>
          <input name="parcelas" type="number" min={2} required placeholder="12" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Valor de cada parcela (R$)</label>
          <input name="valorParcela" inputMode="decimal" required placeholder="0,00" className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Vencimento da 1ª parcela</label>
          <input name="primeiroVencimento" type="date" required className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className={lbl}>Código Pix (opcional, vale pra todas as parcelas)</label>
          <input name="pix" className={`mt-1.5 ${field}`} />
        </div>
      </div>
      <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
        As demais parcelas são geradas automaticamente, uma por mês, a partir do vencimento da 1ª.
      </p>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] transition-all hover:scale-105 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar Parcelamento
        </button>
        <button type="button" onClick={onClose} className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function HubGuiasAdmin({ companyId, initial }: { companyId: string; initial: TaxGuideRecord[] }) {
  const [guias, setGuias] = useState<TaxGuideRecord[]>(initial);
  const [showGuiaForm, setShowGuiaForm] = useState(false);
  const [showPlanoForm, setShowPlanoForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function refetch() {
    const res = await fetch(`/api/admin/guias?companyId=${companyId}`);
    if (res.ok) setGuias(await res.json());
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await excluirGuiaAction(companyId, id);
    setDeleting(null);
    if (!('error' in res)) setGuias((prev) => prev.filter((g) => g.id !== id));
  }

  const avulsas = guias.filter((g) => !g.installmentGroupId);
  const planos = new Map<string, TaxGuideRecord[]>();
  for (const g of guias) {
    if (!g.installmentGroupId) continue;
    const arr = planos.get(g.installmentGroupId) ?? [];
    arr.push(g);
    planos.set(g.installmentGroupId, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { setShowGuiaForm((v) => !v); setShowPlanoForm(false); }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
        >
          <Receipt className="h-4 w-4" /> Enviar Guia
        </button>
        <button
          type="button"
          onClick={() => { setShowPlanoForm((v) => !v); setShowGuiaForm(false); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2.5 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] hover:bg-black/5 transition-all"
        >
          <Layers className="h-4 w-4" /> Cadastrar Parcelamento
        </button>
      </div>

      {showGuiaForm && <EnviarGuiaForm companyId={companyId} onClose={() => setShowGuiaForm(false)} onDone={refetch} />}
      {showPlanoForm && <NovoParcelamentoForm companyId={companyId} onClose={() => setShowPlanoForm(false)} onDone={refetch} />}

      <div className="space-y-3">
        <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Guias Avulsas ({avulsas.length})</h3>
        {avulsas.length === 0 ? (
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] py-4">Nenhuma guia avulsa enviada ainda.</p>
        ) : (
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
            {avulsas.map((g) => {
              const st = STATUS_CONFIG[g.status];
              const StatusIcon = st.icon;
              return (
                <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${CAT_CONFIG[categoriaDe(g.taxName)] ? 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]' : ''}`}>
                    {CAT_CONFIG[categoriaDe(g.taxName)]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{g.taxName}</p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Vence {fmtDate(g.dueDate)} · {BRL.format(g.amount)}</p>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${st.cls}`}>
                    <StatusIcon className="h-3 w-3" /> {st.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(g.id)}
                    disabled={deleting === g.id}
                    title="Excluir"
                    className="rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleting === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Parcelamentos ({planos.size})</h3>
        {planos.size === 0 ? (
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] py-4">Nenhum parcelamento cadastrado ainda.</p>
        ) : (
          <div className="space-y-4">
            {[...planos.entries()].map(([groupId, parcelas]) => {
              const ordered = [...parcelas].sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0));
              const pagas = ordered.filter((p) => p.status === 'PAID').length;
              const total = ordered[0]?.installmentCount ?? ordered.length;
              const totalValor = ordered.reduce((s, p) => s + p.amount, 0);
              const desc = ordered[0]?.taxName.replace(/\s*\(\d+\/\d+\)$/, '') ?? 'Parcelamento';
              return (
                <div key={groupId} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-black/5 dark:border-white/10">
                    <div>
                      <p className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{desc}</p>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{pagas}/{total} parcelas pagas · total {BRL.format(totalValor)}</p>
                    </div>
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div className="h-full rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE]" style={{ width: `${(pagas / total) * 100}%` }} />
                    </div>
                  </div>
                  <div className="divide-y divide-black/5 dark:divide-white/10">
                    {ordered.map((p) => {
                      const st = STATUS_CONFIG[p.status];
                      const StatusIcon = st.icon;
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                          <span className="w-10 shrink-0 font-bold text-[#6E6A61] dark:text-[#A8A49C]">{p.installmentNumber}/{p.installmentCount}</span>
                          <span className="flex-1 text-[#6E6A61] dark:text-[#A8A49C]">Vence {fmtDate(p.dueDate)} · {BRL.format(p.amount)}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold ${st.cls}`}>
                            <StatusIcon className="h-3 w-3" /> {st.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting === p.id}
                            title="Excluir parcela"
                            className="rounded-full p-1.5 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {deleting === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
