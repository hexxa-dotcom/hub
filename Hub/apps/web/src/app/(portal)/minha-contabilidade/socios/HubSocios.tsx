'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, X, PencilSimple, CheckCircle, HandCoins, PaperPlaneRight, Trash, Spinner, TrendUp, Info } from '@phosphor-icons/react';
import { LucroCard } from '../distribuicao-lucros/LucroCard';
import { DistForm } from '../distribuicao-lucros/DistForm';
import type { PartnerRow } from './actions';
import type { DistributionRow } from '../distribuicao-lucros/actions';
import { savePartnerAction, deletePartnerAction, lancarProLaboreMesAction } from './actions';

// ── Constants ─────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fi = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lb = 'text-xs font-medium text-ink-soft';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{socio ? 'Editar sócio' : 'Adicionar sócio'}</h2>
          <button type="button" onClick={onClose}
            className="rounded-xl p-1 text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={lb}>Nome completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome do sócio" className={`mt-1 ${fi}`} />
          </div>
          <div>
            <label className={lb}>CPF</label>
            <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className={`mt-1 ${fi}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lb}>Participação (%)</label>
              <input value={part} onChange={e => setPart(e.target.value)} type="number" min="0" max="100" step="0.01" required placeholder="50" className={`mt-1 ${fi}`} />
            </div>
            <div>
              <label className={lb}>Pró-labore (R$)</label>
              <input value={prol} onChange={e => setProl(e.target.value)} inputMode="decimal" required placeholder="3000" className={`mt-1 ${fi}`} />
            </div>
          </div>
          <p className="text-xs text-ink-soft">INSS (11%) e IRRF são calculados automaticamente.</p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2 text-sm font-medium hover:bg-surface-hover transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
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
        <div className="flex items-center gap-2 rounded-xl bg-ok/10 border border-ok/30 p-3 text-sm text-ok font-medium">
          <CheckCircle className="h-4 w-4 shrink-0" /> {flash}
        </div>
      )}

      {/* Recomendação de pró-labore saudável (Fator R) */}
      <div className={`rounded-2xl border p-5 ${fatorRFavoravel ? 'border-ok/30 bg-ok/5' : 'border-warn/30 bg-warn/5'}`}>
        <div className="flex items-start gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${fatorRFavoravel ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>
            <TrendUp className="h-[18px] w-[18px]" />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-ink">
              {fatorRFavoravel ? 'Pró-labore atual mantém o Fator R favorável' : 'Pró-labore atual está abaixo do recomendado'}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Para manter o Fator R ≥ 28% (Anexo III, alíquota menor) com o faturamento dos últimos 12 meses, o pró-labore total mensal recomendado é{' '}
              <strong className="text-ink">{BRL.format(prolaboreMinimoRecomendado)}</strong>. Hoje vocês somam <strong className="text-ink">{BRL.format(totalBruto)}</strong>/mês.
            </p>
            {!fatorRFavoravel && faltaParaFatorR > 0 && (
              <p className="mt-1 text-xs font-medium text-warn">
                Faltam {BRL.format(faltaParaFatorR)}/mês em pró-labore pra voltar ao Anexo III.
              </p>
            )}
            <p className="mt-2 flex items-start gap-1 text-[11px] text-ink-soft">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              Aumentar pró-labore reduz o imposto sobre o faturamento (Simples) mas aumenta INSS/IRRF pessoal — o ideal é balancear com a distribuição de lucro isenta.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pró-labore bruto', value: totalBruto, cls: '' },
          { label: 'INSS (11%)', value: totalINSS, cls: 'text-warn' },
          { label: 'IRRF', value: totalIRRF, cls: 'text-critical' },
          { label: 'Líquido total', value: totalLiq, cls: 'text-ok' },
        ].map(c => (
          <div key={c.label} className="card-flat rounded-card p-4">
            <p className="text-xs text-ink-soft">{c.label}</p>
            <p className={`mt-1.5 text-lg font-semibold ${c.cls}`}>{BRL.format(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="card-flat rounded-card divide-y divide-line overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold">Sócios cadastrados</h2>
          <button type="button" onClick={() => setModal({ open: true, editId: null })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>

        {socios.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-soft">Nenhum sócio cadastrado.</p>
        )}

        {socios.map(s => {
          const i = calcINSS(s.prolabore);
          const r = calcIRRF(s.prolabore - i);
          const liq = s.prolabore - i - r;
          return (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-sm font-semibold">
                    {initials(s.nome)}
                  </div>
                  <div>
                    <p className="font-medium leading-snug">{s.nome}</p>
                    <p className="text-xs text-ink-soft">{s.participacao}% participação{s.cpf ? ` · ${s.cpf}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setModal({ open: true, editId: s.id })}
                    className="rounded-xl p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors">
                    <PencilSimple className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(s.id)} disabled={busyId === s.id}
                    className="rounded-xl p-1.5 text-ink-soft hover:bg-critical/10 hover:text-critical transition-colors disabled:opacity-50">
                    <Trash className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleLancar(s.id)} disabled={busyId === s.id || s.prolabore <= 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-surface-hover px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-50">
                    {busyId === s.id ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <PaperPlaneRight className="h-3.5 w-3.5" />} Lançar no Financeiro
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 rounded-xl bg-surface-hover p-3 text-sm">
                <div>
                  <p className="text-xs text-ink-soft">Pró-labore</p>
                  <p className="font-medium">{BRL.format(s.prolabore)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft">INSS (11%)</p>
                  <p className="font-medium text-warn">− {BRL.format(i)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft">IRRF</p>
                  <p className="font-medium text-critical">− {BRL.format(r)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft">Líquido a receber</p>
                  <p className="font-semibold text-ok">{BRL.format(liq)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-soft px-1">
        INSS: 11% sobre o pró-labore, teto R$ 856,47 (2025). IRRF calculado sobre a base líquida de INSS, conforme tabela progressiva mensal 2025.
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

// ── DistribuicaoTab ───────────────────────────────────────────────────────────

function DistribuicaoTab({ distribuicoes }: { distribuicoes: DistributionRow[] }) {
  const total = distribuicoes.reduce((s, d) => s + d.amount, 0);
  const partnersCount = new Set(distribuicoes.map(d => d.partnerName)).size;

  return (
    <>
      <LucroCard />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <section className="card-highlight rounded-card p-5">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium text-white/85">Total distribuído em {YEAR}</h3>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-white">
              <HandCoins className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-white">{BRL.format(total)}</p>
          <p className="mt-1 text-xs text-white/70">{distribuicoes.length} lançamento(s)</p>
        </section>
        <section className="card-flat rounded-card p-5">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium text-ink-soft">Sócios contemplados</h3>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Users className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-semibold tracking-tight">{partnersCount}</p>
          <p className="mt-1 text-xs text-ink-soft">no histórico</p>
        </section>
      </div>

      <DistForm />

      <section className="card-flat rounded-card p-5">
        <h2 className="text-lg font-semibold">Histórico de distribuições</h2>
        {distribuicoes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Nenhuma distribuição lançada ainda.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="py-2">Data</th>
                <th>Sócio</th>
                <th className="hidden sm:table-cell">Observação</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {distribuicoes.map(d => (
                <tr key={d.id} className="border-t border-line">
                  <td className="py-2 whitespace-nowrap">{fmtDate(d.distributedAt)}</td>
                  <td>{d.partnerName}</td>
                  <td className="hidden sm:table-cell text-ink-soft">{d.notes ?? '—'}</td>
                  <td className="text-right font-medium">{BRL.format(d.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <td className="py-2" colSpan={3}>Total</td>
                <td className="text-right text-brand-600 dark:text-brand-300">{BRL.format(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Os lançamentos ficam disponíveis para a sua contabilidade automaticamente.
        </p>
      </section>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HubSocios({
  initialPartners, initialDistribuicoes, prolaboreMinimoRecomendado, fatorRFavoravel,
}: {
  initialPartners: PartnerRow[];
  initialDistribuicoes: DistributionRow[];
  prolaboreMinimoRecomendado: number;
  prolaboreAtualTotal: number;
  fatorRFavoravel: boolean;
}) {
  const [tab, setTab] = useState<'prolabore' | 'distribuicao'>('prolabore');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 w-fit">
        {([
          { id: 'prolabore' as const, label: 'Pró-labore' },
          { id: 'distribuicao' as const, label: 'Distribuição de Lucros' },
        ] as const).map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-surface-card shadow-sm text-ink'
                : 'text-ink-soft hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'prolabore'
        ? <ProLaboreTab socios={initialPartners} prolaboreMinimoRecomendado={prolaboreMinimoRecomendado} fatorRFavoravel={fatorRFavoravel} />
        : <DistribuicaoTab distribuicoes={initialDistribuicoes} />}
    </div>
  );
}
