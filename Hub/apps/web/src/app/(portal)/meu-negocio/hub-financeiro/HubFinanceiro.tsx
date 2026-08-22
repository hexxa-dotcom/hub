'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Trash, CheckCircle, WarningCircle, Clock, TrendUp, TrendDown, Wallet, Warning, CaretDown, CaretUp, Spinner, X, Calendar, Tag, FileText, ArrowUpRight, ArrowDownRight, ArrowsClockwise, CurrencyDollar, SquaresFour, ArrowCircleDown, ArrowCircleUp, Percent, ChartPie, Bank, QrCode, Copy, PaperPlaneRight } from '@phosphor-icons/react';

import { getLancamentos, createLancamento, updateLancamentoStatus, deleteLancamento } from './actions';

// ── Types ────────────────────────────────────────────────────────────────────

type Lancamento = {
  id: string;
  tipo: 'PAGAR' | 'RECEBER';
  descricao: string;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  categoria: string | null;
  observacao: string | null;
  created_at: string;
  statusDb?: string;
};

type Status = 'pago' | 'vencido' | 'aberto';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

function getStatus(l: Lancamento): Status {
  if (l.pago_em) return 'pago';
  const today = new Date(); today.setHours(0,0,0,0);
  const venc = new Date(l.vencimento + 'T12:00:00');
  return venc < today ? 'vencido' : 'aberto';
}

const CATEGORIAS_PAGAR = ['Aluguel','Salários','Fornecedores','Impostos','Infraestrutura','Tecnologia','Serviços','Outros'];
const CATEGORIAS_RECEBER = ['Serviços','Projetos','Mensalidade','Consultoria','Produtos','Aluguéis','Outros'];

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ l }: { l: Lancamento }) {
  const s = getStatus(l);
  const isPagar = l.tipo === 'PAGAR';
  if (s === 'pago') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">
      <CheckCircle className="h-3 w-3" />{isPagar ? 'Pago' : 'Recebido'}
    </span>
  );
  if (s === 'vencido') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-critical/10 px-2 py-0.5 text-xs font-medium text-critical">
      <WarningCircle className="h-3 w-3" />Vencido
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn">
      <Clock className="h-3 w-3" />Em aberto
    </span>
  );
}

// ── Form inline ───────────────────────────────────────────────────────────────

const FISCAL_CATS = ['Impostos', 'DAS', 'ISS', 'DARF', 'FGTS', 'Parcelamento'];

