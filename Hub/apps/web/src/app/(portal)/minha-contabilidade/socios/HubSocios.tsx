'use client';

import { useState } from 'react';
import {
  Users2, Plus, X, Edit2, CheckCircle2, HandCoins, Send,
} from 'lucide-react';
import { LucroCard } from '../distribuicao-lucros/LucroCard';
import { DistForm } from '../distribuicao-lucros/DistForm';

// ── Types ─────────────────────────────────────────────────────────────────────

type Socio = {
  id: string;
  nome: string;
  cpf: string;
  participacao: number;
  prolabore: number;
  lancado: boolean;
};

type Distribuicao = {
  id: string;
  socio: string;
  valor: number;
  data: string;
  obs: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fi = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lb = 'text-xs font-medium text-ink-soft';
const YEAR = new Date().getFullYear();

// ── Calcs ─────────────────────────────────────────────────────────────────────

function calcINSS(v: number) { return Math.min(v * 0.11, 856.47); }

function calcIRRF(base: number) {
  // Tabela progressiva mensal 2025 (sem dedução por dependentes)
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return Math.max(0, base * 0.075 - 169.44);
  if (base <= 3751.05) return Math.max(0, base * 0.15 - 381.44);
  if (base <= 4664.68) return Math.max(0, base * 0.225 - 662.77);
  return Math.max(0, base * 0.275 - 896.00);
}

function calcLiquido(s: Pick<Socio, 'prolabore'>) {
  const i = calcINSS(s.prolabore);
  return s.prolabore - i - calcIRRF(s.prolabore - i);
}

// ── Helpers / Seed ────────────────────────────────────────────────────────────

function initSocios(): Socio[] {
  return [
    { id: '1', nome: 'Carlos Mendes', cpf: '***.***.***.01', participacao: 60, prolabore: 5000, lancado: false },
    { id: '2', nome: 'Ana Beatriz Lima', cpf: '***.***.***.02', participacao: 40, prolabore: 3500, lancado: false },
  ];
}

const SEED_DISTS: Distribuicao[] = [
  { id: '1', socio: 'Carlos Mendes', valor: 8000, data: `${YEAR}-05-01`, obs: 'Distribuição mensal' },
  { id: '2', socio: 'Ana Beatriz Lima', valor: 5333, data: `${YEAR}-05-01`, obs: 'Distribuição mensal' },
  { id: '3', socio: 'Carlos Mendes', valor: 8000, data: `${YEAR}-04-01`, obs: null },
  { id: '4', socio: 'Ana Beatriz Lima', valor: 5333, data: `${YEAR}-04-01`, obs: null },
];

function initials(n: string) {
  return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalSocio({
  socio, onSave, onClose,
}: {
  socio: Socio | null;
  onSave: (s: Omit<Socio, 'id' | 'lancado'>) => void;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(socio?.nome ?? '');
  const [cpf, setCpf] = useState(socio?.cpf ?? '');
  const [part, setPart] = useState(String(socio?.participacao ?? ''));
  const [prol, setProl] = useState(String(socio?.prolabore ?? ''));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ nome, cpf, participacao: Number(part), prolabore: Number(prol.replace(',', '.')) });
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
            <button type="submit"
              className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ProLaboreTab ──────────────────────────────────────────────────────────────

function ProLaboreTab() {
  const [socios, setSocios] = useState<Socio[]>(initSocios);
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });

  const totalBruto = socios.reduce((s, x) => s + x.prolabore, 0);
  const totalINSS  = socios.reduce((s, x) => s + calcINSS(x.prolabore), 0);
  const totalIRRF  = socios.reduce((s, x) => s + calcIRRF(x.prolabore - calcINSS(x.prolabore)), 0);
  const totalLiq   = socios.reduce((s, x) => s + calcLiquido(x), 0);

  function handleSave(data: Omit<Socio, 'id' | 'lancado'>) {
    if (modal.editId) {
      setSocios(prev => prev.map(s => s.id === modal.editId ? { ...s, ...data, lancado: false } : s));
    } else {
      setSocios(prev => [...prev, { ...data, id: Date.now().toString(), lancado: false }]);
    }
    setModal({ open: false, editId: null });
  }

  function toggleLancado(id: string) {
    setSocios(prev => prev.map(s => s.id === id ? { ...s, lancado: !s.lancado } : s));
  }

  const editingSocio = modal.editId ? (socios.find(s => s.id === modal.editId) ?? null) : null;

  return (
    <>
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
                    <p className="text-xs text-ink-soft">{s.participacao}% participação · {s.cpf}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setModal({ open: true, editId: s.id })}
                    className="rounded-xl p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => toggleLancado(s.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                      s.lancado
                        ? 'bg-ok/10 text-ok cursor-default'
                        : 'bg-surface-hover text-ink-soft hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400'
                    }`}>
                    {s.lancado
                      ? <><CheckCircle2 className="h-3.5 w-3.5" /> Lançado</>
                      : <><Send className="h-3.5 w-3.5" /> Lançar no Financeiro</>}
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
        />
      )}
    </>
  );
}

// ── DistribuicaoTab ───────────────────────────────────────────────────────────

function DistribuicaoTab() {
  const total = SEED_DISTS.reduce((s, d) => s + d.valor, 0);
  const partners = new Set(SEED_DISTS.map(d => d.socio)).size;

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
          <p className="mt-1 text-xs text-white/70">{SEED_DISTS.length} lançamento(s)</p>
        </section>
        <section className="card-flat rounded-card p-5">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium text-ink-soft">Sócios contemplados</h3>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Users2 className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-semibold tracking-tight">{partners}</p>
          <p className="mt-1 text-xs text-ink-soft">no histórico</p>
        </section>
      </div>

      <DistForm />

      <section className="card-flat rounded-card p-5">
        <h2 className="text-lg font-semibold">Histórico de distribuições</h2>
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
            {SEED_DISTS.map(d => (
              <tr key={d.id} className="border-t border-line">
                <td className="py-2 whitespace-nowrap">{fmtDate(d.data)}</td>
                <td>{d.socio}</td>
                <td className="hidden sm:table-cell text-ink-soft">{d.obs ?? '—'}</td>
                <td className="text-right font-medium">{BRL.format(d.valor)}</td>
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
        <p className="mt-3 text-xs text-ink-soft">
          Os lançamentos ficam disponíveis para a sua contabilidade automaticamente.
        </p>
      </section>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HubSocios() {
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

      {tab === 'prolabore' ? <ProLaboreTab /> : <DistribuicaoTab />}
    </div>
  );
}
