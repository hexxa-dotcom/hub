'use client';

import { useMemo, useState } from 'react';
import { ChartPie, Calculator, Package, Bank } from '@phosphor-icons/react';

const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const YEAR = new Date().getFullYear();

// ---- dados de demonstração ----
const GRUPO = [
  { name: 'Hexxa Serviços Ltda', value: 1_850_000 },
  { name: 'Carteira de Imóveis', value: 4_200_000 },
  { name: 'Participação — XPTO Ltda (40%)', value: 980_000 },
  { name: 'Aplicações financeiras', value: 620_000 },
];
const SOCIOS = [
  { name: 'João Silva', pct: 60 },
  { name: 'Maria Souza', pct: 40 },
];
const ATIVOS = [
  { name: 'Sala Comercial – Centro', kind: 'Imóvel', acq: 1_200_000, year: 2019, rate: 4, rent: 7_500 },
  { name: 'Galpão Logístico', kind: 'Imóvel', acq: 2_500_000, year: 2021, rate: 4, rent: 18_000 },
  { name: 'Caminhão Volvo FH', kind: 'Veículo', acq: 480_000, year: 2022, rate: 20, rent: 0 },
  { name: 'Torno CNC', kind: 'Máquina', acq: 320_000, year: 2020, rate: 10, rent: 0 },
];

const TABS = [
  { id: 'patrimonio', label: 'Patrimônio Líquido', icon: ChartPie },
  { id: 'dividendos', label: 'Simulador de Dividendos', icon: Calculator },
  { id: 'ativos', label: 'Gestão de Ativos', icon: Package },
] as const;
type Tab = (typeof TABS)[number]['id'];

import { getProperties, createProperty } from './actions';

export default function Page() {
  const [tab, setTab] = useState<Tab>('patrimonio');
  const [ativos, setAtivos] = useState<any[]>(ATIVOS);

  import('react').then((React) => {
    React.useEffect(() => {
      getProperties().then(data => {
        if (data && data.length > 0) setAtivos(data);
      });
    }, []);
  });

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <Bank className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Gestão de Patrimônio</h1>
          <p className="text-sm text-ink-soft">Decisões com base em números — não em achismos.</p>
        </div>
      </header>

      {/* Abas internas */}
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

      {tab === 'patrimonio' && <Patrimonio ativos={ativos} />}
      {tab === 'dividendos' && <Dividendos />}
      {tab === 'ativos' && <Ativos ativos={ativos} />}
    </div>
  );
}

