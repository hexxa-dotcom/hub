'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  Users,
  Plus,
  X,
  Pencil,
  CheckCircle2,
  Coins,
  Send,
  Trash2,
  Loader2,
  TrendingUp,
  Info,
  Calendar,
  Landmark,
  Sparkles,
} from 'lucide-react';
import { LucroCard } from '../distribuicao-lucros/LucroCard';
import { DistForm } from '../distribuicao-lucros/DistForm';
import type { PartnerRow } from './actions';
import type { DistributionRow, YearlyProfitSummary, DistributionFrequency } from '../distribuicao-lucros/actions';
import { savePartnerAction, deletePartnerAction, lancarProLaboreMesAction } from './actions';
import { setDistributionFrequencyAction } from '../distribuicao-lucros/actions';

// ── Constants ─────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fi =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-colors';
const lb = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] tracking-wide uppercase';
const YEAR = new Date().getFullYear();

// ── Calcs (INSS/IRRF pró-labore, tabela vigente 2025) ───────────────────────────

function calcINSS(v: number) { return Math.min(v * 0.11, 856.47); }

function calcIRRF(base: number) {
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return Math.max(0, base * 0.075 - 169.44);
  if (base <= 3751.05) return Math.max(0, base * 0.15 - 381.44);
  if (base <= 4664.68) return Math.max(0, base * 0.225 - 662.77);
  return Math.max(0, base * 0.275 - 896.00);
}

