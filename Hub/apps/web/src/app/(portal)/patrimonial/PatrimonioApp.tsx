'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { PieChart, Calculator, Package, Trash2, Loader2, Plus, Sparkles } from 'lucide-react';
import type { PropertyRow } from './actions';
import type { PartnerRow } from '../minha-contabilidade/socios/actions';
import { createProperty, deleteProperty } from './actions';

const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const YEAR = new Date().getFullYear();

const TABS = [
  { id: 'patrimonio', label: 'Patrimônio Líquido', icon: PieChart },
  { id: 'dividendos', label: 'Simulador de Dividendos', icon: Calculator },
  { id: 'ativos', label: 'Gestão de Ativos & Depreciação', icon: Package },
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
      <div className="flex">
        <SegmentedTabs
          tabs={TABS}
          activeTab={tab}
          onChange={setTab}
          layoutId="patrimonioTabsIndicator"
        />
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
      <div className="rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-12 text-center">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nenhum bem cadastrado ainda.</p>
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">Cadastre os bens da empresa e dos sócios na aba "Gestão de Ativos" para ver o patrimônio consolidado aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <section className="rounded-3xl border border-black/5 bg-[#1E3328] dark:bg-[#1A201C] p-6 text-[#FEFDF3] shadow-md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]">Patrimônio Consolidado</h3>
          <p className="mt-2 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#DFFFAE]">{BRL0.format(total)}</p>
          <span className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-[#DFFFAE]">Empresa + Sócios</span>
        </section>
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Patrimônio da Empresa (PJ)</h3>
          <p className="mt-2 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">{BRL0.format(totalPJ)}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{ativosPJ.length} bem(ns) — valor contábil líquido</p>
        </section>
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Patrimônio Pessoal (PF)</h3>
          <p className="mt-2 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">{BRL0.format(totalPF)}</p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{ativosPF.length} bem(ns) dos sócios</p>
        </section>
      </div>

      {ativosPJ.length > 0 && (
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Composição do Patrimônio da Empresa</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Participação proporcional de cada bem no ativo imobilizado líquido da empresa.</p>
          <ul className="mt-4 space-y-3">
            {ativosPJ.map((a) => {
              const vc = valorContabil(a);
              const p = totalPJ > 0 ? Math.round((vc / totalPJ) * 100) : 0;
              return (
                <li key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{a.name}</span>
                    <span className="font-semibold text-[#2F4A3C] dark:text-[#DFFFAE]">
                      {BRL0.format(vc)} <span className="text-[#6E6A61] dark:text-[#A8A49C] font-normal">· {p}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-[#1E3328] dark:bg-[#DFFFAE]" style={{ width: `${p}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {partners.length > 0 && (
        <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Riqueza por Sócio</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Participação societária no PJ (pelo % do contrato social) + bens pessoais (PF) cadastrados.</p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {partners.map((s) => {
              const fatiaPJ = (totalPJ * s.participacao) / 100;
              const bensPF = ativosPF.filter((a) => a.partnerId === s.id).reduce((sum, a) => sum + valorContabil(a), 0);
              return (
                <li key={s.id} className="rounded-2xl bg-white/80 dark:bg-[#121614] border border-black/5 dark:border-white/10 p-5 shadow-sm space-y-1">
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">{s.nome} · {s.participacao}% do PJ</p>
                  <p className="font-serif text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL0.format(fatiaPJ + bensPF)}</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                    {BRL0.format(fatiaPJ)} de quota societária + {BRL0.format(bensPF)} de bens pessoais
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

  const fieldCls =
    'mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-in fade-in">
      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Parâmetros de Simulação</h2>
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Pré-preenchido com o lucro real do ano ({BRL.format(resumo.lucroExercicio)}) e o acumulado ainda não distribuído ({BRL.format(resumo.lucroAcumuladoNaoDistribuido)}).
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Lucro Contábil do Exercício</label>
            <input type="number" value={lucro} onChange={(e) => setLucro(Number(e.target.value))} className={fieldCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Reservas de Lucros Acumuladas (Anos Anteriores)</label>
            <input type="number" value={reservas} onChange={(e) => setReservas(Number(e.target.value))} className={fieldCls} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Reter para Reinvestimento / Giro</label>
              <span className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{reterPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={reterPct}
              onChange={(e) => setReterPct(Number(e.target.value))}
              className="mt-2 w-full accent-[#1E3328] dark:accent-[#DFFFAE]"
            />
          </div>
        </div>
        <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] pt-2">
          Considera a reserva legal de 5% (Lei 6.404/76, art. 193). Dividendos são isentos de IR na pessoa física.
        </p>
      </section>

      <section className="space-y-4">
        <div className="rounded-3xl border border-black/5 bg-[#1E3328] dark:bg-[#1A201C] p-6 text-[#FEFDF3] shadow-md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]">Máximo Distribuível (Sem Descapitalizar)</h3>
          <p className="mt-2 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#DFFFAE]">{BRL.format(calc.max)}</p>
        </div>

        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 text-sm shadow-sm space-y-1">
          <Row label="Lucro do exercício" value={BRL.format(lucro)} />
          <Row label="(–) Reserva legal (5%)" value={`- ${BRL.format(calc.reservaLegal)}`} />
          <Row label={`(–) Reinvestimento (${reterPct}%)`} value={`- ${BRL.format(calc.reinvest)}`} />
          <Row label="(+) Reservas acumuladas" value={`+ ${BRL.format(reservas)}`} />
          <div className="mt-2 flex items-center justify-between border-t border-black/5 dark:border-white/10 pt-3 font-bold">
            <span className="text-[#231F20] dark:text-[#FEFDF3]">Máximo Distribuível</span>
            <span className="font-serif text-lg text-emerald-700 dark:text-emerald-400">{BRL.format(calc.max)}</span>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Distribuição por Sócio</h3>
          {partners.length === 0 ? (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Cadastre os sócios em Minha Contabilidade → Sócios para ver a divisão aqui.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {partners.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1 border-b border-black/5 dark:border-white/10 last:border-0">
                  <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{s.nome} · <span className="font-normal text-xs text-[#6E6A61] dark:text-[#A8A49C]">{s.participacao}%</span></span>
                  <span className="font-serif font-bold text-emerald-700 dark:text-emerald-400">{BRL.format((calc.max * s.participacao) / 100)}</span>
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
    <div className="flex items-center justify-between py-1 text-xs sm:text-sm">
      <span className="text-[#6E6A61] dark:text-[#A8A49C]">{label}</span>
      <span className="font-semibold text-[#231F20] dark:text-[#FEFDF3]">{value}</span>
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
    } catch {
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

  const fieldCls =
    'mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]';

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Mini label="Valor de Aquisição" value={BRL0.format(tot.acq)} />
        <Mini label="Depreciação Acumulada" value={BRL0.format(tot.depr)} tone="warn" />
        <Mini label="Valor Contábil Líquido" value={BRL0.format(tot.contabil)} />
        <Mini label="IRPJ+CSLL s/ Aluguéis (a.a.)" value={BRL0.format(tot.imposto)} tone="warn" />
      </div>

      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Bens Imobilizados (Empresa e Sócios)</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
          >
            <Plus className="h-4 w-4" /> Adicionar Bem
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-6 space-y-4 shadow-sm">
            <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Registrar Novo Bem / Ativo</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Nome / Descrição</label>
                <input required type="text" value={nome} onChange={e => setNome(e.target.value)} className={fieldCls} placeholder="Ex: Galpão Logístico" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Tipo de Bem</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className={fieldCls}>
                  {Object.keys(TAXAS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Valor de Aquisição (R$)</label>
                <input required type="number" min={0} value={valor} onChange={e => setValor(Number(e.target.value))} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Ano de Aquisição</label>
                <input required type="number" min={1900} max={YEAR} value={ano} onChange={e => setAno(Number(e.target.value))} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Titularidade</label>
                <select value={ownerType} onChange={e => setOwnerType(e.target.value as 'PJ' | 'PF')} className={fieldCls}>
                  <option value="PJ">Da empresa (PJ)</option>
                  <option value="PF">Pessoal de um sócio (PF)</option>
                </select>
              </div>
              {ownerType === 'PF' && (
                <div>
                  <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Sócio Proprietário</label>
                  {partners.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">Cadastre um sócio em Minha Contabilidade → Sócios primeiro.</p>
                  ) : (
                    <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className={fieldCls}>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Taxa legal aplicada: <strong>{TAXAS[tipo]?.rate || 10}% a.a.</strong></p>
              <button disabled={loading || (ownerType === 'PF' && !partnerId)} type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {loading ? 'Salvando...' : 'Salvar Bem'}
              </button>
            </div>
          </form>
        )}

        {rows.length === 0 ? (
          <p className="py-12 text-center text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhum bem cadastrado ainda.</p>
        ) : (
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-left text-[#6E6A61] dark:text-[#A8A49C] border-b border-black/5 dark:border-white/10 pb-2">
                <th className="py-2.5">Bem</th>
                <th>Tipo</th>
                <th>Dono</th>
                <th className="text-right">Aquisição</th>
                <th className="text-right">Depreciação</th>
                <th className="text-right">Valor Contábil</th>
                <th className="text-right">Aluguel/mês</th>
                <th className="text-right">IRPJ+CSLL (a.a.)</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 font-bold text-[#231F20] dark:text-[#FEFDF3]">{r.name}</td>
                  <td className="text-[#6E6A61] dark:text-[#A8A49C]">{r.kind}</td>
                  <td className="text-[#6E6A61] dark:text-[#A8A49C]">{r.ownerType === 'PJ' ? 'Empresa' : (r.partnerName ?? 'Sócio')}</td>
                  <td className="text-right font-semibold">{BRL0.format(r.acq)}<br /><span className="text-[11px] font-normal text-[#6E6A61] dark:text-[#A8A49C]">{r.year}</span></td>
                  <td className="text-right text-amber-700 dark:text-amber-400 font-semibold">{BRL0.format(r.deprAcum)}<br /><span className="text-[11px] font-normal text-[#6E6A61] dark:text-[#A8A49C]">{r.rate}% a.a. · {r.anos} ano(s)</span></td>
                  <td className="text-right font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL0.format(r.contabil)}</td>
                  <td className="text-right">{r.rent ? BRL0.format(r.rent) : '—'}</td>
                  <td className="text-right">{r.imposto ? BRL0.format(r.imposto) : '—'}</td>
                  <td className="text-right">
                    <button type="button" onClick={() => handleDelete(r.id)} disabled={busyId === r.id} className="rounded-full p-2 text-[#6E6A61] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50">
                      {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-[11px] text-[#6E6A61] dark:text-[#A8A49C] pt-2 border-t border-black/5 dark:border-white/10">
          Depreciação linear pelas taxas usuais (IN SRF nº 162/1998 e IN RFB nº 1700/2017). Imposto estimado pelo Lucro Presumido (base 32% sobre aluguéis,
          IRPJ 15% + CSLL 9%).
        </p>
      </section>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
      <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">{label}</p>
      <p className={`mt-1 font-serif text-xl sm:text-2xl font-bold tracking-tight ${tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>{value}</p>
    </div>
  );
}