// ============================================================
// 1) Dashboard de Patrimônio Líquido
// ============================================================
function Patrimonio({ ativos }: { ativos: any[] }) {
  const total = GRUPO.reduce((s, g) => s + g.value, 0) + ativos.reduce((s, a) => s + (a.acq || 0), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <section className="card-highlight rounded-card p-5 sm:col-span-1">
          <h3 className="text-sm font-medium text-white/85">Patrimônio Líquido do grupo</h3>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-white">{BRL0.format(total)}</p>
          <span className="mt-2 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">▲ 8,4% no ano</span>
        </section>
        <section className="card-flat rounded-card p-5">
          <h3 className="text-sm font-medium text-ink-soft">Empresas e ativos</h3>
          <p className="mt-3 text-[28px] font-semibold tracking-tight">{GRUPO.length}</p>
          <p className="mt-1 text-xs text-ink-soft">consolidados no grupo</p>
        </section>
        <section className="card-flat rounded-card p-5">
          <h3 className="text-sm font-medium text-ink-soft">Sócios</h3>
          <p className="mt-3 text-[28px] font-semibold tracking-tight">{SOCIOS.length}</p>
          <p className="mt-1 text-xs text-ink-soft">com participação no grupo</p>
        </section>
      </div>

      <section className="card-flat rounded-card p-5">
        <h2 className="text-lg font-semibold">Composição do patrimônio</h2>
        <p className="text-sm text-ink-soft">Quanto cada empresa/ativo contribui para a riqueza do grupo.</p>
        <ul className="mt-4 space-y-3">
          {GRUPO.map((g) => {
            const pct = Math.round((g.value / total) * 100);
            return (
              <li key={g.name}>
                <div className="flex items-center justify-between text-sm">
                  <span>{g.name}</span>
                  <span className="font-medium">
                    {BRL0.format(g.value)} <span className="text-ink-soft">· {pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card-flat rounded-card p-5">
        <h2 className="text-lg font-semibold">Riqueza por sócio</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SOCIOS.map((s) => (
            <li key={s.name} className="rounded-xl bg-surface p-4">
              <p className="text-sm text-ink-soft">{s.name} · {s.pct}%</p>
              <p className="mt-1 text-xl font-semibold">{BRL0.format((total * s.pct) / 100)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ============================================================
// 2) Simulador de Dividendos
// ============================================================
function Dividendos() {
  const [lucro, setLucro] = useState(600_000);
  const [reservas, setReservas] = useState(250_000);
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
          <ul className="mt-2 space-y-1.5 text-sm">
            {SOCIOS.map((s) => (
              <li key={s.name} className="flex items-center justify-between">
                <span>{s.name} · {s.pct}%</span>
                <span className="font-medium">{BRL.format((calc.max * s.pct) / 100)}</span>
              </li>
            ))}
          </ul>
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
// 3) Gestão de Ativos (depreciação + impostos)
// ============================================================
function Ativos({ ativos }: { ativos: any[] }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState('Imóvel');
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState(150000);
  const [ano, setAno] = useState(YEAR);

  const taxas: Record<string, { rate: number; vida: number }> = {
    'Imóvel': { rate: 4, vida: 25 },
    'Máquina ou Equipamento': { rate: 10, vida: 10 },
    'Móveis e Utensílios': { rate: 10, vida: 10 },
    'Veículo': { rate: 20, vida: 5 },
    'Equipamento de Informática': { rate: 20, vida: 5 },
    'Outro': { rate: 10, vida: 10 },
  };

  const rows = ativos.map((a) => {
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
    const rate = taxas[tipo]?.rate || 10;
    const kindStr = (tipo === 'Imóvel' ? 'Imóvel' : tipo === 'Veículo' ? 'Veículo' : 'Outro') as 'Imóvel' | 'Veículo' | 'Outro';
    try {
      await createProperty({ name: nome, kind: kindStr, acq: valor, rate, year: ano });
      setShowForm(false);
      window.location.reload();
    } catch (err) {
      alert('Erro ao criar ativo');
    } finally {
      setLoading(false);
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
          <h2 className="text-lg font-semibold">Bens da holding</h2>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            + Adicionar Bem
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-surface p-4 border border-line/50">
            <h3 className="text-sm font-semibold mb-3">Registrar Novo Bem (Patrimônio)</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-ink-soft">Nome / Descrição</label>
                <input required type="text" value={nome} onChange={e => setNome(e.target.value)} className={fieldCls} placeholder="Ex: Galpão Logístico" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Tipo de Bem (Define depreciação)</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className={fieldCls}>
                  {Object.keys(taxas).map(k => <option key={k} value={k}>{k}</option>)}
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
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-soft">Taxa Legal Aplicada: {taxas[tipo]?.rate || 10}% a.a.</p>
              <button disabled={loading} type="submit" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-surface">
                {loading ? 'Salvando...' : 'Salvar Bem'}
              </button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2">Bem</th>
              <th>Tipo</th>
              <th className="text-right">Aquisição</th>
              <th className="text-right">Depreciação</th>
              <th className="text-right">Valor contábil</th>
              <th className="text-right">Aluguel/mês</th>
              <th className="text-right">IRPJ+CSLL (a.a.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-2">{r.name}</td>
                <td className="text-ink-soft">{r.kind}</td>
                <td className="text-right">{BRL0.format(r.acq)}<br /><span className="text-xs text-ink-soft">{r.year}</span></td>
                <td className="text-right text-warn">{BRL0.format(r.deprAcum)}<br /><span className="text-xs text-ink-soft">{r.rate}% a.a. · {r.anos} ano(s)</span></td>
                <td className="text-right font-medium">{BRL0.format(r.contabil)}</td>
                <td className="text-right">{r.rent ? BRL0.format(r.rent) : '—'}</td>
                <td className="text-right">{r.imposto ? BRL0.format(r.imposto) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-soft">
          Depreciação linear pelas taxas usuais. Imposto estimado pelo Lucro Presumido (base 32% sobre aluguéis,
          IRPJ 15% + CSLL 9%); PIS/COFINS e adicional de IRPJ à parte. Ganho de capital na venda é calculado sobre
          (valor de venda – valor contábil). Estimativas — confirme com a contabilidade.
        </p>
      </section>

      <CalculadoraDepreciacao />
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

function CalculadoraDepreciacao() {
  const [tipo, setTipo] = useState('Veículo');
  const [valor, setValor] = useState(150000);
  const [ano, setAno] = useState(new Date().getFullYear());

  const taxas: Record<string, { rate: number; vida: number }> = {
    'Imóvel': { rate: 4, vida: 25 },
    'Máquina ou Equipamento': { rate: 10, vida: 10 },
    'Móveis e Utensílios': { rate: 10, vida: 10 },
    'Veículo': { rate: 20, vida: 5 },
    'Equipamento de Informática': { rate: 20, vida: 5 },
  };

  const current = (taxas as any)[tipo] || taxas['Veículo'];
  const anosUso = Math.max(0, YEAR - ano);
  const deprAcum = Math.min(valor, (valor * current.rate * anosUso) / 100);
  const contabil = valor - deprAcum;
  const deprAnual = valor * (current.rate / 100);
  const deprMensal = deprAnual / 12;

  const fieldCls = 'mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm';

  return (
    <section className="card-flat rounded-card p-5 mt-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-brand-600" />
        <h2 className="text-lg font-semibold">Cálculo de Depreciação Automático</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-soft">Tipo de Bem (Define a taxa legal)</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={fieldCls}>
              {Object.keys(taxas).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Valor de Aquisição (R$)</label>
            <input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className={fieldCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Ano de Aquisição</label>
            <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))} className={fieldCls} />
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-xl p-4 border border-line/50">
            <p className="text-xs text-ink-soft">Taxa Legal / Vida Útil</p>
            <p className="text-lg font-semibold mt-1">{current.rate}% a.a. <span className="text-sm font-normal text-ink-soft">({current.vida} anos)</span></p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-line/50">
            <p className="text-xs text-ink-soft">Depreciação Mensal (Quota)</p>
            <p className="text-lg font-semibold mt-1 text-warn">{BRL.format(deprMensal)}</p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-line/50">
            <p className="text-xs text-ink-soft">Depreciação Acumulada ({anosUso} anos)</p>
            <p className="text-lg font-semibold mt-1 text-critical">{BRL.format(deprAcum)}</p>
          </div>
          <div className="bg-brand-50 rounded-xl p-4 border border-brand-100 dark:bg-brand-900/20 dark:border-brand-800">
            <p className="text-xs text-brand-700 dark:text-brand-300 font-medium">Valor Contábil Líquido Atual</p>
            <p className="text-2xl font-bold mt-1 text-brand-900 dark:text-brand-100">{BRL.format(contabil)}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-soft mt-5 pt-3 border-t border-line">
        As taxas utilizadas seguem a Instrução Normativa SRF nº 162/1998 e IN RFB nº 1700/2017 para depreciação linear. 
        Este é um cálculo gerencial automático. Para a contabilidade oficial de IRPJ/CSLL, fale com nossos especialistas.
      </p>
    </section>
  );
}