function initials(n: string) {
  return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalSocio({
  socio, onSave, onClose, saving,
}: {
  socio: PartnerRow | null;
  onSave: (s: { id?: string; nome: string; cpf: string; participacao: number; prolabore: number }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState(socio?.nome ?? '');
  const [cpf, setCpf] = useState(socio?.cpf ?? '');
  const [part, setPart] = useState(String(socio?.participacao ?? ''));
  const [prol, setProl] = useState(String(socio?.prolabore ?? ''));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ id: socio?.id, nome, cpf, participacao: Number(part), prolabore: Number(prol.replace(',', '.')) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">
            {socio ? 'Editar Sócio' : 'Novo Sócio'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lb}>Nome Completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome do sócio" className={`mt-1.5 ${fi}`} />
          </div>
          <div>
            <label className={lb}>CPF</label>
            <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className={`mt-1.5 ${fi}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lb}>Participação (%)</label>
              <input value={part} onChange={e => setPart(e.target.value)} type="number" min="0" max="100" step="0.01" required placeholder="50" className={`mt-1.5 ${fi}`} />
            </div>
            <div>
              <label className={lb}>Pró-labore (R$)</label>
              <input value={prol} onChange={e => setProl(e.target.value)} inputMode="decimal" required placeholder="3000" className={`mt-1.5 ${fi}`} />
            </div>
          </div>
          <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">INSS (11%) e IRRF são calculados automaticamente conforme a tabela oficial.</p>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar Sócio'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/10 dark:border-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ProLaboreTab ──────────────────────────────────────────────────────────────

function ProLaboreTab({
  socios, prolaboreMinimoRecomendado, fatorRFavoravel,
}: {
  socios: PartnerRow[];
  prolaboreMinimoRecomendado: number;
  fatorRFavoravel: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const totalBruto = socios.reduce((s, x) => s + x.prolabore, 0);
  const totalINSS  = socios.reduce((s, x) => s + calcINSS(x.prolabore), 0);
  const totalIRRF  = socios.reduce((s, x) => s + calcIRRF(x.prolabore - calcINSS(x.prolabore)), 0);
  const totalLiq   = socios.reduce((s, x) => s + (x.prolabore - calcINSS(x.prolabore) - calcIRRF(x.prolabore - calcINSS(x.prolabore))), 0);

  function flashMsg(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 5000);
  }

  async function handleSave(data: { id?: string; nome: string; cpf: string; participacao: number; prolabore: number }) {
    setSaving(true);
    try {
      const result = await savePartnerAction(data);
      flashMsg(result.message);
      setModal({ open: false, editId: null });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const result = await deletePartnerAction(id);
      flashMsg(result.message);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleLancar(id: string) {
    setBusyId(id);
    try {
      const result = await lancarProLaboreMesAction(id);
      flashMsg(result.message);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const editingSocio = modal.editId ? (socios.find(s => s.id === modal.editId) ?? null) : null;
  const faltaParaFatorR = Math.max(0, prolaboreMinimoRecomendado - totalBruto);

  return (
    <>
      {flash && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
        </div>
      )}

      {/* Recomendação de pró-labore saudável (Fator R) */}
      <div className={`rounded-3xl border p-6 ${fatorRFavoravel ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        <div className="flex items-start gap-4">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${fatorRFavoravel ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
            <TrendingUp className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
              {fatorRFavoravel ? 'Pró-labore Atual Mantém Fator R Favorável' : 'Pró-labore Atual Abaixo do Recomendado'}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Para manter o Fator R ≥ 28% (Anexo III, menor alíquota), o pró-labore total recomendado é{' '}
              <strong className="text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(prolaboreMinimoRecomendado)}</strong>/mês. Hoje a soma é <strong className="text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(totalBruto)}</strong>/mês.
            </p>
            {!fatorRFavoravel && faltaParaFatorR > 0 && (
              <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                Faltam {BRL.format(faltaParaFatorR)}/mês em pró-labore para reenquadrar no Anexo III.
              </p>
            )}
            <p className="mt-2 flex items-start gap-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Otimize o equilíbrio entre Pró-labore (com encargos) e Distribuição de Lucros (isenta de IRPF).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Pró-labore Bruto', value: totalBruto, cls: 'text-[#231F20] dark:text-[#FEFDF3]' },
          { label: 'INSS (11%)', value: totalINSS, cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'IRRF', value: totalIRRF, cls: 'text-red-600 dark:text-red-400' },
          { label: 'Líquido Total', value: totalLiq, cls: 'text-emerald-700 dark:text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">{c.label}</p>
            <p className={`mt-2 font-serif font-bold text-xl sm:text-2xl ${c.cls}`}>{BRL.format(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Sócios Cadastrados</h2>
          <button
            type="button"
            onClick={() => setModal({ open: true, editId: null })}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
          >
            <Plus className="h-4 w-4" /> Novo Sócio
          </button>
        </div>

        {socios.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhum sócio cadastrado ainda.</p>
        )}

        {socios.map(s => {
          const i = calcINSS(s.prolabore);
          const r = calcIRRF(s.prolabore - i);
          const liq = s.prolabore - i - r;
          return (
            <div key={s.id} className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] text-sm font-bold">
                    {initials(s.nome)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{s.nome}</p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{s.participacao}% de participação{s.cpf ? ` · ${s.cpf}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, editId: s.id })}
                    className="rounded-full p-2 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    disabled={busyId === s.id}
                    className="rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLancar(s.id)}
                    disabled={busyId === s.id || s.prolabore <= 0}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-1.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:bg-[#EFFFD6] transition-colors disabled:opacity-50"
                  >
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar no Financeiro
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 text-xs">
                <div>
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Pró-labore</p>
                  <p className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mt-0.5">{BRL.format(s.prolabore)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">INSS (11%)</p>
                  <p className="font-bold text-sm text-amber-600 dark:text-amber-400 mt-0.5">− {BRL.format(i)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">IRRF</p>
                  <p className="font-bold text-sm text-red-600 dark:text-red-400 mt-0.5">− {BRL.format(r)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Líquido a Receber</p>
                  <p className="font-bold text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">{BRL.format(liq)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] px-1">
        INSS: 11% sobre o pró-labore (teto R$ 856,47). IRRF calculado sobre a base deduzida do INSS conforme tabela progressiva vigente.
      </p>

      {modal.open && (
        <ModalSocio
          socio={editingSocio}
          onSave={handleSave}
          onClose={() => setModal({ open: false, editId: null })}
          saving={saving}
        />
      )}
    </>
  );
}

// ── Lucro Acumulado do Ano + Periodicidade ──────────────────────────────────────

const FREQUENCIAS: { id: DistributionFrequency; label: string }[] = [
  { id: 'MENSAL', label: 'Mensal' },
  { id: 'TRIMESTRAL', label: 'Trimestral' },
  { id: 'SEMESTRAL', label: 'Semestral' },
  { id: 'ANUAL', label: 'Anual' },
];

function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function YearlyProfitBanner({ yearlyProfit }: { yearlyProfit: YearlyProfitSummary }) {
  const router = useRouter();
  const [frequency, setFrequency] = useState(yearlyProfit.frequency);
  const [saving, setSaving] = useState(false);

  async function handleFrequency(f: DistributionFrequency) {
    if (f === frequency) return;
    setFrequency(f);
    setSaving(true);
    try {
      await setDistributionFrequencyAction(f);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Lucro Acumulado em {yearlyProfit.year}</h2>
            <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">Faturamento líquido de despesas no ano corrente.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Lucro Líquido do Ano</p>
          <p className="mt-1 font-serif font-bold text-xl sm:text-2xl text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(yearlyProfit.netProfit)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Já Distribuído em {yearlyProfit.year}</p>
          <p className="mt-1 font-serif font-bold text-xl sm:text-2xl text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(yearlyProfit.distributedThisYear)}</p>
        </div>
        <div className="col-span-2 rounded-2xl bg-[#EFFFD6] dark:bg-[#2F4A3C]/40 border border-[#2F4A3C]/10 px-5 py-3 sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE]">Disponível para Distribuir</p>
          <p className="mt-0.5 font-serif font-bold text-2xl text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(yearlyProfit.availableToDistribute)}</p>
        </div>
      </div>

      <div className="border-t border-black/5 dark:border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Periodicidade de Distribuição</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              <Calendar className="h-3.5 w-3.5" /> Próxima sugerida: <strong className="text-[#231F20] dark:text-[#FEFDF3]">{fmtDateShort(yearlyProfit.nextSuggestedDate)}</strong>
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 p-1">
            {FREQUENCIAS.map(f => (
              <button
                key={f.id}
                type="button"
                disabled={saving}
                onClick={() => handleFrequency(f.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  frequency === f.id ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm' : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── DistribuicaoTab ───────────────────────────────────────────────────────────

function DistribuicaoTab({ distribuicoes, yearlyProfit }: { distribuicoes: DistributionRow[]; yearlyProfit: YearlyProfitSummary }) {
  const total = distribuicoes.reduce((s, d) => s + d.amount, 0);
  const partnersCount = new Set(distribuicoes.map(d => d.partnerName)).size;

  return (
    <>
      <YearlyProfitBanner yearlyProfit={yearlyProfit} />
      <LucroCard />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section className="rounded-3xl bg-[#1E3328] p-6 sm:p-8 text-[#FEFDF3] shadow-md">
          <div className="flex items-start justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]">Total Distribuído em {YEAR}</h3>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-[#DFFFAE]">
              <Coins className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 font-serif font-bold text-3xl sm:text-4xl text-[#FEFDF3]">{BRL.format(total)}</p>
          <p className="mt-1 text-xs text-[#DFFFAE]/80">{distribuicoes.length} lançamento(s) registrado(s)</p>
        </section>
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Sócios Contemplados</h3>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 font-serif font-bold text-3xl sm:text-4xl text-[#231F20] dark:text-[#FEFDF3]">{partnersCount}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">no histórico anual</p>
        </section>
      </div>

      <DistForm />

      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Histórico de Distribuições</h2>
        {distribuicoes.length === 0 ? (
          <p className="mt-4 text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhuma distribuição lançada ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] border-b border-black/5 dark:border-white/10">
                  <th className="pb-3">Data</th>
                  <th className="pb-3">Sócio</th>
                  <th className="hidden sm:table-cell pb-3">Observação</th>
                  <th className="text-right pb-3">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {distribuicoes.map(d => (
                  <tr key={d.id}>
                    <td className="py-3 font-medium whitespace-nowrap text-[#6E6A61] dark:text-[#A8A49C]">{fmtDate(d.distributedAt)}</td>
                    <td className="py-3 font-bold text-[#231F20] dark:text-[#FEFDF3]">{d.partnerName}</td>
                    <td className="hidden sm:table-cell py-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{d.notes ?? '—'}</td>
                    <td className="text-right py-3 font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/10 dark:border-white/10 font-bold">
                  <td className="pt-3" colSpan={3}>Total Geral</td>
                  <td className="text-right pt-3 font-serif text-base text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Lançamentos integrados ao fechamento contábil e à DIME/DEFIS automaticamente.
        </p>
      </section>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HubSocios({
  initialPartners, initialDistribuicoes, prolaboreMinimoRecomendado, fatorRFavoravel, yearlyProfit,
}: {
  initialPartners: PartnerRow[];
  initialDistribuicoes: DistributionRow[];
  prolaboreMinimoRecomendado: number;
  prolaboreAtualTotal: number;
  fatorRFavoravel: boolean;
  yearlyProfit: YearlyProfitSummary;
}) {
  const [tab, setTab] = useState<'prolabore' | 'distribuicao'>('prolabore');

  return (
    <div className="space-y-6">
      <div className="flex">
        <SegmentedTabs
          tabs={[
            { id: 'prolabore', label: 'Pró-labore', icon: Coins },
            { id: 'distribuicao', label: 'Distribuição de Lucros', icon: TrendingUp },
          ]}
          activeTab={tab}
          onChange={setTab}
          layoutId="sociosTabsIndicator"
        />
      </div>

      {tab === 'prolabore'
        ? <ProLaboreTab socios={initialPartners} prolaboreMinimoRecomendado={prolaboreMinimoRecomendado} fatorRFavoravel={fatorRFavoravel} />
        : <DistribuicaoTab distribuicoes={initialDistribuicoes} yearlyProfit={yearlyProfit} />}
    </div>
  );
}

