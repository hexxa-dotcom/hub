'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChartPie, Calculator, Package, Trash, Spinner } from '@phosphor-icons/react';
import type { PropertyRow } from './actions';
import type { PartnerRow } from '../minha-contabilidade/socios/actions';
import { createProperty, deleteProperty } from './actions';

const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const YEAR = new Date().getFullYear();

const TABS = [
  { id: 'patrimonio', label: 'Patrimônio Líquido', icon: ChartPie },
  { id: 'dividendos', label: 'Simulador de Dividendos', icon: Calculator },
  { id: 'ativos', label: 'Gestão de Ativos', icon: Package },
] as const;
type Tab = (typeof TABS)[number]['id'];

const TAXAS: Record<string, { rate: number; vida: number }> = {
  'Imóvel': { rate: 4, vida: 25 },
  'Máquina ou Equipamento': { rate: 10, vida: 10 },
  'Móveis e Utensílios': { rate: 10, vida: 10 },
  'Veículo': { rate: 20, vida: 5 },
  'Equipamento de Informática': { rate: 20, vida: 5 },
  'Outro': { rate: 10, vida: 10 },
};

function valorContabil(a: PropertyRow) {
  const anos = Math.max(0, YEAR - a.year);
  const deprAcum = Math.min(a.acq, (a.acq * a.rate * anos) / 100);
  return a.acq - deprAcum;
}

export function PatrimonioApp({
  initialProperties, partners, resumo,
}: {
  initialProperties: PropertyRow[];
  partners: PartnerRow[];
  resumo: { lucroExercicio: number; lucroAcumuladoNaoDistribuido: number };
}) {
  const [tab, setTab] = useState<Tab>('patrimonio');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-brand-500 text-white' : 'border border-line text-ink-soft hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'patrimonio' && <Patrimonio properties={initialProperties} partners={partners} />}
      {tab === 'dividendos' && <Dividendos partners={partners} resumo={resumo} />}
      {tab === 'ativos' && <Ativos properties={initialProperties} partners={partners} />}
    </div>
  );
}

