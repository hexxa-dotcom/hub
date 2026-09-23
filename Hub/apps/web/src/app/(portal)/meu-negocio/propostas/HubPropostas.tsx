'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import {
  Pencil,
  Copy,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Trash2,
  QrCode,
  Plus,
  FileText,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';
import { Card } from '@/components/ui/Card';
import type { PropostaRow } from './actions';
import { savePropostaAction, setPropostaStatusAction, deletePropostaAction } from './actions';

// ── Types ─────────────────────────────────────────────────────────────────────

type PropStatus = 'rascunho' | 'enviada' | 'aprovada' | 'rejeitada' | 'expirada';

type PropostaItem = { id: string; descricao: string; qtd: number; valor: number };

type Proposta = PropostaRow;

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PropStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  rascunho:  { label: 'Rascunho',  cls: 'bg-black/5 text-ink-soft dark:bg-white/10 border border-black/5 dark:border-white/10', icon: Pencil },
  enviada:   { label: 'Enviada',   cls: 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)', icon: Send },
  aprovada:  { label: 'Aprovada',  cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20', icon: XCircle },
  expirada:  { label: 'Expirada',  cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20', icon: Clock },
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fi =
  'w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lb = 'text-caption font-bold text-ink-soft uppercase tracking-wider';

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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-black/5 dark:border-white/5 bg-surface-card p-6 sm:p-8 shadow-(--elev-3) card-finish space-y-5 animate-in fade-in">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
          <h2 className="font-serif font-bold text-lg text-ink">{proposta ? 'Editar Proposta' : 'Nova Proposta Comercial'}</h2>
          <button type="button" onClick={onClose}
            className="tap-target pressable focusable rounded-full p-1.5 text-ink-soft hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={lb}>Cliente *</label>
              <input value={cliente} onChange={e => setCliente(e.target.value)} required placeholder="Nome completo ou empresa" className={`mt-1.5 ${fi}`} />
            </div>
            <div>
              <label className={lb}>Data de Validade *</label>
              <input value={validade} onChange={e => setValidade(e.target.value)} type="date" required className={`mt-1.5 ${fi}`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lb}>Título da Proposta *</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)} required placeholder="Ex.: Prestação de Serviços Contábeis e Fiscais" className={`mt-1.5 ${fi}`} />
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/10">
            <div className="flex items-center justify-between">
              <label className={lb}>Itens / Serviços</label>
              <button type="button" onClick={addItem}
                className="inline-flex items-center gap-1 text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline">
                <Plus className="h-3.5 w-3.5" /> Adicionar Item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                  <input value={item.descricao} onChange={e => updateItem(item.id, 'descricao', e.target.value)}
                    placeholder={`Item ${idx + 1}`} className={fi} />
                  <input value={item.qtd} onChange={e => updateItem(item.id, 'qtd', Number(e.target.value))}
                    type="number" min="1" className="w-16 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime" />
                  <input value={item.valor || ''} onChange={e => updateItem(item.id, 'valor', Number(e.target.value.replace(',', '.')))}
                    inputMode="decimal" placeholder="R$" className="w-28 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime" />
                  <button type="button" onClick={() => removeItem(item.id)} disabled={itens.length === 1}
                    className="rounded-full p-2 text-ink-soft hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <p className="font-serif font-bold text-base text-ink tabular">Total: {BRL.format(total)}</p>
            </div>
          </div>

          <div>
            <label className={lb}>Observações &amp; Condições (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Condições de pagamento, prazos de entrega, etc." className={`mt-1.5 ${fi} resize-none`} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-full border border-black/5 dark:border-white/5 bg-surface-card text-ink-soft hover:text-ink shadow-(--elev-1) py-2.5 text-xs font-bold transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 py-2.5 text-xs font-bold transition-all disabled:opacity-60">
              {saving ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin"/> Salvando...</span> : proposta ? 'Salvar Alterações' : 'Criar Proposta'}
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card level={1} className="card-finish p-5">
          <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Total de Propostas</p>
          <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-ink tabular">{propostas.length}</p>
        </Card>
        <Card level={1} className="card-finish p-5">
          <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Aprovadas</p>
          <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-emerald-600 dark:text-emerald-400 tabular">{aprovadas.length}</p>
          <p className="mt-0.5 text-caption text-ink-soft tabular">{BRL.format(valorAprovado)}</p>
        </Card>
        <Card level={1} className="card-finish p-5">
          <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Em Negociação</p>
          <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-hexxa-green dark:text-hexxa-lime tabular">{emNeg.length}</p>
          <p className="mt-0.5 text-caption text-ink-soft tabular">{BRL.format(valorNeg)}</p>
        </Card>
        <Card level={1} className="card-finish p-5">
          <p className="text-caption font-bold uppercase tracking-wider text-ink-soft">Taxa de Conversão</p>
          <p className="mt-2 font-serif font-bold text-2xl sm:text-3xl text-ink tabular">
            {propostas.filter(p => p.status !== 'rascunho').length > 0
              ? `${Math.round((aprovadas.length / propostas.filter(p => p.status !== 'rascunho').length) * 100)}%`
              : '—'}
          </p>
        </Card>
      </div>

      {/* Filters + new */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltrosEmTexto
          filtros={statusBtns.map(s => ({ id: s.key, label: s.label }))}
          ativo={statusFilter}
          onChange={setStatusFilter}
        />
        <button
          type="button"
          onClick={() => setModal({ open: true, editId: null })}
          className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold transition-all"
        >
          <Plus className="h-4 w-4" /> Nova Proposta
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-ink-soft">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhuma proposta encontrada com este filtro.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) card-finish divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
          {filtered.map(p => {
            const st = STATUS_CONFIG[p.status];
            const StatusIcon = st.icon;
            const isExp = expanded === p.id;
            const total = totalProposta(p);
            const expirado = new Date(p.validade) < new Date() && p.status !== 'aprovada' && p.status !== 'rejeitada';

            return (
              <div key={p.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExp ? null : p.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-ink-soft">{p.numero}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>
                        <StatusIcon className="h-3 w-3" />{st.label}
                      </span>
                      {expirado && p.status === 'enviada' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="h-3 w-3" /> Validade expirada
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-serif font-bold text-sm text-ink">{p.titulo}</p>
                    <p className="text-xs text-ink-soft">{p.cliente} · válida até {fmtDate(p.validade)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif font-bold text-sm sm:text-base text-ink tabular">{BRL.format(total)}</p>
                    <p className="text-xs text-ink-soft tabular">{p.itens.length} item(ns)</p>
                  </div>
                  {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />}
                </button>

                {isExp && (
                  <div className="mx-5 mb-4 space-y-4 rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-5">
                    {/* Items table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="text-left text-caption font-bold text-ink-soft uppercase tracking-wider">
                            <th className="pb-2">Descrição</th>
                            <th className="pb-2 text-center w-12">Qtd</th>
                            <th className="pb-2 text-right w-28">Unitário</th>
                            <th className="pb-2 text-right w-28">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/10">
                          {p.itens.map(i => (
                            <tr key={i.id}>
                              <td className="py-2.5 font-medium text-ink">{i.descricao}</td>
                              <td className="py-2.5 text-center text-ink-soft tabular">{i.qtd}</td>
                              <td className="py-2.5 text-right text-ink-soft tabular">{BRL.format(i.valor)}</td>
                              <td className="py-2.5 text-right font-bold text-ink tabular">{BRL.format(i.qtd * i.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-black/10 dark:border-white/10 font-bold">
                            <td colSpan={3} className="pt-3 uppercase text-caption tracking-wider text-ink-soft">Total da Proposta</td>
                            <td className="pt-3 text-right font-serif text-base text-ink tabular">{BRL.format(total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {p.obs && <p className="text-xs text-ink-soft italic">"{p.obs}"</p>}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-black/5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setModal({ open: true, editId: p.id })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-1) px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      {p.status === 'rascunho' && (
                        <button
                          type="button"
                          onClick={() => setStatus(p.id, 'enviada')}
                          className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-4 py-1.5 text-xs font-bold transition-all"
                        >
                          <Send className="h-3.5 w-3.5" /> Marcar como Enviada
                        </button>
                      )}
                      {p.status === 'enviada' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setStatus(p.id, 'aprovada')}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-4 py-1.5 text-xs font-bold"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovada
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(p.id, 'rejeitada')}
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-4 py-1.5 text-xs font-bold"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Rejeitada
                          </button>
                        </>
                      )}
                      {p.status === 'aprovada' && (
                        <>
                          <a
                            href="/meu-negocio/fiscal"
                            className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-1) hover:brightness-110 active:scale-95 px-4 py-1.5 text-xs font-bold transition-all"
                          >
                            <ArrowRight className="h-3.5 w-3.5" /> Emitir NF
                          </a>
                          <button
                            type="button"
                            onClick={() => setPixModal({ open: true, propostaId: p.id })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) px-4 py-1.5 text-xs font-bold"
                          >
                            <QrCode className="h-3.5 w-3.5" /> Cobrança PIX
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteProposta(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10 ml-auto transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
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

