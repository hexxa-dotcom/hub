'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, Paperclip, Plus, X } from 'lucide-react';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { VerComprovante } from '@/components/ui/VerComprovante';
import type { PropertyRow, LeaseRow, RentPaymentRow } from './actions';
import {
  createLeaseAction,
  reajustarLeaseAction,
  encerrarLeaseAction,
  marcarAluguelPagoAction,
  getRentPaymentsAction,
  indiceDoAluguelAction,
} from './actions';
import { impostoAluguel } from './lib';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const campo =
  'mt-1.5 w-full rounded-2xl border border-black/5 bg-surface-card px-4 py-2.5 text-sm text-ink shadow-(--elev-inset) outline-none focus:ring-2 focus:ring-hexxa-green dark:border-white/5 dark:focus:ring-hexxa-lime';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Próximo aniversário do reajuste: 12 meses depois da âncora, avançado até passar de hoje. */
function proximoReajuste(ancora: string, hoje: string) {
  let [y, m, d] = ancora.split('-').map(Number) as [number, number, number];
  let data = ancora;
  do {
    y += 1;
    data = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  } while (data <= hoje);
  return data;
}

const SITUACAO: Record<LeaseRow['status'], { label: string; cls: string }> = {
  DRAFT: { label: 'Rascunho', cls: 'text-ink-soft' },
  PENDING_SIGNATURE: { label: 'Aguardando assinatura', cls: 'text-amber-700 dark:text-amber-400' },
  ACTIVE: { label: 'Ativo', cls: 'text-emerald-700 dark:text-emerald-400' },
  ENDED: { label: 'Encerrado', cls: 'text-ink-soft' },
  CANCELED: { label: 'Cancelado', cls: 'text-ink-soft' },
};

export function AlugueisTab({ properties, leases, aliquota, hoje }: { properties: PropertyRow[]; leases: LeaseRow[]; aliquota: number; hoje: string }) {
  const router = useRouter();
  const [novo, setNovo] = useState(false);
  const ativos = leases.filter((l) => l.status === 'ACTIVE');
  const renda = ativos.reduce((s, l) => s + l.monthlyRent, 0);
  const imposto = impostoAluguel(renda, aliquota);
  const imoveis = properties.filter((p) => p.kind === 'Imóvel' || p.kind === 'Terreno');

  return (
    <div className="space-y-10">
      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo="Aluguel a receber por mês" valor={BRL.format(renda)} nota={`${ativos.length} ${ativos.length === 1 ? 'contrato ativo' : 'contratos ativos'}`} />
        <CardResumo rotulo="Imposto previsto por mês" valor={BRL.format(imposto)} tom="alerta" nota={aliquota > 0 ? `${PCT(aliquota)} — a alíquota do regime, a mesma da Bússola` : 'Sem alíquota apurada ainda'} />
        <CardResumo rotulo="Sobra por mês" valor={BRL.format(renda - imposto)} nota="Aluguel menos o imposto" />
      </GradeDeResumo>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="rotulo text-ink-soft">Contratos de aluguel</p>
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Plus className="h-3.5 w-3.5" /> Novo aluguel
          </button>
        </div>

        {leases.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
            Nenhum aluguel. Se a empresa aluga um imóvel dela para alguém, registre aqui: os recebimentos e a previsão de imposto entram sozinhos no financeiro.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.08] overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/[0.12] dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
            {leases.map((l) => (
              <Aluguel key={l.id} lease={l} hoje={hoje} onChanged={() => router.refresh()} />
            ))}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-ink-soft">
          Cada mês do contrato vira um valor a receber no financeiro (até 24 meses à frente), com a previsão do imposto ao lado. O reajuste sugere o
          índice acumulado em 12 meses, direto do Banco Central.
        </p>
      </section>

      {novo && <NovoAluguel imoveis={imoveis} hoje={hoje} onClose={() => setNovo(false)} onDone={() => router.refresh()} />}
    </div>
  );
}