function LancamentoForm({
  tipo,
  onAdd,
  onClose,
  defaultCategoria,
}: {
  tipo: 'PAGAR' | 'RECEBER';
  onAdd: (l: Lancamento) => void;
  onClose: () => void;
  defaultCategoria?: string;
}) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [categoria, setCategoria] = useState(defaultCategoria ?? '');
  const [observacao, setObservacao] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cats = tipo === 'PAGAR' ? CATEGORIAS_PAGAR : CATEGORIAS_RECEBER;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valor || !vencimento) {
      setErr('Preencha descrição, valor e vencimento.');
      return;
    }
    setSaving(true); setErr(null);
    try {
      await createLancamento({
        tipo,
        descricao,
        valor: parseFloat(valor.replace(',', '.')),
        vencimento,
        parcelas
      });
      // Cast vazio apenas para não quebrar a tipagem do callback original (que será atualizado)
      onAdd({} as Lancamento);
      onClose();
    } catch {
      setErr('Falha ao salvar no banco de dados.');
    } finally {
      setSaving(false);
    }
  }

  const field = 'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
          {tipo === 'PAGAR' ? '+ Nova conta a pagar' : '+ Nova conta a receber'}
        </p>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-soft hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-soft">Descrição *</label>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Aluguel maio, NF 001…" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-soft">Valor (R$) *</label>
          <input type="number" step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-soft">Vencimento *</label>
          <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-soft">Categoria</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className={`mt-1 ${field}`}>
            <option value="">Sem categoria</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-soft">Observação</label>
          <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional…" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-soft">Repetição / Recorrência</label>
          <select value={parcelas} onChange={e => setParcelas(Number(e.target.value))} className={`mt-1 ${field}`}>
            <option value={1}>Lançamento Único (1x)</option>
            <option value={2}>Recorrente 2 meses (2x)</option>
            <option value={3}>Recorrente 3 meses (3x)</option>
            <option value={6}>Recorrente 6 meses (6x)</option>
            <option value={12}>Recorrente 12 meses (1 ano)</option>
            <option value={24}>Recorrente 24 meses (2 anos)</option>
          </select>
        </div>
      </div>

      {err && (
        <p className="flex items-center gap-2 rounded-xl bg-critical/10 px-3 py-2 text-xs text-critical">
          <WarningCircle className="h-3.5 w-3.5 shrink-0" />{err}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60">
          {saving ? <Spinner className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Salvar
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Tabela de lançamentos ─────────────────────────────────────────────────────

type FilterTab = 'todos' | 'aberto' | 'vencido' | 'pago';

function LancamentosTab({
  tipo,
  data,
  onAdd,
  onUpdate,
  onDelete,
}: {
  tipo: 'PAGAR' | 'RECEBER';
  data: Lancamento[];
  onAdd: (l: Lancamento) => void;
  onUpdate: (l: Lancamento) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<FilterTab>('todos');
  const [showForm, setShowForm] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedPixLancamento, setSelectedPixLancamento] = useState<Lancamento | null>(null);

  const list = useMemo(() => {
    const base = data.filter(l => l.tipo === tipo);
    if (filter === 'todos') return base;
    return base.filter(l => getStatus(l) === filter);
  }, [data, tipo, filter]);

  const counts = useMemo(() => {
    const base = data.filter(l => l.tipo === tipo);
    return {
      todos: base.length,
      aberto: base.filter(l => getStatus(l) === 'aberto').length,
      vencido: base.filter(l => getStatus(l) === 'vencido').length,
      pago: base.filter(l => getStatus(l) === 'pago').length,
    };
  }, [data, tipo]);

  async function togglePago(l: Lancamento) {
    setMarking(l.id);
    const newStatus = l.statusDb === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await updateLancamentoStatus(l.id, newStatus as any);
      onUpdate({} as Lancamento); // trigger refresh
    } finally { setMarking(null); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteLancamento(id);
      onDelete(id); // trigger refresh
    } finally { setDeleting(null); }
  }

  const isPagar = tipo === 'PAGAR';
  const label = isPagar ? 'pagar' : 'receber';

  const filterBtns: { key: FilterTab; label: string }[] = [
    { key: 'todos', label: `Todos (${counts.todos})` },
    { key: 'aberto', label: `Em aberto (${counts.aberto})` },
    { key: 'vencido', label: `Vencidos (${counts.vencido})` },
    { key: 'pago', label: isPagar ? `Pagos (${counts.pago})` : `Recebidos (${counts.pago})` },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {filterBtns.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Nova conta a {label}
        </button>
      </div>

      {showForm && (
        <LancamentoForm
          tipo={tipo}
          onAdd={l => { onAdd(l); setFilter('todos'); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Table */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-ink-soft">
          <CurrencyDollar className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum lançamento encontrado.</p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {/* Desktop header */}
          <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 bg-surface-card border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:bg-white/3 sm:grid">
            <span>Descrição</span>
            <span className="w-28 text-right">Vencimento</span>
            <span className="w-32 text-right">Valor</span>
            <span className="w-24 text-center">Status</span>
            <span className="w-20 text-center">Ações</span>
          </div>

          {list.map(l => {
            const s = getStatus(l);
            const isExp = expanded === l.id;
            return (
              <div key={l.id}>
                {/* Row */}
                <div
                  className={`grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-card border border-line dark:hover:bg-white/3 sm:grid-cols-[1fr_auto_auto_auto_auto] ${
                    s === 'vencido' ? 'border-l-2 border-l-critical' : s === 'pago' ? 'opacity-60' : ''
                  }`}
                  onClick={() => setExpanded(isExp ? null : l.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.descricao}</p>
                    {l.categoria && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-soft">
                        <Tag className="h-3 w-3" />{l.categoria}
                      </span>
                    )}
                    {/* Mobile: show date + value inline */}
                    <p className="mt-0.5 text-xs text-ink-soft sm:hidden">
                      {fmtDate(l.vencimento)} · <strong>{fmt(l.valor)}</strong>
                    </p>
                  </div>

                  <span className="hidden w-28 text-right text-sm text-ink-soft sm:block">{fmtDate(l.vencimento)}</span>
                  <span className={`hidden w-32 text-right text-sm font-semibold sm:block ${isPagar ? 'text-critical' : 'text-ok'}`}>
                    {fmt(l.valor)}
                  </span>
                  <span className="hidden w-24 text-center sm:block"><StatusBadge l={l} /></span>

                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {!isPagar && !l.pago_em && (
                      <button
                        type="button"
                        title="Gerar Cobrança Pix"
                        onClick={() => setSelectedPixLancamento(l)}
                        className="inline-flex items-center gap-1 rounded-xl bg-brand-500/10 px-2 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-500/20"
                      >
                        <QrCode className="h-3.5 w-3.5" /> Pix
                      </button>
                    )}
                    {/* Mark paid/received */}
                    <button
                      type="button"
                      title={l.pago_em ? 'Desfazer' : (isPagar ? 'Marcar como pago' : 'Marcar como recebido')}
                      onClick={() => togglePago(l)}
                      disabled={marking === l.id}
                      className={`rounded-xl p-1.5 transition-colors ${
                        l.pago_em
                          ? 'text-ok hover:bg-ok/10'
                          : 'text-ink-soft hover:bg-ok/10 hover:text-ok'
                      } disabled:opacity-40`}
                    >
                      {marking === l.id
                        ? <Spinner className="h-4 w-4 animate-spin" />
                        : <CheckCircle className="h-4 w-4" />
                      }
                    </button>
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => handleDelete(l.id)}
                      disabled={deleting === l.id}
                      className="rounded-xl p-1.5 text-ink-soft transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-40"
                    >
                      {deleting === l.id
                        ? <Spinner className="h-4 w-4 animate-spin" />
                        : <Trash className="h-4 w-4" />
                      }
                    </button>
                    {isExp ? <CaretUp className="h-4 w-4 text-ink-soft" /> : <CaretDown className="h-4 w-4 text-ink-soft" />}
                  </div>
                </div>

                {/* Expanded row */}
                {isExp && (
                  <div className="border-t border-line bg-surface-card border border-line px-4 py-3 text-xs dark:bg-white/3">
                    <div className="flex flex-wrap gap-4">
                      <div><span className="text-ink-soft">Categoria:</span> <strong>{l.categoria ?? '—'}</strong></div>
                      <div><span className="text-ink-soft">Criado em:</span> <strong>{fmtDate(l.created_at.split('T')[0]!)}</strong></div>
                      {l.pago_em && <div><span className="text-ink-soft">{isPagar ? 'Pago em:' : 'Recebido em:'}</span> <strong>{fmtDate(l.pago_em)}</strong></div>}
                      {l.observacao && <div className="w-full"><span className="text-ink-soft">Obs.:</span> {l.observacao}</div>}
                      <div className="sm:hidden"><StatusBadge l={l} /></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Visão Geral ───────────────────────────────────────────────────────────────

function VisaoGeral({ data }: { data: Lancamento[] }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

  const totalPagar = data.filter(l => l.tipo === 'PAGAR' && !l.pago_em).reduce((s, l) => s + l.valor, 0);
  const totalReceber = data.filter(l => l.tipo === 'RECEBER' && !l.pago_em).reduce((s, l) => s + l.valor, 0);
  const vencidos = data.filter(l => getStatus(l) === 'vencido');
  const saldo = totalReceber - totalPagar;

  const proximos = data
    .filter(l => {
      if (l.pago_em) return false;
      const v = new Date(l.vencimento + 'T12:00:00');
      return v >= today && v <= in7;
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  // Fluxo: próximos 30 dias agrupados por semana
  const weeks: { label: string; pagar: number; receber: number }[] = [];
  for (let w = 0; w < 4; w++) {
    const start = new Date(today); start.setDate(start.getDate() + w * 7);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const label = `Sem ${w + 1}`;
    const pagar = data.filter(l => {
      if (l.tipo !== 'PAGAR' || l.pago_em) return false;
      const v = new Date(l.vencimento + 'T12:00:00');
      return v >= start && v <= end;
    }).reduce((s, l) => s + l.valor, 0);
    const receber = data.filter(l => {
      if (l.tipo !== 'RECEBER' || l.pago_em) return false;
      const v = new Date(l.vencimento + 'T12:00:00');
      return v >= start && v <= end;
    }).reduce((s, l) => s + l.valor, 0);
    weeks.push({ label, pagar, receber });
  }
  const maxWeek = Math.max(...weeks.flatMap(w => [w.pagar, w.receber]), 1);

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card-flat rounded-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">A Pagar (em aberto)</p>
            <TrendDown className="h-4 w-4 text-critical" />
          </div>
          <p className="mt-2 text-xl font-semibold text-critical">{fmt(totalPagar)}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">A Receber (em aberto)</p>
            <TrendUp className="h-4 w-4 text-ok" />
          </div>
          <p className="mt-2 text-xl font-semibold text-ok">{fmt(totalReceber)}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Saldo projetado</p>
            <Wallet className={`h-4 w-4 ${saldo >= 0 ? 'text-ok' : 'text-critical'}`} />
          </div>
          <p className={`mt-2 text-xl font-semibold ${saldo >= 0 ? 'text-ok' : 'text-critical'}`}>{fmt(saldo)}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-soft">Vencidos</p>
            <Warning className={`h-4 w-4 ${vencidos.length > 0 ? 'text-critical' : 'text-ink-soft'}`} />
          </div>
          <p className={`mt-2 text-xl font-semibold ${vencidos.length > 0 ? 'text-critical' : 'text-ink-soft'}`}>{vencidos.length}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Próximos 7 dias */}
        <div className="card-flat rounded-card p-4">
          <p className="mb-3 text-sm font-semibold">Próximos 7 dias</p>
          {proximos.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">Nenhum vencimento próximo.</p>
          ) : (
            <div className="space-y-2">
              {proximos.map(l => (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-card border border-line px-3 py-2 dark:bg-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.descricao}</p>
                    <p className="text-xs text-ink-soft">{fmtDate(l.vencimento)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.tipo === 'PAGAR'
                      ? <ArrowDownRight className="h-4 w-4 text-critical" />
                      : <ArrowUpRight className="h-4 w-4 text-ok" />
                    }
                    <span className={`text-sm font-semibold ${l.tipo === 'PAGAR' ? 'text-critical' : 'text-ok'}`}>
                      {fmt(l.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fluxo de caixa 4 semanas */}
        <div className="card-flat rounded-card p-4">
          <p className="mb-3 text-sm font-semibold">Fluxo previsto — próximas 4 semanas</p>
          <div className="flex items-end gap-3 h-32">
            {weeks.map(w => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-end gap-1 h-24">
                  <div
                    title={`A pagar: ${fmt(w.pagar)}`}
                    className="flex-1 rounded-t-md bg-critical/60 transition-all"
                    style={{ height: `${w.pagar ? (w.pagar / maxWeek) * 100 : 0}%` }}
                  />
                  <div
                    title={`A receber: ${fmt(w.receber)}`}
                    className="flex-1 rounded-t-md bg-ok/60 transition-all"
                    style={{ height: `${w.receber ? (w.receber / maxWeek) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-ink-soft">{w.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-xl bg-critical/60 inline-block" />A pagar</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-xl bg-ok/60 inline-block" />A receber</span>
          </div>
        </div>
      </div>

      {/* Vencidos */}
      {vencidos.length > 0 && (
        <div className="rounded-xl border border-critical/30 bg-critical/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-critical">
            <Warning className="h-4 w-4" />
            {vencidos.length} lançamento{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {vencidos.map(l => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{l.descricao}</span>
                <span className="font-medium text-critical">{fmt(l.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Conciliação ───────────────────────────────────────────────────────────────

function Conciliacao({ data }: { data: Lancamento[] }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const mes = (l: Lancamento) => {
    const v = new Date(l.vencimento + 'T12:00:00');
    return v >= startOfMonth && v <= endOfMonth;
  };

  const pagarMes = data.filter(l => l.tipo === 'PAGAR' && mes(l));
  const receberMes = data.filter(l => l.tipo === 'RECEBER' && mes(l));

  const totalPagarMes = pagarMes.reduce((s, l) => s + l.valor, 0);
  const totalReceberMes = receberMes.reduce((s, l) => s + l.valor, 0);
  const pagoMes = pagarMes.filter(l => l.pago_em).reduce((s, l) => s + l.valor, 0);
  const recebidoMes = receberMes.filter(l => l.pago_em).reduce((s, l) => s + l.valor, 0);

  const pPago = totalPagarMes ? (pagoMes / totalPagarMes) * 100 : 0;
  const pRecebido = totalReceberMes ? (recebidoMes / totalReceberMes) * 100 : 0;

  const monthName = today.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const pendentesNaoVencidos = data.filter(l => {
    const v = new Date(l.vencimento + 'T12:00:00');
    return !l.pago_em && v >= today;
  }).sort((a,b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold capitalize">{monthName} — resumo</p>
        <p className="text-xs text-ink-soft">Realizado vs. previsto para o mês atual</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* A pagar */}
        <div className="card-flat rounded-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Contas a pagar</p>
            <TrendDown className="h-4 w-4 text-critical" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-ink-soft">
              <span>Pago</span>
              <span>{fmt(pagoMes)} de {fmt(totalPagarMes)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pPago}%` }} />
            </div>
            <p className="text-right text-xs font-semibold text-ok">{pPago.toFixed(0)}% quitado</p>
          </div>
          <div className="border-t border-line pt-2 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-ink-soft">Pendente</span><span className="text-critical font-medium">{fmt(totalPagarMes - pagoMes)}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Total do mês</span><span>{fmt(totalPagarMes)}</span></div>
          </div>
        </div>

        {/* A receber */}
        <div className="card-flat rounded-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Contas a receber</p>
            <TrendUp className="h-4 w-4 text-ok" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-ink-soft">
              <span>Recebido</span>
              <span>{fmt(recebidoMes)} de {fmt(totalReceberMes)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pRecebido}%` }} />
            </div>
            <p className="text-right text-xs font-semibold text-ok">{pRecebido.toFixed(0)}% recebido</p>
          </div>
          <div className="border-t border-line pt-2 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-ink-soft">Pendente</span><span className="text-warn font-medium">{fmt(totalReceberMes - recebidoMes)}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Total do mês</span><span>{fmt(totalReceberMes)}</span></div>
          </div>
        </div>
      </div>

      {/* Agenda de vencimentos */}
      <div className="card-flat rounded-card p-4">
        <p className="mb-3 text-sm font-semibold">Agenda de vencimentos — próximos 30 dias</p>
        {pendentesNaoVencidos.length === 0 ? (
          <p className="py-4 text-center text-sm text-ok">Nenhum vencimento pendente nos próximos 30 dias.</p>
        ) : (
          <div className="divide-y divide-line">
            {pendentesNaoVencidos.map(l => {
              const days = Math.ceil((new Date(l.vencimento + 'T12:00:00').getTime() - today.getTime()) / 86400000);
              return (
                <div key={l.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {l.tipo === 'PAGAR'
                      ? <ArrowDownRight className="h-4 w-4 shrink-0 text-critical" />
                      : <ArrowUpRight className="h-4 w-4 shrink-0 text-ok" />
                    }
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.descricao}</p>
                      <p className="text-xs text-ink-soft">{fmtDate(l.vencimento)} · {l.categoria ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${days <= 3 ? 'bg-warn/10 text-warn' : 'bg-surface-card border border-line text-ink-soft dark:bg-white/5'}`}>
                      {days === 0 ? 'Hoje' : `${days}d`}
                    </span>
                    <span className={`text-sm font-semibold ${l.tipo === 'PAGAR' ? 'text-critical' : 'text-ok'}`}>
                      {fmt(l.valor)}
                    </span>
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

// ── ImpostosTab ───────────────────────────────────────────────────────────────

function ImpostosTab({ data, onAdd, onUpdate, onDelete }: {
  data: Lancamento[];
  onAdd: (l: Lancamento) => void;
  onUpdate: (l: Lancamento) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<FilterTab>('todos');
  const [showForm, setShowForm] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const impostos = useMemo(() =>
    data.filter(l => l.tipo === 'PAGAR' && FISCAL_CATS.some(c => l.categoria === c)),
    [data],
  );

  const filtered = useMemo(() => {
    if (filter === 'todos') return impostos;
    return impostos.filter(l => getStatus(l) === filter);
  }, [impostos, filter]);

  const totalAberto = impostos.filter(l => !l.pago_em).reduce((s, l) => s + l.valor, 0);
  const totalPago   = impostos.filter(l =>  l.pago_em).reduce((s, l) => s + l.valor, 0);
  const qtdVencidos = impostos.filter(l => getStatus(l) === 'vencido').length;

  async function togglePago(l: Lancamento) {
    setMarking(l.id);
    try {
      await updateLancamentoStatus(l.id, l.pago_em ? 'PENDING' : 'PAID');
      onUpdate(l);
    } finally { setMarking(null); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteLancamento(id);
      onDelete(id);
    } finally { setDeleting(null); }
  }

  const catCls: Record<string, string> = {
    DAS: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
    DARF: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    ISS: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    FGTS: 'bg-green-500/10 text-green-600 dark:text-green-400',
    Parcelamento: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    Impostos: 'bg-warn/10 text-warn',
  };

  const filterBtns: { key: FilterTab; label: string }[] = [
    { key: 'todos', label: `Todos (${impostos.length})` },
    { key: 'aberto', label: `Em aberto (${impostos.filter(l => getStatus(l) === 'aberto').length})` },
    { key: 'vencido', label: `Vencidos (${qtdVencidos})` },
    { key: 'pago', label: `Pagos (${impostos.filter(l => !!l.pago_em).length})` },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">A pagar</p>
          <p className="mt-1.5 text-xl font-semibold text-critical">{fmt(totalAberto)}</p>
        </div>
        <div className={`rounded-card p-4 ${qtdVencidos > 0 ? 'card-flat border border-critical/30' : 'card-flat'}`}>
          <p className="text-xs text-ink-soft">Vencidos</p>
          <p className={`mt-1.5 text-xl font-semibold ${qtdVencidos > 0 ? 'text-critical' : 'text-ink-soft'}`}>{qtdVencidos}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Pago no mês</p>
          <p className="mt-1.5 text-xl font-semibold text-ok">{fmt(totalPago)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {filterBtns.map(f => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.key ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Lançar imposto
        </button>
      </div>

      {showForm && (
        <LancamentoForm tipo="PAGAR" defaultCategoria="Impostos"
          onAdd={l => { onAdd(l); setShowForm(false); }} onClose={() => setShowForm(false)} />
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-ink-soft">
          <CurrencyDollar className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum imposto com este filtro.</p>
          <p className="text-xs">Adicione em "A Pagar" com categoria: DAS, ISS, DARF, FGTS, Parcelamento ou Impostos.</p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 bg-surface-card border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:bg-white/3 sm:grid">
            <span className="w-20">Tipo</span><span>Descrição</span>
            <span className="w-28 text-right">Vencimento</span><span className="w-32 text-right">Valor</span>
            <span className="w-24 text-center">Status</span><span className="w-20 text-center">Ações</span>
          </div>
          {filtered.map(l => {
            const s = getStatus(l);
            const isExp = expanded === l.id;
            return (
              <div key={l.id}>
                <div className={`grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-card border border-line dark:hover:bg-white/3 sm:grid-cols-[auto_1fr_auto_auto_auto_auto] ${s === 'vencido' ? 'border-l-2 border-l-critical' : s === 'pago' ? 'opacity-60' : ''}`}
                  onClick={() => setExpanded(isExp ? null : l.id)}>
                  <span className={`hidden w-20 shrink-0 rounded-xl px-2 py-0.5 text-[10px] font-bold sm:block ${catCls[l.categoria ?? ''] ?? 'bg-ink/5 text-ink-soft'}`}>
                    {l.categoria ?? 'Imposto'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.descricao}</p>
                    <p className="mt-0.5 text-xs text-ink-soft sm:hidden">{fmtDate(l.vencimento)} · {fmt(l.valor)}</p>
                  </div>
                  <span className="hidden w-28 text-right text-sm text-ink-soft sm:block">{fmtDate(l.vencimento)}</span>
                  <span className="hidden w-32 text-right text-sm font-semibold text-critical sm:block">{fmt(l.valor)}</span>
                  <span className="hidden w-24 text-center sm:block"><StatusBadge l={l} /></span>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button type="button" title={l.pago_em ? 'Desfazer' : 'Marcar como pago'} onClick={() => togglePago(l)} disabled={marking === l.id}
                      className={`rounded-xl p-1.5 transition-colors ${l.pago_em ? 'text-ok hover:bg-ok/10' : 'text-ink-soft hover:bg-ok/10 hover:text-ok'} disabled:opacity-40`}>
                      {marking === l.id ? <Spinner className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    </button>
                    <button type="button" title="Excluir" onClick={() => handleDelete(l.id)} disabled={deleting === l.id}
                      className="rounded-xl p-1.5 text-ink-soft transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-40">
                      {deleting === l.id ? <Spinner className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                    </button>
                    {isExp ? <CaretUp className="h-4 w-4 text-ink-soft" /> : <CaretDown className="h-4 w-4 text-ink-soft" />}
                  </div>
                </div>
                {isExp && (
                  <div className="border-t border-line bg-surface-card border border-line px-4 py-3 text-xs dark:bg-white/3">
                    <div className="flex flex-wrap gap-4">
                      <div><span className="text-ink-soft">Categoria:</span> <strong>{l.categoria ?? '—'}</strong></div>
                      {l.pago_em && <div><span className="text-ink-soft">Pago em:</span> <strong>{fmtDate(l.pago_em)}</strong></div>}
                      {l.observacao && <div className="w-full"><span className="text-ink-soft">Obs.:</span> {l.observacao}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DRETab ────────────────────────────────────────────────────────────────────

function DRETab({ data }: { data: Lancamento[] }) {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  const period = `${ano}-${String(mes).padStart(2, '0')}`;

  const receitas  = data.filter(l => l.tipo === 'RECEBER' && l.pago_em?.startsWith(period));
  const despesasPagas = data.filter(l => l.tipo === 'PAGAR' && l.pago_em?.startsWith(period));

  const isImpost  = (l: Lancamento) => FISCAL_CATS.some(c => l.categoria === c);
  const isSalario = (l: Lancamento) => l.categoria === 'Salários' || l.descricao.toLowerCase().includes('pró-labore') || l.descricao.toLowerCase().includes('folha');

  const impArray  = despesasPagas.filter(l => isImpost(l));
  const salArray  = despesasPagas.filter(l => !isImpost(l) && isSalario(l));
  const opArray   = despesasPagas.filter(l => !isImpost(l) && !isSalario(l));

  const totalRec  = receitas.reduce((s, l) => s + l.valor, 0);
  const totalImp  = impArray.reduce((s, l) => s + l.valor, 0);
  const totalSal  = salArray.reduce((s, l) => s + l.valor, 0);
  const totalOp   = opArray.reduce((s, l) => s + l.valor, 0);
  const resultado = totalRec - totalImp - totalSal - totalOp;

  const mesLabel = new Date(ano, mes - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  function exportPDF() {
    const rows = (title: string, items: Lancamento[], total: number, colorCls: string) => `
      <tr style="background:#f9fafb;font-weight:700">
        <td style="padding:10px 8px">${title}</td>
        <td style="padding:10px 8px;text-align:right;color:${colorCls}">${fmt(total)}</td>
      </tr>
      ${items.map(l => `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:7px 8px 7px 24px;color:#6b7280;font-size:13px">${l.descricao}</td><td style="padding:7px 8px;text-align:right;font-size:13px">${fmt(l.valor)}</td></tr>`).join('')}
      ${items.length === 0 ? '<tr><td colspan="2" style="padding:6px 24px;color:#9ca3af;font-size:12px;font-style:italic">Nenhum lançamento</td></tr>' : ''}`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>DRE — ${mesLabel}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;color:#111}h1{font-size:22px;margin-bottom:4px}.sub{color:#6b7280;font-size:13px;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:14px}.resultado{font-size:16px;font-weight:800;border-top:3px solid #111}.footer{margin-top:32px;font-size:11px;color:#9ca3af}</style>
    </head><body>
    <h1>DRE Simplificado</h1><p class="sub">Competência: ${mesLabel} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
    <table>
      ${rows('RECEITAS', receitas, totalRec, '#16a34a')}
      ${rows('(−) IMPOSTOS', impArray, totalImp, '#dc2626')}
      ${rows('(−) SALÁRIOS E PRÓ-LABORE', salArray, totalSal, '#dc2626')}
      ${rows('(−) DESPESAS OPERACIONAIS', opArray, totalOp, '#dc2626')}
      <tr class="resultado"><td style="padding:12px 8px">= RESULTADO DO PERÍODO</td>
        <td style="padding:12px 8px;text-align:right;color:${resultado >= 0 ? '#16a34a' : '#dc2626'}">${fmt(resultado)}</td></tr>
    </table>
    <p class="footer">DRE gerado pelo Hexx Hub Digital · Baseado em lançamentos pagos/recebidos no período.</p>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    win?.addEventListener('load', () => setTimeout(() => win.print(), 300));
  }

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  type DRESection = { title: string; items: Lancamento[]; total: number; sign: string };
  const sections: DRESection[] = [
    { title: 'Receita bruta', items: receitas, total: totalRec, sign: '' },
    { title: '(−) Impostos', items: impArray, total: totalImp, sign: '−' },
    { title: '(−) Salários e pró-labore', items: salArray, total: totalSal, sign: '−' },
    { title: '(−) Despesas operacionais', items: opArray, total: totalOp, sign: '−' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="rounded-xl border border-line bg-surface-card px-3 py-1.5 text-sm outline-none focus:border-brand-400">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="rounded-xl border border-line bg-surface-card px-3 py-1.5 text-sm outline-none focus:border-brand-400">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button type="button" onClick={exportPDF}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
          <FileText className="h-4 w-4" /> Exportar PDF
        </button>
      </div>

      <div className="card-flat rounded-card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <p className="font-semibold capitalize">{mesLabel}</p>
          <p className="mt-0.5 text-xs text-ink-soft">Baseado em lançamentos marcados como pagos/recebidos no período</p>
        </div>
        <div className="divide-y divide-line">
          {sections.map(sec => (
            <div key={sec.title}>
              <div className={`flex items-center justify-between px-5 py-3 ${sec.sign === '' ? 'bg-ok/5' : 'bg-surface-card border border-line dark:bg-white/3'}`}>
                <p className="text-sm font-semibold">{sec.title}</p>
                <p className={`font-semibold ${sec.sign === '' ? 'text-ok' : 'text-critical'}`}>
                  {sec.sign} {fmt(sec.total)}
                </p>
              </div>
              {sec.items.map(l => (
                <div key={l.id} className="flex items-center justify-between px-9 py-2 text-sm">
                  <p className="text-ink-soft">{l.descricao}</p>
                  <p className={sec.sign === '' ? 'text-ok' : 'text-critical'}>{sec.sign} {fmt(l.valor)}</p>
                </div>
              ))}
              {sec.items.length === 0 && (
                <p className="px-9 py-1.5 text-xs italic text-ink-soft">Nenhum lançamento</p>
              )}
            </div>
          ))}
          <div className={`flex items-center justify-between px-5 py-4 ${resultado >= 0 ? 'bg-ok/10' : 'bg-critical/10'}`}>
            <p className="font-bold">= Resultado do período</p>
            <p className={`text-xl font-bold ${resultado >= 0 ? 'text-ok' : 'text-critical'}`}>{fmt(resultado)}</p>
          </div>
        </div>
      </div>

      {receitas.length === 0 && despesasPagas.length === 0 && (
        <p className="text-center text-sm text-ink-soft">
          Nenhum lançamento pago/recebido neste período. Marque os lançamentos como pagos para que apareçam aqui.
        </p>
      )}
    </div>
  );
}

// ── FluxoTab ──────────────────────────────────────────────────────────────────

function FluxoTab({ data }: { data: Lancamento[] }) {
  const [saldoInput, setSaldoInput] = useState('');
  const [dias, setDias] = useState(30);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const limite = new Date(hoje); limite.setDate(limite.getDate() + dias);
  const saldoBase = Number(saldoInput.replace(',', '.')) || 0;

  const eventos = useMemo(() =>
    data
      .filter(l => {
        if (l.pago_em) return false;
        const v = new Date(l.vencimento + 'T12:00:00');
        return v >= hoje && v <= limite;
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, dias],
  );

  let saldoAcc = saldoBase;
  const eventosSaldo = eventos.map(l => {
    saldoAcc += l.tipo === 'RECEBER' ? l.valor : -l.valor;
    return { ...l, saldoApos: saldoAcc };
  });

  const saldoFinal = saldoAcc;
  const minSaldo = Math.min(saldoBase, ...eventosSaldo.map(e => e.saldoApos));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-soft whitespace-nowrap">Saldo atual (R$)</span>
          <input value={saldoInput} onChange={e => setSaldoInput(e.target.value)} inputMode="decimal"
            placeholder="0,00"
            className="w-36 rounded-xl border border-line bg-surface-card px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
        </div>
        <div className="flex gap-1">
          {[30, 60, 90].map(d => (
            <button key={d} type="button" onClick={() => setDias(d)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${dias === d ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Saldo atual</p>
          <p className={`mt-1.5 text-xl font-semibold ${saldoBase >= 0 ? '' : 'text-critical'}`}>{fmt(saldoBase)}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Saldo em {dias} dias</p>
          <p className={`mt-1.5 text-xl font-semibold ${saldoFinal >= 0 ? 'text-ok' : 'text-critical'}`}>{fmt(saldoFinal)}</p>
        </div>
        <div className={`rounded-card p-4 ${minSaldo < 0 ? 'bg-critical/5 border border-critical/20' : 'card-flat'}`}>
          <p className="text-xs text-ink-soft">Menor saldo no período</p>
          <p className={`mt-1.5 text-xl font-semibold ${minSaldo >= 0 ? 'text-ok' : 'text-critical'}`}>{fmt(minSaldo)}</p>
          {minSaldo < 0 && <p className="mt-0.5 text-xs text-critical">Atenção: saldo negativo previsto</p>}
        </div>
      </div>

      {eventosSaldo.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-ink-soft">
          <Calendar className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum vencimento pendente nos próximos {dias} dias.</p>
        </div>
      ) : (
        <div className="card-flat rounded-card overflow-hidden">
          <div className="hidden grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 bg-surface-card border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:bg-white/3 sm:grid">
            <span className="w-24">Data</span>
            <span>Descrição</span>
            <span className="w-8" />
            <span className="w-32 text-right">Valor</span>
            <span className="w-36 text-right">Saldo após</span>
          </div>
          <div className="divide-y divide-line">
            {eventosSaldo.map(e => (
              <div key={e.id} className={`grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto_auto] ${e.saldoApos < 0 ? 'bg-critical/3' : ''}`}>
                <span className="hidden w-24 text-xs text-ink-soft sm:block">{fmtDate(e.vencimento)}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.descricao}</p>
                  <p className="text-xs text-ink-soft sm:hidden">{fmtDate(e.vencimento)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {e.tipo === 'PAGAR'
                    ? <ArrowDownRight className="h-4 w-4 text-critical" />
                    : <ArrowUpRight className="h-4 w-4 text-ok" />}
                  <span className={`text-sm font-medium ${e.tipo === 'PAGAR' ? 'text-critical' : 'text-ok'}`}>
                    {e.tipo === 'PAGAR' ? '−' : '+'}{fmt(e.valor)}
                  </span>
                </div>
                <span className="hidden w-8 sm:block" />
                <span className={`hidden w-36 text-right text-sm font-semibold sm:block ${e.saldoApos >= 0 ? 'text-ok' : 'text-critical'}`}>
                  {fmt(e.saldoApos)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-ink-soft">Informe o saldo atual da conta para projetar o saldo acumulado ao longo do período.</p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

type TabKey = 'geral' | 'pagar' | 'receber' | 'conciliacao' | 'impostos' | 'dre' | 'fluxo';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'geral',       label: 'Visão Geral', icon: SquaresFour },
  { key: 'pagar',       label: 'A Pagar', icon: ArrowCircleDown },
  { key: 'receber',     label: 'A Receber', icon: ArrowCircleUp },
  { key: 'impostos',    label: 'Impostos', icon: Percent },
  { key: 'dre',         label: 'DRE', icon: ChartPie },
  { key: 'fluxo',       label: 'Fluxo de Caixa', icon: TrendUp },
  { key: 'conciliacao', label: 'Conciliação', icon: Bank },
];

export function HubFinanceiro({ initialTab = 'geral' }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [data, setData] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const json = await getLancamentos();
      setData(json);
    } catch {
      setLoadError('Falha na conexão com o banco.');
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function refresh() { await load(true); }

  function onAdd(l: Lancamento) { refresh(); }
  function onUpdate(l: Lancamento) { refresh(); }
  function onDelete(id: string) { refresh(); }

  const vencidos = data.filter(l => getStatus(l) === 'vencido').length;

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-card border border-line p-1 dark:bg-white/3">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-surface-card text-brand-600 shadow-sm dark:text-brand-400'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t.label}
              {t.key === 'geral' && vencidos > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-critical text-[10px] font-bold text-white">
                  {vencidos}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || loading}
          title="Atualizar"
          className="rounded-xl border border-line p-2 text-ink-soft transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
        >
          <ArrowsClockwise className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-soft">
          <Spinner className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando dados financeiros…</span>
        </div>
      )}

      {!loading && loadError && (
        <p className="flex items-center gap-2 rounded-xl bg-warn/10 px-4 py-2 text-sm text-warn">
          <WarningCircle className="h-4 w-4 shrink-0" />{loadError}
        </p>
      )}

      {/* Panels */}
      {!loading && (
        <>
          {tab === 'geral'       && <VisaoGeral data={data} />}
          {tab === 'pagar'       && <LancamentosTab tipo="PAGAR"   data={data} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} />}
          {tab === 'receber'     && <LancamentosTab tipo="RECEBER" data={data} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} />}
          {tab === 'impostos'    && <ImpostosTab data={data} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} />}
          {tab === 'dre'         && <DRETab data={data} />}
          {tab === 'fluxo'       && <FluxoTab data={data} />}
          {tab === 'conciliacao' && <Conciliacao data={data} />}
        </>
      )}

    </div>
  );
}
