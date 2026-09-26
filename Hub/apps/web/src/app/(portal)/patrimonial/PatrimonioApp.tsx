'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import type { PropertyRow, LeaseRow } from './actions';
import { salvarBemAction, excluirBemAction } from './actions';
import { AlugueisTab } from './AlugueisTab';
import { TAXAS, TIPOS, mesesDeUso, depreciacaoAcumulada, depreciacaoMensal, type TipoDeBem } from './lib';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const campo =
  'mt-1.5 w-full rounded-2xl border border-black/5 bg-surface-card px-4 py-2.5 text-sm text-ink shadow-(--elev-inset) outline-none focus:ring-2 focus:ring-hexxa-green dark:border-white/5 dark:focus:ring-hexxa-lime';

export type Socio = { id: string; nome: string };
type Aba = 'bens' | 'alugueis';
type Filtro = 'TODOS' | 'PJ' | 'PF';

const mesAno = (iso: string) => {
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
};

export function PatrimonioApp({
  properties,
  partners,
  leases,
  aliquota,
  hoje,
}: {
  properties: PropertyRow[];
  partners: Socio[];
  leases: LeaseRow[];
  aliquota: number;
  hoje: string;
}) {
  const [aba, setAba] = useState<Aba>('bens');
  const [editando, setEditando] = useState<PropertyRow | 'novo' | null>(null);
  const alugados = leases.filter((l) => l.status === 'ACTIVE').length;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedTabs
          tabs={[
            { id: 'bens', label: 'Bens' },
            { id: 'alugueis', label: alugados ? `Aluguéis · ${alugados}` : 'Aluguéis' },
          ]}
          activeTab={aba}
          onChange={(id) => setAba(id as Aba)}
          layoutId="bensAbas"
        />
        {aba === 'bens' && (
          <button
            type="button"
            onClick={() => setEditando('novo')}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Plus className="h-3.5 w-3.5" /> Novo bem
          </button>
        )}
      </div>

      {aba === 'bens' ? (
        <ListaDeBens properties={properties} hoje={hoje} onAbrir={setEditando} />
      ) : (
        <AlugueisTab properties={properties} leases={leases} aliquota={aliquota} hoje={hoje} />
      )}

      {editando && (
        <FormularioDeBem bem={editando === 'novo' ? null : editando} partners={partners} hoje={hoje} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

function ListaDeBens({ properties, hoje, onAbrir }: { properties: PropertyRow[]; hoje: string; onAbrir: (b: PropertyRow) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  const linhas = properties.map((b) => {
    const meses = mesesDeUso(b.compra, hoje);
    const depreciado = depreciacaoAcumulada(b.acq, b.rate, meses);
    return { ...b, meses, depreciado, valorHoje: b.acq - depreciado, porMes: depreciacaoMensal(b.acq, b.rate, meses) };
  });
  const daEmpresa = linhas.filter((b) => b.ownerType === 'PJ');
  const dosSocios = linhas.filter((b) => b.ownerType === 'PF');
  const soma = (l: typeof linhas, f: (b: (typeof linhas)[number]) => number) => l.reduce((s, b) => s + f(b), 0);
  const lista = filtro === 'TODOS' ? linhas : linhas.filter((b) => b.ownerType === filtro);

  return (
    <div className="space-y-10">
      <GradeDeResumo colunas={3}>
        <CardResumo
          destaque
          rotulo="Bens da empresa hoje"
          valor={BRL0.format(soma(daEmpresa, (b) => b.valorHoje))}
          nota={`${daEmpresa.length} ${daEmpresa.length === 1 ? 'bem' : 'bens'} · comprados por ${BRL0.format(soma(daEmpresa, (b) => b.acq))}`}
          onClick={() => setFiltro('PJ')}
        />
        <CardResumo
          rotulo="Desgaste por mês"
          valor={BRL.format(soma(daEmpresa, (b) => b.porMes))}
          nota="Depreciação dos bens da empresa"
        />
        <CardResumo
          rotulo="Bens dos sócios"
          valor={BRL0.format(soma(dosSocios, (b) => b.valorHoje))}
          nota={`${dosSocios.length} ${dosSocios.length === 1 ? 'bem pessoal' : 'bens pessoais'}`}
          onClick={() => setFiltro('PF')}
        />
      </GradeDeResumo>

      <section className="space-y-5">
        <FiltrosEmTexto<Filtro>
          ativo={filtro}
          onChange={setFiltro}
          filtros={[
            { id: 'TODOS', label: 'Todos', count: linhas.length },
            { id: 'PJ', label: 'Da empresa', count: daEmpresa.length },
            { id: 'PF', label: 'Dos sócios', count: dosSocios.length },
          ]}
        />

        {lista.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
            {linhas.length === 0
              ? 'Nenhum bem cadastrado. Comece pelo que a empresa usa no dia a dia: computadores, veículo, móveis, a sala própria.'
              : 'Nenhum bem neste filtro.'}
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.08] overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/[0.12] dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
            {lista.map((b) => {
              const pct = b.acq > 0 ? Math.round((b.depreciado / b.acq) * 100) : 0;
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => onAbrir(b)} className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {b.name}
                        {b.leaseId && <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Alugado · {BRL0.format(b.rent)}/mês</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {b.kind} · {b.ownerType === 'PJ' ? 'da empresa' : `de ${b.partnerName ?? 'um sócio'}`} · comprado em {mesAno(b.compra)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-serif text-sm font-bold tabular text-ink">{BRL0.format(b.valorHoje)}</p>
                      <p className="text-[11px] text-ink-soft">
                        {b.rate === 0 ? `pago ${BRL0.format(b.acq)} · não deprecia` : `pago ${BRL0.format(b.acq)} · ${pct}% depreciado`}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-ink-soft">
          Valor de hoje = o que foi pago menos a depreciação linear desde a compra, pelas taxas da Receita (IN RFB 1.700/2017): imóvel 4% ao ano,
          veículo e informática 20%, máquinas e móveis 10%. Terreno não deprecia. Os bens dos sócios aparecem aqui só para o retrato do patrimônio — não
          entram na contabilidade da empresa.
        </p>
      </section>
    </div>
  );
}

function FormularioDeBem({ bem, partners, hoje, onClose }: { bem: PropertyRow | null; partners: Socio[]; hoje: string; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(bem?.name ?? '');
  const [tipo, setTipo] = useState<TipoDeBem>(bem?.kind ?? 'Equipamento de Informática');
  const [valor, setValor] = useState(bem ? String(bem.acq).replace('.', ',') : '');
  const [compra, setCompra] = useState(bem?.compra ?? hoje);
  const [endereco, setEndereco] = useState(bem?.endereco ?? '');
  const [dono, setDono] = useState<'PJ' | 'PF'>(bem?.ownerType ?? 'PJ');
  const [socioId, setSocioId] = useState(bem?.partnerId ?? partners[0]?.id ?? '');
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const imovel = tipo === 'Imóvel' || tipo === 'Terreno';

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onClose]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarBemAction({
        id: bem?.id,
        nome,
        tipo,
        valor: Number(valor.replace(/\./g, '').replace(',', '.')),
        compra,
        endereco: imovel ? endereco : '',
        dono,
        socioId,
      });
      if (!r.ok) return setErro(r.message);
      router.refresh();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!bem) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await excluirBemAction(bem.id);
      if (!r.ok) {
        setConfirmarExclusao(false);
        return setErro(r.message);
      }
      router.refresh();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-black/5 bg-surface p-6 shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="rotulo text-ink-soft">{bem ? 'Editar bem' : 'Novo bem'}</p>
            <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{nome || 'Bem'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="rotulo text-ink-soft">O que é</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: MacBook Pro, Sala 402, Fiat Toro" className={campo} />
          </label>
          <label className="block">
            <span className="rotulo text-ink-soft">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeBem)} className={campo}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="rotulo text-ink-soft">Quanto custou</span>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={campo} />
          </label>
          <label className="block">
            <span className="rotulo text-ink-soft">Data da compra</span>
            <input type="date" value={compra} max={hoje} onChange={(e) => setCompra(e.target.value)} className={campo} />
          </label>
          <label className="block">
            <span className="rotulo text-ink-soft">De quem é</span>
            <select value={dono} onChange={(e) => setDono(e.target.value as 'PJ' | 'PF')} className={campo}>
              <option value="PJ">Da empresa</option>
              <option value="PF" disabled={partners.length === 0}>De um sócio</option>
            </select>
          </label>
          {dono === 'PF' && (
            <label className="block sm:col-span-2">
              <span className="rotulo text-ink-soft">Sócio</span>
              <select value={socioId} onChange={(e) => setSocioId(e.target.value)} className={campo}>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </label>
          )}
          {imovel && (
            <label className="block sm:col-span-2">
              <span className="rotulo text-ink-soft">Endereço</span>
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className={campo} />
            </label>
          )}
        </div>

        <p className="mt-3 text-xs text-ink-soft">
          {TAXAS[tipo].rate === 0 ? 'Terreno não deprecia.' : `Deprecia ${TAXAS[tipo].rate}% ao ano — em ${TAXAS[tipo].vida} anos chega a zero.`}
        </p>
        {erro && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-3 text-sm font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
        >
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />} {bem ? 'Salvar' : 'Cadastrar bem'}
        </button>
        {bem &&
          (confirmarExclusao ? (
            <div className="mt-3 flex items-center justify-center gap-4 text-xs">
              <span className="text-ink-soft">Excluir este bem?</span>
              <button type="button" onClick={excluir} disabled={salvando} className="font-bold text-rose-600 dark:text-rose-400">Sim, excluir</button>
              <button type="button" onClick={() => setConfirmarExclusao(false)} className="font-semibold text-ink-soft hover:text-ink">Não</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmarExclusao(true)} className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-rose-600">
              <Trash2 className="h-3.5 w-3.5" /> Excluir bem
            </button>
          ))}
      </div>
    </div>
  );
}
