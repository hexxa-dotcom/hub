'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilSimple, Copy, CaretDown, CaretUp, ArrowRight, Trash, QrCode, Plus, FileText, Clock, PaperPlaneRight, CheckCircle, XCircle, X, Spinner } from '@phosphor-icons/react';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';
import type { PropostaRow } from './actions';
import { savePropostaAction, setPropostaStatusAction, deletePropostaAction } from './actions';

// ── Types ─────────────────────────────────────────────────────────────────────

type PropStatus = 'rascunho' | 'enviada' | 'aprovada' | 'rejeitada' | 'expirada';

type PropostaItem = { id: string; descricao: string; qtd: number; valor: number };

type Proposta = PropostaRow;

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PropStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  rascunho:  { label: 'Rascunho',  cls: 'bg-ink/10 text-ink-soft',          icon: PencilSimple },
  enviada:   { label: 'Enviada',   cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400', icon: PaperPlaneRight },
  aprovada:  { label: 'Aprovada',  cls: 'bg-ok/10 text-ok',                  icon: CheckCircle },
  rejeitada: { label: 'Rejeitada', cls: 'bg-critical/10 text-critical',      icon: XCircle },
  expirada:  { label: 'Expirada',  cls: 'bg-warn/10 text-warn',              icon: Clock },
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fi = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lb = 'text-xs font-medium text-ink-soft';

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function totalProposta(p: Proposta) {
  return p.itens.reduce((s, i) => s + i.qtd * i.valor, 0);
}

// ── Modal Nova Proposta ───────────────────────────────────────────────────────

function ModalProposta({
  proposta, onSaved, onClose, nextNumero,
}: {
  proposta: Proposta | null;
  onSaved: () => void;
  onClose: () => void;
  nextNumero: string;
}) {
  const [cliente, setCliente] = useState(proposta?.cliente ?? '');
  const [titulo, setTitulo] = useState(proposta?.titulo ?? '');
  const [validade, setValidade] = useState(proposta?.validade ?? '');
  const [obs, setObs] = useState(proposta?.obs ?? '');
  const [itens, setItens] = useState<PropostaItem[]>(
    proposta?.itens ?? [{ id: '1', descricao: '', qtd: 1, valor: 0 }],
  );
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItens(prev => [...prev, { id: Date.now().toString(), descricao: '', qtd: 1, valor: 0 }]);
  }
  function removeItem(id: string) { setItens(prev => prev.filter(i => i.id !== id)); }
  function updateItem(id: string, field: keyof PropostaItem, value: string | number) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await savePropostaAction({
        id: proposta?.id,
        numero: proposta?.numero ?? nextNumero,
        cliente, titulo, validade, obs,
        itens: itens.map(i => ({ descricao: i.descricao, qtd: Number(i.qtd), valor: Number(i.valor) })),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const total = itens.reduce((s, i) => s + Number(i.qtd) * Number(i.valor), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/40 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-line bg-surface-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{proposta ? 'Editar proposta' : 'Nova proposta'}</h2>
          <button type="button" onClick={onClose}
            className="rounded-xl p-1 text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={lb}>Cliente *</label>
              <input value={cliente} onChange={e => setCliente(e.target.value)} required placeholder="Nome do cliente" className={`mt-1 ${fi}`} />
            </div>
            <div>
              <label className={lb}>Validade *</label>
              <input value={validade} onChange={e => setValidade(e.target.value)} type="date" required className={`mt-1 ${fi}`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lb}>Título da proposta *</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)} required placeholder="Ex.: Desenvolvimento de sistema…" className={`mt-1 ${fi}`} />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lb}>Itens / Serviços</label>
              <button type="button" onClick={addItem}
                className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                  <input value={item.descricao} onChange={e => updateItem(item.id, 'descricao', e.target.value)}
                    placeholder={`Item ${idx + 1}`} className={fi} />
                  <input value={item.qtd} onChange={e => updateItem(item.id, 'qtd', Number(e.target.value))}
                    type="number" min="1" className="w-16 rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
                  <input value={item.valor || ''} onChange={e => updateItem(item.id, 'valor', Number(e.target.value.replace(',', '.')))}
                    inputMode="decimal" placeholder="R$" className="w-28 rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
                  <button type="button" onClick={() => removeItem(item.id)} disabled={itens.length === 1}
                    className="rounded-xl p-1.5 text-ink-soft hover:text-critical transition-colors disabled:opacity-30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end">
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Total: {BRL.format(total)}</p>
            </div>
          </div>

          <div>
            <label className={lb}>Observações (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Condições de pagamento, prazo de entrega, etc." className={`mt-1 ${fi} resize-none`} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2 text-sm font-medium hover:bg-surface-hover transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : proposta ? 'Salvar' : 'Criar proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type StatusFilter = PropStatus | 'todas';

export function HubPropostas({ initialPropostas }: { initialPropostas: Proposta[] }) {
  const router = useRouter();
  const propostas = initialPropostas;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [pixModal, setPixModal] = useState<{ open: boolean; propostaId: string | null }>({ open: false, propostaId: null });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = propostas.filter(p => statusFilter === 'todas' || p.status === statusFilter);

  const aprovadas = propostas.filter(p => p.status === 'aprovada');
  const emNeg = propostas.filter(p => p.status === 'enviada');
  const valorAprovado = aprovadas.reduce((s, p) => s + totalProposta(p), 0);
  const valorNeg = emNeg.reduce((s, p) => s + totalProposta(p), 0);

  const nextNumero = `PROP-${new Date().getFullYear()}-${String(propostas.length + 1).padStart(3, '0')}`;

  function handleSaved() {
    setModal({ open: false, editId: null });
    router.refresh();
  }

  async function setStatus(id: string, status: PropStatus) {
    setBusyId(id);
    try {
      await setPropostaStatusAction(id, status);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProposta(id: string) {
    setBusyId(id);
    try {
      await deletePropostaAction(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const editingProposta = modal.editId ? propostas.find(p => p.id === modal.editId) ?? null : null;

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: 'todas', label: `Todas (${propostas.length})` },
    { key: 'rascunho', label: `Rascunhos (${propostas.filter(p => p.status === 'rascunho').length})` },
    { key: 'enviada', label: `Enviadas (${emNeg.length})` },
    { key: 'aprovada', label: `Aprovadas (${aprovadas.length})` },
    { key: 'rejeitada', label: `Rejeitadas (${propostas.filter(p => p.status === 'rejeitada').length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Total de propostas</p>
          <p className="mt-1.5 text-2xl font-semibold">{propostas.length}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Aprovadas</p>
          <p className="mt-1.5 text-2xl font-semibold text-ok">{aprovadas.length}</p>
          <p className="text-xs text-ink-soft">{BRL.format(valorAprovado)}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Em negociação</p>
          <p className="mt-1.5 text-2xl font-semibold text-brand-600 dark:text-brand-400">{emNeg.length}</p>
          <p className="text-xs text-ink-soft">{BRL.format(valorNeg)}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Taxa de aprovação</p>
          <p className="mt-1.5 text-2xl font-semibold">
            {propostas.filter(p => p.status !== 'rascunho').length > 0
              ? `${Math.round((aprovadas.length / propostas.filter(p => p.status !== 'rascunho').length) * 100)}%`
              : '—'}
          </p>
        </div>
      </div>

      {/* Filters + new */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {statusBtns.map(s => (
            <button key={s.key} type="button" onClick={() => setStatusFilter(s.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s.key ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setModal({ open: true, editId: null })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
          <Plus className="h-4 w-4" /> Nova proposta
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-ink-soft">
          <FileText className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhuma proposta com este filtro.</p>
        </div>
      ) : (
        <div className="card-flat rounded-card divide-y divide-line overflow-hidden">
          {filtered.map(p => {
            const st = STATUS_CONFIG[p.status];
            const StatusIcon = st.icon;
            const isExp = expanded === p.id;
            const total = totalProposta(p);
            const expirado = new Date(p.validade) < new Date() && p.status !== 'aprovada' && p.status !== 'rejeitada';

            return (
              <div key={p.id}>
                <button type="button" onClick={() => setExpanded(isExp ? null : p.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-card border border-line dark:hover:bg-white/5 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-ink-soft">{p.numero}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                        <StatusIcon className="h-3 w-3" />{st.label}
                      </span>
                      {expirado && p.status === 'enviada' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">
                          <Clock className="h-3 w-3" /> Validade expirada
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-medium">{p.titulo}</p>
                    <p className="text-xs text-ink-soft">{p.cliente} · válida até {fmtDate(p.validade)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-brand-600 dark:text-brand-400">{BRL.format(total)}</p>
                    <p className="text-xs text-ink-soft">{p.itens.length} item(ns)</p>
                  </div>
                  {isExp ? <CaretUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <CaretDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>

                {isExp && (
                  <div className="mx-4 mb-3 space-y-3 rounded-xl bg-surface-card border border-line p-4 dark:bg-white/5">
                    {/* Items table */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-ink-soft">
                          <th className="pb-1.5">Descrição</th>
                          <th className="pb-1.5 text-center w-12">Qtd</th>
                          <th className="pb-1.5 text-right w-28">Unit.</th>
                          <th className="pb-1.5 text-right w-28">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.itens.map(i => (
                          <tr key={i.id} className="border-t border-line/50">
                            <td className="py-1.5">{i.descricao}</td>
                            <td className="py-1.5 text-center text-ink-soft">{i.qtd}</td>
                            <td className="py-1.5 text-right text-ink-soft">{BRL.format(i.valor)}</td>
                            <td className="py-1.5 text-right font-medium">{BRL.format(i.qtd * i.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-line font-semibold">
                          <td colSpan={3} className="pt-2">Total</td>
                          <td className="pt-2 text-right text-brand-600 dark:text-brand-400">{BRL.format(total)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    {p.obs && <p className="text-xs text-ink-soft italic">"{p.obs}"</p>}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" onClick={() => setModal({ open: true, editId: p.id })}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-ink/10">
                        <PencilSimple className="h-3.5 w-3.5" /> Editar
                      </button>
                      {p.status === 'rascunho' && (
                        <button type="button" onClick={() => setStatus(p.id, 'enviada')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400">
                          <PaperPlaneRight className="h-3.5 w-3.5" /> Marcar como enviada
                        </button>
                      )}
                      {p.status === 'enviada' && (
                        <>
                          <button type="button" onClick={() => setStatus(p.id, 'aprovada')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok hover:bg-ok/20">
                            <CheckCircle className="h-3.5 w-3.5" /> Aprovada
                          </button>
                          <button type="button" onClick={() => setStatus(p.id, 'rejeitada')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-critical/10 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/20">
                            <XCircle className="h-3.5 w-3.5" /> Rejeitada
                          </button>
                        </>
                      )}
                      {p.status === 'aprovada' && (
                        <>
                          <a href="/meu-negocio/notas"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok hover:bg-ok/20">
                            <ArrowRight className="h-3.5 w-3.5" /> Emitir NF
                          </a>
                          <button type="button" onClick={() => setPixModal({ open: true, propostaId: p.id })}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400">
                            <QrCode className="h-3.5 w-3.5" /> Gerar PIX
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => deleteProposta(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-critical/10 hover:text-critical transition-colors">
                        <Trash className="h-3.5 w-3.5" /> Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal.open && (
        <ModalProposta
          proposta={editingProposta}
          nextNumero={nextNumero}
          onSaved={handleSaved}
          onClose={() => setModal({ open: false, editId: null })}
        />
      )}

      {pixModal.open && pixModal.propostaId && (
        <GeneratePixModal
          isOpen={pixModal.open}
          onClose={() => setPixModal({ open: false, propostaId: null })}
          initialCustomerName={propostas.find(p => p.id === pixModal.propostaId)?.cliente || ''}
          initialValue={totalProposta(propostas.find(p => p.id === pixModal.propostaId)!)}
          initialDescription={`Proposta ${propostas.find(p => p.id === pixModal.propostaId)?.numero}`}
        />
      )}
    </div>
  );
}