function Aluguel({ lease, hoje, onChanged }: { lease: LeaseRow; hoje: string; onChanged: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [pagamentos, setPagamentos] = useState<RentPaymentRow[] | null>(null);
  const [reajuste, setReajuste] = useState<{ pct: string; fonte: string | null } | null>(null);
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ativo = lease.status === 'ACTIVE';
  const s = SITUACAO[lease.status];

  async function carregar() {
    setPagamentos(await getRentPaymentsAction(lease.id));
  }

  async function alternar() {
    const prox = !aberto;
    setAberto(prox);
    if (prox && pagamentos === null) await carregar();
  }

  async function abrirReajuste() {
    setReajuste({ pct: '', fonte: null });
    const i = await indiceDoAluguelAction(lease.indexType).catch(() => null);
    if (i) setReajuste({ pct: String(i.percentual).replace('.', ','), fonte: `${lease.indexType === 'IGPM' ? 'IGP-M' : 'IPCA'} de 12 meses até ${i.ate}` });
  }

  async function aplicarReajuste() {
    if (!reajuste) return;
    setBusy(true);
    try {
      const r = await reajustarLeaseAction(lease.id, Number(reajuste.pct.replace(',', '.')));
      setMsg(r.message);
      if (r.ok) {
        setReajuste(null);
        onChanged();
        await carregar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function encerrar() {
    setBusy(true);
    try {
      const r = await encerrarLeaseAction(lease.id);
      setMsg(r.message);
      setConfirmarFim(false);
      onChanged();
      await carregar();
    } finally {
      setBusy(false);
    }
  }

  async function recebido(id: string) {
    setBusy(true);
    try {
      await marcarAluguelPagoAction(id);
      await carregar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <button type="button" onClick={alternar} className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{lease.propertyName}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {lease.lesseeName} · <span className={`font-semibold ${s.cls}`}>{s.label}</span> · {fmtDate(lease.startDate)} a {lease.endDate ? fmtDate(lease.endDate) : 'prazo indeterminado'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-right">
          <div>
            <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(lease.monthlyRent)}/mês</p>
            {ativo && <p className="text-[11px] text-ink-soft">reajuste pelo {lease.indexType === 'IGPM' ? 'IGP-M' : 'IPCA'} em {fmtDate(proximoReajuste(lease.adjustmentAnchor, hoje))}</p>}
          </div>
          <ChevronDown className={`h-4 w-4 text-ink-soft transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-black/5 bg-black/[0.015] px-6 py-5 dark:border-white/10 dark:bg-white/[0.02]">
          {ativo && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold">
              <button type="button" onClick={abrirReajuste} className="text-ink-soft hover:text-ink">Reajustar</button>
              {confirmarFim ? (
                <span className="flex items-center gap-3">
                  <span className="font-normal text-ink-soft">Encerrar? Os meses seguintes saem do financeiro.</span>
                  <button type="button" onClick={encerrar} disabled={busy} className="text-rose-600 dark:text-rose-400">Sim, encerrar</button>
                  <button type="button" onClick={() => setConfirmarFim(false)} className="text-ink-soft hover:text-ink">Não</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmarFim(true)} className="text-ink-soft hover:text-rose-600">Encerrar aluguel</button>
              )}
            </div>
          )}

          {reajuste && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="rotulo text-ink-soft">Reajuste (%)</span>
                <input value={reajuste.pct} onChange={(e) => setReajuste({ ...reajuste, pct: e.target.value })} inputMode="decimal" placeholder="Buscando índice…" className={`${campo} w-40`} />
              </label>
              <button type="button" onClick={aplicarReajuste} disabled={busy || !reajuste.pct} className="rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime disabled:opacity-50 dark:bg-hexxa-lime dark:text-hexxa-forest">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}
              </button>
              <button type="button" onClick={() => setReajuste(null)} className="pb-2.5 text-xs font-semibold text-ink-soft hover:text-ink">Cancelar</button>
              {reajuste.fonte && <p className="w-full text-[11px] text-ink-soft">{reajuste.fonte}, pelo Banco Central.</p>}
            </div>
          )}
          {msg && <p className="text-xs font-semibold text-ink">{msg}</p>}

          <div>
            <p className="rotulo mb-2 text-ink-soft">Recebimentos</p>
            {pagamentos === null ? (
              <p className="flex items-center gap-2 text-xs text-ink-soft"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…</p>
            ) : pagamentos.length === 0 ? (
              <p className="text-xs text-ink-soft">Nenhum recebimento lançado.</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {pagamentos.map((p) => {
                  const atrasado = p.status !== 'PAID' && p.dueDate < hoje;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="w-24 text-xs tabular text-ink-soft">{fmtDate(p.dueDate)}</span>
                      <span className="w-28 font-serif text-sm font-bold tabular text-ink">{BRL.format(p.amount)}</span>
                      <span className={`text-[11px] font-semibold ${p.status === 'PAID' ? 'text-emerald-700 dark:text-emerald-400' : atrasado ? 'text-rose-600 dark:text-rose-400' : 'text-ink-soft'}`}>
                        {p.status === 'PAID' ? `Recebido em ${fmtDate(p.paidAt)}` : atrasado ? 'Atrasado' : 'A receber'}
                      </span>
                      <span className="ml-auto flex items-center gap-4">
                        {p.hasReceipt && (
                          <VerComprovante id={p.id} className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft hover:text-ink">
                            <Paperclip className="h-3 w-3" /> Comprovante
                          </VerComprovante>
                        )}
                        {p.status !== 'PAID' && p.dueDate <= hoje && (
                          <button type="button" onClick={() => recebido(p.id)} disabled={busy} className="text-[11px] font-bold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400">
                            Marcar recebido
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function NovoAluguel({ imoveis, hoje, onClose, onDone }: { imoveis: PropertyRow[]; hoje: string; onClose: () => void; onDone: () => void }) {
  const livres = imoveis.filter((p) => !p.leaseId && p.ownerType === 'PJ');
  const [imovel, setImovel] = useState(livres[0]?.id ?? '');
  const [locatario, setLocatario] = useState('');
  const [valor, setValor] = useState('');
  const [indice, setIndice] = useState<'IPCA' | 'IGPM'>('IPCA');
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onClose]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await createLeaseAction({
        propertyId: imovel,
        lesseeName: locatario,
        monthlyRent: Number(valor.replace(/\./g, '').replace(',', '.')),
        indexType: indice,
        startDate: inicio,
        endDate: fim || undefined,
      });
      if (!r.ok) return setErro(r.message);
      onDone();
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
            <p className="rotulo text-ink-soft">Novo aluguel</p>
            <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{livres.find((p) => p.id === imovel)?.name ?? 'Aluguel'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {livres.length === 0 ? (
          <p className="mt-5 text-sm text-ink-soft">
            {imoveis.length === 0
              ? 'Cadastre primeiro o imóvel na aba Bens (tipo Imóvel ou Terreno, da empresa).'
              : 'Todos os imóveis da empresa já estão alugados.'}
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="rotulo text-ink-soft">Imóvel</span>
                <select value={imovel} onChange={(e) => setImovel(e.target.value)} className={campo}>
                  {livres.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="rotulo text-ink-soft">Quem aluga</span>
                <input value={locatario} onChange={(e) => setLocatario(e.target.value)} placeholder="Nome ou razão social" className={campo} />
              </label>
              <label className="block">
                <span className="rotulo text-ink-soft">Aluguel por mês</span>
                <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={campo} />
              </label>
              <label className="block">
                <span className="rotulo text-ink-soft">Reajuste anual</span>
                <select value={indice} onChange={(e) => setIndice(e.target.value as 'IPCA' | 'IGPM')} className={campo}>
                  <option value="IPCA">IPCA</option>
                  <option value="IGPM">IGP-M</option>
                </select>
              </label>
              <label className="block">
                <span className="rotulo text-ink-soft">Início</span>
                <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
              </label>
              <label className="block">
                <span className="rotulo text-ink-soft">Fim (opcional)</span>
                <input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} className={campo} />
              </label>
            </div>
            <p className="mt-3 text-xs text-ink-soft">Vence todo mês no dia do início. Sem data de fim, lançamos 24 meses. Os meses anteriores ao atual não entram no financeiro.</p>
            {erro && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-3 text-sm font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Registrar aluguel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