// ============================================================
// 1) Patrimônio Líquido — PJ (empresa) + PF (sócios)
// ============================================================
function Patrimonio({ properties, partners }: { properties: PropertyRow[]; partners: PartnerRow[] }) {
  const ativosPJ = properties.filter((p) => p.ownerType === 'PJ');
  const ativosPF = properties.filter((p) => p.ownerType === 'PF');

  const totalPJ = ativosPJ.reduce((s, a) => s + valorContabil(a), 0);
  const totalPF = ativosPF.reduce((s, a) => s + valorContabil(a), 0);
  const total = totalPJ + totalPF;

  if (properties.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center">
        <p className="text-ink-soft font-medium">Nenhum bem cadastrado ainda.</p>
        <p className="text-ink-soft/70 text-sm mt-1">Cadastre os bens da empresa e dos sócios na aba "Gestão de Ativos" pra ver o patrimônio consolidado aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <section className="card-highlight rounded-card p-5 sm:col-span-1">
          <h3 className="text-sm font-medium text-white/85">Patrimônio consolidado</h3>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-white">{BRL0.format(total)}</p>
          <span className="mt-2 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">Empresa + sócios</span>
        </section>
        <section className="card-flat rounded-card p-5">
          <h3 className="text-sm font-medium text-ink-soft">Patrimônio da empresa (PJ)</h3>
          <p className="mt-3 text-[28px] font-semibold tracking-tight">{BRL0.format(totalPJ)}</p>
          <p className="mt-1 text-xs text-ink-soft">{ativosPJ.length} bem(ns) — valor contábil líquido</p>
        </section>
        <section className="card-flat rounded-card p-5">
          <h3 className="text-sm font-medium text-ink-soft">Patrimônio pessoal (PF)</h3>
          <p className="mt-3 text-[28px] font-semibold tracking-tight">{BRL0.format(totalPF)}</p>
          <p className="mt-1 text-xs text-ink-soft">{ativosPF.length} bem(ns) dos sócios</p>
        </section>
      </div>

      {ativosPJ.length > 0 && (
        <section className="card-flat rounded-card p-5">
          <h2 className="text-lg font-semibold">Composição do patrimônio da empresa</h2>
          <p className="text-sm text-ink-soft">Quanto cada bem contribui para o patrimônio PJ.</p>
          <ul className="mt-4 space-y-3">
            {ativosPJ.map((a) => {
              const vc = valorContabil(a);
              const p = totalPJ > 0 ? Math.round((vc / totalPJ) * 100) : 0;
              return (
                <li key={a.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{a.name}</span>
                    <span className="font-medium">
                      {BRL0.format(vc)} <span className="text-ink-soft">· {p}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${p}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {partners.length > 0 && (
        <section className="card-flat rounded-card p-5">
          <h2 className="text-lg font-semibold">Riqueza por sócio</h2>
          <p className="text-sm text-ink-soft">Participação no PJ (pela % de sócio) + bens pessoais (PF) cadastrados em nome dele.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {partners.map((s) => {
              const fatiaPJ = (totalPJ * s.participacao) / 100;
              const bensPF = ativosPF.filter((a) => a.partnerId === s.id).reduce((sum, a) => sum + valorContabil(a), 0);
              return (
                <li key={s.id} className="rounded-xl bg-surface p-4">
                  <p className="text-sm text-ink-soft">{s.nome} · {s.participacao}% do PJ</p>
                  <p className="mt-1 text-xl font-semibold">{BRL0.format(fatiaPJ + bensPF)}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {BRL0.format(fatiaPJ)} de participação + {BRL0.format(bensPF)} de bens pessoais
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ============================================================
// 2) Simulador de Dividendos — base real (lucro do exercício + acumulado)
// ============================================================
function Dividendos({ partners, resumo }: { partners: PartnerRow[]; resumo: { lucroExercicio: number; lucroAcumuladoNaoDistribuido: number } }) {
  const [lucro, setLucro] = useState(resumo.lucroExercicio);
  const [reservas, setReservas] = useState(resumo.lucroAcumuladoNaoDistribuido);
  const [reterPct, setReterPct] = useState(20);

  const calc = useMemo(() => {
    const reservaLegal = lucro * 0.05; // Lei 6.404/76, art. 193
    const reinvest = (lucro * reterPct) / 100;
    const doExercicio = Math.max(0, lucro - reservaLegal - reinvest);
    const max = doExercicio + reservas;
    return { reservaLegal, reinvest, doExercicio, max };
  }, [lucro, reservas, reterPct]);

  const fieldCls = 'mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="card-flat rounded-card p-5">
        <h2 className="text-lg font-semibold">Parâmetros</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Pré-preenchido com o lucro real do ano ({BRL.format(resumo.lucroExercicio)}) e o acumulado ainda não distribuído ({BRL.format(resumo.lucroAcumuladoNaoDistribuido)}). Ajuste se quiser simular outro cenário.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-soft">Lucro contábil do exercício</label>
            <input type="number" value={lucro} onChange={(e) => setLucro(Number(e.target.value))} className={fieldCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Reservas de lucros acumuladas (anos anteriores)</label>
            <input type="number" value={reservas} onChange={(e) => setReservas(Number(e.target.value))} className={fieldCls} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink-soft">Reter para reinvestimento / capital de giro</label>
              <span className="text-sm font-medium">{reterPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={reterPct}
              onChange={(e) => setReterPct(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-brand-500)]"
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-soft">
          Considera a reserva legal de 5% (Lei 6.404/76, art. 193). Dividendos são isentos de IR na pessoa física.
          Valores ilustrativos — confirme com a sua contabilidade.
        </p>
      </section>

      <section className="space-y-5">
        <div className="card-highlight rounded-card p-5">
          <h3 className="text-sm font-medium text-white/85">Pode distribuir até (sem descapitalizar)</h3>
          <p className="mt-2 text-[32px] font-semibold tracking-tight text-white">{BRL.format(calc.max)}</p>
        </div>

        <div className="card-flat rounded-card p-5 text-sm">
          <Row label="Lucro do exercício" value={BRL.format(lucro)} />
          <Row label="(–) Reserva legal (5%)" value={`- ${BRL.format(calc.reservaLegal)}`} />
          <Row label={`(–) Reinvestimento (${reterPct}%)`} value={`- ${BRL.format(calc.reinvest)}`} />
          <Row label="(+) Reservas acumuladas" value={`+ ${BRL.format(reservas)}`} />
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2 font-semibold">
            <span>Máximo distribuível</span>
            <span className="text-brand-600 dark:text-brand-300">{BRL.format(calc.max)}</span>
          </div>
        </div>

        <div className="card-flat rounded-card p-5">
          <h3 className="text-sm font-medium text-ink-soft">Distribuição por sócio</h3>
          {partners.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Cadastre os sócios em Minha Contabilidade → Sócios pra ver a divisão aqui.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {partners.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span>{s.nome} · {s.participacao}%</span>
                  <span className="font-medium">{BRL.format((calc.max * s.participacao) / 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ============================================================
// 3) Gestão de Ativos — PJ e PF, com depreciação + impostos
// ============================================================
function Ativos({ properties, partners }: { properties: PropertyRow[]; partners: PartnerRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tipo, setTipo] = useState('Imóvel');
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState(150000);
  const [ano, setAno] = useState(YEAR);
  const [ownerType, setOwnerType] = useState<'PJ' | 'PF'>('PJ');
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? '');

  const rows = properties.map((a) => {
    const anos = Math.max(0, YEAR - a.year);
    const deprAcum = Math.min(a.acq, (a.acq * a.rate * anos) / 100);
    const contabil = a.acq - deprAcum;
    const rentAnual = a.rent * 12;
    // Lucro Presumido: base presumida 32% sobre aluguel; IRPJ 15% + CSLL 9% = 24%.
    const imposto = rentAnual > 0 ? rentAnual * 0.32 * 0.24 : 0;
    return { ...a, anos, deprAcum, contabil, rentAnual, imposto };
  });
  const tot = rows.reduce(
    (s, r) => ({
      acq: s.acq + r.acq,
      depr: s.depr + r.deprAcum,
      contabil: s.contabil + r.contabil,
      imposto: s.imposto + r.imposto,
    }),
    { acq: 0, depr: 0, contabil: 0, imposto: 0 },
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const rate = TAXAS[tipo]?.rate || 10;
    try {
      await createProperty({
        name: nome,
        kind: tipo as any,
        acq: valor,
        rate,
        year: ano,
        ownerType,
        partnerId: ownerType === 'PF' ? partnerId : null,
      });
      setShowForm(false);
      setNome('');
      router.refresh();
    } catch (err) {
      alert('Erro ao criar ativo');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteProperty(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const fieldCls = 'mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Mini label="Valor de aquisição" value={BRL0.format(tot.acq)} />
        <Mini label="Depreciação acumulada" value={BRL0.format(tot.depr)} tone="warn" />
        <Mini label="Valor contábil líquido" value={BRL0.format(tot.contabil)} />
        <Mini label="IRPJ+CSLL s/ aluguéis (a.a.)" value={BRL0.format(tot.imposto)} tone="warn" />
      </div>

      <section className="card-flat overflow-x-auto rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Bens (empresa e sócios)</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            + Adicionar Bem
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-surface p-4 border border-line/50">
            <h3 className="text-sm font-semibold mb-3">Registrar Novo Bem</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-ink-soft">Nome / Descrição</label>
                <input required type="text" value={nome} onChange={e => setNome(e.target.value)} className={fieldCls} placeholder="Ex: Galpão Logístico" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Tipo de Bem (Define depreciação)</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className={fieldCls}>
                  {Object.keys(TAXAS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Valor de Aquisição (R$)</label>
                <input required type="number" min={0} value={valor} onChange={e => setValor(Number(e.target.value))} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Ano de Aquisição</label>
                <input required type="number" min={1900} max={YEAR} value={ano} onChange={e => setAno(Number(e.target.value))} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">De quem é o bem?</label>
                <select value={ownerType} onChange={e => setOwnerType(e.target.value as 'PJ' | 'PF')} className={fieldCls}>
                  <option value="PJ">Da empresa (PJ)</option>
                  <option value="PF">Pessoal de um sócio (PF)</option>
                </select>
              </div>
              {ownerType === 'PF' && (
                <div>
                  <label className="text-xs font-medium text-ink-soft">Sócio dono do bem</label>
                  {partners.length === 0 ? (
                    <p className="mt-1 text-xs text-warn">Cadastre um sócio em Minha Contabilidade → Sócios primeiro.</p>
                  ) : (
                    <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className={fieldCls}>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-soft">Taxa Legal Aplicada: {TAXAS[tipo]?.rate || 10}% a.a.</p>
              <button disabled={loading || (ownerType === 'PF' && !partnerId)} type="submit" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50">
                {loading ? 'Salvando...' : 'Salvar Bem'}
              </button>
            </div>
          </form>
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">Nenhum bem cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="py-2">Bem</th>
                <th>Tipo</th>
                <th>Dono</th>
                <th className="text-right">Aquisição</th>
                <th className="text-right">Depreciação</th>
                <th className="text-right">Valor contábil</th>
                <th className="text-right">Aluguel/mês</th>
                <th className="text-right">IRPJ+CSLL (a.a.)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2">{r.name}</td>
                  <td className="text-ink-soft">{r.kind}</td>
                  <td className="text-ink-soft">{r.ownerType === 'PJ' ? 'Empresa' : (r.partnerName ?? 'Sócio')}</td>
                  <td className="text-right">{BRL0.format(r.acq)}<br /><span className="text-xs text-ink-soft">{r.year}</span></td>
                  <td className="text-right text-warn">{BRL0.format(r.deprAcum)}<br /><span className="text-xs text-ink-soft">{r.rate}% a.a. · {r.anos} ano(s)</span></td>
                  <td className="text-right font-medium">{BRL0.format(r.contabil)}</td>
                  <td className="text-right">{r.rent ? BRL0.format(r.rent) : '—'}</td>
                  <td className="text-right">{r.imposto ? BRL0.format(r.imposto) : '—'}</td>
                  <td className="text-right">
                    <button type="button" onClick={() => handleDelete(r.id)} disabled={busyId === r.id} className="text-ink-soft hover:text-critical disabled:opacity-50">
                      {busyId === r.id ? <Spinner className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Depreciação linear pelas taxas usuais (IN SRF nº 162/1998 e IN RFB nº 1700/2017). Imposto estimado pelo Lucro Presumido (base 32% sobre aluguéis,
          IRPJ 15% + CSLL 9%); PIS/COFINS e adicional de IRPJ à parte. Ganho de capital na venda é calculado sobre
          (valor de venda – valor contábil). Estimativas — confirme com a contabilidade.
        </p>
      </section>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="card-flat rounded-card p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-tight ${tone === 'warn' ? 'text-warn' : ''}`}>{value}</p>
    </div>
  );
}
