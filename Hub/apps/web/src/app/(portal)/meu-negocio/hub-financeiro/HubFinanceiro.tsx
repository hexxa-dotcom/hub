'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Calendar,
  Tag,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  DollarSign,
  LayoutGrid,
  ArrowDownCircle,
  ArrowUpCircle,
  Percent,
  Landmark,
  QrCode,
  Sparkles,
  Paperclip,
  Repeat,
  PauseCircle,
  PlayCircle,
  Users,
} from 'lucide-react';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';
import {
  getLancamentos,
  createLancamento,
  updateLancamentoStatus,
  deleteLancamento,
  getComprovante,
  listRecurringExpenses,
  createRecurringExpense,
  setRecurringExpenseActive,
  deleteRecurringExpense,
  type RecurringExpenseRow,
} from './actions';

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
  temComprovante?: boolean;
  comprovanteNome?: string | null;
  isFixa?: boolean;
  source?: string | null;
  originalAmount?: number | null;
  interest?: number | null;
  discount?: number | null;
  partnerName?: string | null;
  costCenterName?: string | null;
};

type Status = 'pago' | 'vencido' | 'aberto';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] px-3.5 py-2 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

function getStatus(l: Lancamento): Status {
  if (l.pago_em) return 'pago';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(l.vencimento + 'T12:00:00');
  return venc < today ? 'vencido' : 'aberto';
}

const CATEGORIAS_PAGAR = ['Aluguel', 'Salários', 'Fornecedores', 'Impostos', 'Infraestrutura', 'Tecnologia', 'Serviços', 'Outros'];
const CATEGORIAS_RECEBER = ['Serviços', 'Projetos', 'Mensalidade', 'Consultoria', 'Produtos', 'Aluguéis', 'Outros'];

/**
 * Nome do "grupo" pra agregação por categoria. A maioria dos lançamentos
 * automáticos (folha, contrato PJ, provisão de NFSe, despesa fixa) nunca
 * passou pelo formulário manual, então não tem `categoria` real — sem esse
 * fallback por `source`, tudo isso cairia em "Outros" e o resumo por
 * categoria ficaria inútil.
 */
function grupoDe(l: Lancamento): string {
  if (l.categoria && l.categoria !== 'Outros') return l.categoria;
  switch (l.source) {
    case 'PAYROLL':
      return 'Colaboradores (CLT)';
    case 'CONTRACT':
      return l.tipo === 'PAGAR' ? 'Colaboradores (PJ)' : 'Contratos';
    case 'NFSE':
      return l.tipo === 'PAGAR' ? 'Impostos' : 'Notas Fiscais';
    case 'VENDA':
      return 'Faturamento Avulso';
    case 'RECURRING':
      return 'Despesas Fixas';
    case 'API':
      return 'Integração Externa';
    default:
      return 'Outros';
  }
}

const isCurrentMonth = (vencimento: string) => vencimento.slice(0, 7) === new Date().toISOString().slice(0, 7);

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ l }: { l: Lancamento }) {
  const s = getStatus(l);
  const isPagar = l.tipo === 'PAGAR';
  if (s === 'pago') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-2.5 py-0.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]">
        <CheckCircle2 className="h-3 w-3" />
        {isPagar ? 'Pago' : 'Recebido'}
      </span>
    );
  }
  if (s === 'vencido') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/60 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:text-red-300 border border-red-200">
        <AlertTriangle className="h-3 w-3" />
        Vencido
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-200">
      <Clock className="h-3 w-3" />
      Em aberto
    </span>
  );
}

// ── Form inline ───────────────────────────────────────────────────────────────

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
  const [categoriaOutros, setCategoriaOutros] = useState('');
  const [observacao, setObservacao] = useState('');
  const [tipoLancamento, setTipoLancamento] = useState<'UNICO' | 'PARCELADO' | 'RECORRENTE'>('UNICO');
  const [qtdParcelas, setQtdParcelas] = useState(2);
  const [multaJuros, setMultaJuros] = useState('');
  const [desconto, setDesconto] = useState('');
  const [parceiro, setParceiro] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cats = tipo === 'PAGAR' ? CATEGORIAS_PAGAR : CATEGORIAS_RECEBER;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valor || !vencimento) {
      setErr('Preencha descrição, valor e vencimento.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const categoriaFinal = categoria === 'Outros' && categoriaOutros.trim() ? categoriaOutros.trim() : categoria;
      await createLancamento({
        tipo,
        descricao,
        valor: parseFloat(valor.replace(',', '.')),
        vencimento,
        parcelas: tipoLancamento === 'PARCELADO' ? qtdParcelas : 1,
        isInfinite: tipoLancamento === 'RECORRENTE',
        categoria: categoriaFinal || undefined,
        comprovante,
        multaJuros: multaJuros ? parseFloat(multaJuros.replace(',', '.')) : undefined,
        desconto: desconto ? parseFloat(desconto.replace(',', '.')) : undefined,
        parceiro: parceiro.trim() || undefined,
        centroCusto: centroCusto.trim() || undefined,
      });
      onAdd({} as Lancamento);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar no banco de dados.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-[#DFFFAE] bg-[#EFFFD6]/50 dark:bg-[#1E3328]/30 p-5 space-y-4 shadow-sm animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#1E3328] dark:text-[#DFFFAE] flex items-center gap-1.5 font-serif">
          <Sparkles className="h-4 w-4" />
          {tipo === 'PAGAR' ? 'Novo Lançamento de Conta a Pagar' : 'Novo Lançamento de Conta a Receber'}
        </p>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Descrição *</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Aluguel escritório, Licença Software, NF 001…"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Valor (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Vencimento *</label>
          <input
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Multa / Juros (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={multaJuros}
            onChange={(e) => setMultaJuros(e.target.value)}
            placeholder="0,00"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Desconto (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            placeholder="0,00"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={`mt-1 ${field}`}
          >
            <option value="">Sem categoria</option>
            {cats.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {categoria === 'Outros' && (
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Qual despesa? *</label>
            <input
              value={categoriaOutros}
              onChange={(e) => setCategoriaOutros(e.target.value)}
              placeholder="Ex.: Manutenção de equipamento, Correios…"
              className={`mt-1 ${field}`}
            />
            <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Vira uma categoria nova, pra facilitar o DRE nos próximos lançamentos parecidos.</p>
          </div>
        )}
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">{tipo === 'PAGAR' ? 'Fornecedor' : 'Cliente'}</label>
          <input
            value={parceiro}
            onChange={(e) => setParceiro(e.target.value)}
            placeholder={tipo === 'PAGAR' ? 'Nome do Fornecedor...' : 'Nome do Cliente...'}
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Centro de Custo / Projeto</label>
          <input
            value={centroCusto}
            onChange={(e) => setCentroCusto(e.target.value)}
            placeholder="Ex.: Marketing, Reformas..."
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Tipo de Lançamento</label>
          <div className="flex gap-2">
            <select
              value={tipoLancamento}
              onChange={(e) => setTipoLancamento(e.target.value as any)}
              className={`mt-1 ${field} ${tipoLancamento === 'PARCELADO' ? 'w-2/3' : 'w-full'}`}
            >
              <option value="UNICO">Lançamento Único</option>
              <option value="PARCELADO">Parcelado</option>
              <option value="RECORRENTE">Recorrente</option>
            </select>
            {tipoLancamento === 'PARCELADO' && (
              <input
                type="number"
                min="2"
                max="120"
                value={qtdParcelas}
                onChange={(e) => setQtdParcelas(Number(e.target.value))}
                placeholder="2x"
                className={`mt-1 ${field} w-1/3 text-center`}
              />
            )}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Comprovante (opcional)</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
            className={`mt-1 ${field} file:mr-3 file:rounded-full file:border-0 file:bg-[#1E3328] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#DFFFAE] cursor-pointer`}
          />
          <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Foto do recibo, nota ou print do Pix. Máx. 4MB.</p>
        </div>
      </div>

      {err && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-100 dark:bg-red-950/60 p-3 text-xs font-bold text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {err}
        </p>
      )}

      <div className="flex gap-2.5 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Salvar Lançamento
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Resumo por categoria (mês corrente) ─────────────────────────────────────

/** Card compacto de um agregado do mês (Impostos, Colaboradores…), mesmo estilo do card de Despesas Fixas. */
function MesStatCard({
  icon: Icon,
  label,
  hint = 'Neste mês',
  value,
  tone = 'default',
  active = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  value: number;
  tone?: 'default' | 'warn';
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center justify-between gap-4 rounded-3xl border p-5 text-left shadow-sm transition-all ${
        active
          ? 'bg-[#1E3328] border-[#1E3328] text-[#FEFDF3]'
          : 'bg-[#F4EFE4] dark:bg-[#1A201C] border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
      } ${!onClick ? 'cursor-default' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-[#DFFFAE]/20' : tone === 'warn' ? 'bg-amber-100 dark:bg-amber-950/60' : 'bg-[#EFFFD6] dark:bg-[#1E3328]'}`}>
          <Icon className={`h-5 w-5 ${active ? 'text-[#DFFFAE]' : tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'}`} />
        </div>
        <div className="min-w-0">
          <p className={`truncate text-xs font-bold uppercase tracking-wider ${active ? 'text-[#DFFFAE]/80' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>{label}</p>
          <p className={`truncate text-[11px] ${active ? 'text-[#DFFFAE]/70' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>{hint}</p>
        </div>
      </div>
      <p className={`font-serif text-2xl font-bold tabular shrink-0 ${active ? 'text-[#FEFDF3]' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>{fmt(value)}</p>
    </button>
  );
}

/** Barra de chips com o total do mês agregado por categoria — inclui os grupos automáticos (folha, PJ, NFSe…). */
function CategoriaBreakdownRow({ items }: { items: { label: string; total: number }[] }) {
  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-4 shadow-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
        Por categoria — neste mês
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((g) => (
          <span
            key={g.label}
            className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 px-3.5 py-2 text-xs"
          >
            <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{g.label}</span>
            <span className="font-serif font-bold tabular text-[#2F4A3C] dark:text-[#DFFFAE]">{fmt(g.total)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Despesas Fixas (recorrentes) ────────────────────────────────────────────

/** Card-resumo do comprometimento mensal com despesas fixas — clica e filtra a lista abaixo. */
function DespesasFixasCard({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [items, setItems] = useState<RecurringExpenseRow[] | null>(null);

  useEffect(() => {
    listRecurringExpenses().then(setItems).catch(() => setItems([]));
  }, []);

  const ativos = items?.filter((i) => i.active) ?? [];
  const total = ativos.reduce((s, i) => s + i.amount, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-4 rounded-3xl border p-5 text-left shadow-sm transition-all ${
        active
          ? 'bg-[#1E3328] border-[#1E3328] text-[#FEFDF3]'
          : 'bg-[#F4EFE4] dark:bg-[#1A201C] border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-[#DFFFAE]/20' : 'bg-[#EFFFD6] dark:bg-[#1E3328]'}`}>
          <Repeat className={`h-5 w-5 ${active ? 'text-[#DFFFAE]' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'}`} />
        </div>
        <div className="min-w-0">
          <p className={`truncate text-xs font-bold uppercase tracking-wider ${active ? 'text-[#DFFFAE]/80' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
            Despesas Fixas
          </p>
          <p className={`truncate text-[11px] ${active ? 'text-[#DFFFAE]/70' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
            {items === null ? 'Carregando…' : `${ativos.length} ativa${ativos.length === 1 ? '' : 's'} · todo mês`}
          </p>
        </div>
      </div>
      <p className={`font-serif text-2xl font-bold tabular shrink-0 ${active ? 'text-[#DFFFAE]' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>
        {items === null ? '—' : fmt(total)}
      </p>
    </button>
  );
}

function DespesasFixasPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<RecurringExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categoriaOutros, setCategoriaOutros] = useState('');
  const [dueDay, setDueDay] = useState('5');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listRecurringExpenses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valor) {
      setErr('Preencha descrição e valor.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const categoriaFinal = categoria === 'Outros' && categoriaOutros.trim() ? categoriaOutros.trim() : categoria;
      await createRecurringExpense({
        description: descricao,
        amount: parseFloat(valor.replace(',', '.')),
        categoryName: categoriaFinal || null,
        dueDay: Number(dueDay),
      });
      setDescricao('');
      setValor('');
      setCategoria('');
      setCategoriaOutros('');
      setShowForm(false);
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: RecurringExpenseRow) {
    setBusyId(item.id);
    try {
      await setRecurringExpenseActive(item.id, !item.active);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteRecurringExpense(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 space-y-4 shadow-sm animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-1.5 font-serif">
          <Repeat className="h-4 w-4" />
          Despesas Fixas Mensais
        </p>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        Aluguel, softwares, mensalidades — cadastre uma vez e o sistema lança automaticamente todo mês, sem precisar recriar.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-[#6E6A61]">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs font-bold">Carregando…</span>
        </div>
      ) : (
        <div className="space-y-2">
          {items.length === 0 && !showForm && (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] italic py-2">Nenhuma despesa fixa cadastrada ainda.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 p-3 ${!item.active ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{item.description}</p>
                <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                  {fmt(item.amount)} · todo dia {item.dueDay}
                  {item.categoryName ? ` · ${item.categoryName}` : ''}
                  {!item.active ? ' · Pausada' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title={item.active ? 'Pausar' : 'Reativar'}
                  onClick={() => toggleActive(item)}
                  disabled={busyId === item.id}
                  className="rounded-full p-2 text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] transition-colors disabled:opacity-40"
                >
                  {item.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  title="Excluir"
                  onClick={() => handleDelete(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-full p-2 text-[#6E6A61] hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleCreate} className="rounded-2xl border border-[#DFFFAE] bg-[#EFFFD6]/50 dark:bg-[#1E3328]/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Descrição *</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Aluguel do escritório"
                className={`mt-1 ${field}`}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Dia do vencimento *</label>
              <select value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={`mt-1 ${field}`}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`mt-1 ${field}`}>
                <option value="">Sem categoria</option>
                {CATEGORIAS_PAGAR.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {categoria === 'Outros' && (
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Qual despesa? *</label>
                <input
                  value={categoriaOutros}
                  onChange={(e) => setCategoriaOutros(e.target.value)}
                  placeholder="Ex.: Contabilidade, Sistema de gestão…"
                  className={`mt-1 ${field}`}
                />
              </div>
            )}
          </div>
          {err && <p className="text-xs font-bold text-red-700">{err}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61]">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#DFFFAE] bg-[#EFFFD6]/50 dark:bg-[#1E3328]/30 px-4 py-2 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]"
        >
          <Plus className="h-4 w-4" /> Nova despesa fixa
        </button>
      )}
    </div>
  );
}

// ── Tabela de Lançamentos ─────────────────────────────────────────────────────

type FilterTab = 'todos' | 'aberto' | 'vencido' | 'pago' | 'fixas' | 'impostos' | 'colaboradores' | 'contratos' | 'servicos';

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
  const [showFixas, setShowFixas] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedPixLancamento, setSelectedPixLancamento] = useState<Lancamento | null>(null);

  const list = useMemo(() => {
    const base = data.filter((l) => l.tipo === tipo);
    if (filter === 'todos') return base;
    if (filter === 'fixas') return base.filter((l) => l.isFixa);
    if (filter === 'impostos') return base.filter((l) => grupoDe(l) === 'Impostos');
    if (filter === 'colaboradores') return base.filter((l) => grupoDe(l) === 'Colaboradores (CLT)' || grupoDe(l) === 'Colaboradores (PJ)');
    if (filter === 'contratos') return base.filter((l) => ['Contratos', 'Mensalidade'].includes(grupoDe(l)));
    if (filter === 'servicos') return base.filter((l) => ['Serviços', 'Notas Fiscais', 'Faturamento Avulso'].includes(grupoDe(l)));
    return base.filter((l) => getStatus(l) === filter);
  }, [data, tipo, filter]);

  const counts = useMemo(() => {
    const base = data.filter((l) => l.tipo === tipo);
    return {
      todos: base.length,
      aberto: base.filter((l) => getStatus(l) === 'aberto').length,
      vencido: base.filter((l) => getStatus(l) === 'vencido').length,
      pago: base.filter((l) => getStatus(l) === 'pago').length,
      fixas: base.filter((l) => l.isFixa).length,
    };
  }, [data, tipo]);

  // Agregados do mês corrente por categoria — inclui pago e em aberto, é "o
  // que esse mês representa", não só o que ainda falta pagar/receber.
  const categoriaBreakdown = useMemo(() => {
    const base = data.filter((l) => l.tipo === tipo && isCurrentMonth(l.vencimento));
    const groups = new Map<string, number>();
    for (const l of base) {
      groups.set(grupoDe(l), (groups.get(grupoDe(l)) ?? 0) + l.valor);
    }
    return Array.from(groups.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [data, tipo]);

  const impostosMes = categoriaBreakdown.find((g) => g.label === 'Impostos')?.total ?? 0;
  const colaboradoresMes = categoriaBreakdown
    .filter((g) => g.label === 'Colaboradores (CLT)' || g.label === 'Colaboradores (PJ)')
    .reduce((s, g) => s + g.total, 0);

  // Receber aggregations
  const contratosMes = categoriaBreakdown.find((g) => g.label === 'Contratos' || g.label === 'Mensalidade')?.total ?? 0;
  const servicosMes = categoriaBreakdown.filter((g) => g.label === 'Serviços' || g.label === 'Notas Fiscais' || g.label === 'Faturamento Avulso').reduce((s, g) => s + g.total, 0);
  const outrosRecMes = categoriaBreakdown.filter((g) => !['Contratos', 'Mensalidade', 'Serviços', 'Notas Fiscais', 'Faturamento Avulso'].includes(g.label)).reduce((s, g) => s + g.total, 0);

  async function togglePago(l: Lancamento) {
    setMarking(l.id);
    const newStatus = l.statusDb === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await updateLancamentoStatus(l.id, newStatus as any);
      onUpdate({} as Lancamento);
    } finally {
      setMarking(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteLancamento(id);
      onDelete(id);
    } finally {
      setDeleting(null);
    }
  }

  const isPagar = tipo === 'PAGAR';
  const label = isPagar ? 'pagar' : 'receber';

  const filterBtns: { key: FilterTab | string; label: string }[] = [
    { key: 'todos', label: `Todos (${counts.todos})` },
    { key: 'aberto', label: `Em aberto (${counts.aberto})` },
    { key: 'vencido', label: `Vencidos (${counts.vencido})` },
    { key: 'pago', label: isPagar ? `Pagos (${counts.pago})` : `Recebidos (${counts.pago})` },
    ...(isPagar ? [
      { key: 'fixas', label: `Despesas Fixas (${counts.fixas})` },
      { key: 'impostos', label: `Impostos` },
      { key: 'colaboradores', label: `Colaboradores` },
    ] : [
      { key: 'contratos', label: `Mensalidades` },
      { key: 'servicos', label: `Serviços/Avulsos` },
    ]),
  ];

  return (
    <div className="space-y-4">
      {isPagar ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DespesasFixasCard
            active={filter === 'fixas'}
            onClick={() => setFilter(filter === 'fixas' ? 'todos' : 'fixas')}
          />
          <MesStatCard 
            icon={Percent} 
            label="Impostos" 
            value={impostosMes} 
            tone="warn" 
            active={filter === 'impostos'}
            onClick={() => setFilter(filter === 'impostos' ? 'todos' : 'impostos')}
          />
          <MesStatCard 
            icon={Users} 
            label="Colaboradores" 
            hint="PJ + CLT · neste mês" 
            value={colaboradoresMes} 
            tone="default" 
            active={filter === 'colaboradores'}
            onClick={() => setFilter(filter === 'colaboradores' ? 'todos' : 'colaboradores')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MesStatCard 
            icon={Repeat} 
            label="Contratos Mensais" 
            hint="Honorários e Mensalidades"
            value={contratosMes} 
            tone="default" 
            active={filter === 'contratos'}
            onClick={() => setFilter(filter === 'contratos' as any ? 'todos' : 'contratos')}
          />
          <MesStatCard 
            icon={FileText} 
            label="Serviços e Notas" 
            hint="Avulsos · neste mês" 
            value={servicosMes} 
            tone="default" 
            active={filter === 'servicos'}
            onClick={() => setFilter(filter === 'servicos' as any ? 'todos' : 'servicos')}
          />
          <MesStatCard 
            icon={Tag} 
            label="Outras Entradas" 
            hint="Diversos · neste mês" 
            value={outrosRecMes} 
            tone="default" 
          />
        </div>
      )}

      {categoriaBreakdown.length > 0 && (
        <CategoriaBreakdownRow items={categoriaBreakdown} />
      )}

      {/* Header com Filtros & Botões */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filterBtns.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key as FilterTab)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                filter === f.key
                  ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                  : 'border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {isPagar && (
            <button
              type="button"
              onClick={() => setShowFixas((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] px-4 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-colors"
            >
              <Repeat className="h-4 w-4" />
              Despesas Fixas
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105"
          >
            <Plus className="h-4 w-4" />
            Nova conta a {label}
          </button>
        </div>
      </div>

      {isPagar && showFixas && (
        <DespesasFixasPanel onClose={() => setShowFixas(false)} onChanged={() => onUpdate({} as Lancamento)} />
      )}

      {showForm && (
        <LancamentoForm
          tipo={tipo}
          onAdd={(l) => {
            onAdd(l);
            setFilter('todos');
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Tabela de Lançamentos */}
      {list.length === 0 ? (
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-12 text-center text-[#6E6A61] dark:text-[#A8A49C]">
          <DollarSign className="h-8 w-8 mx-auto opacity-30 mb-2" />
          <p className="text-sm font-semibold">Nenhum lançamento encontrado neste filtro.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] shadow-sm">
          <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/20 px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] sm:grid">
            <span>Descrição</span>
            <span className="w-28 text-right">Vencimento</span>
            <span className="w-32 text-right">Valor</span>
            <span className="w-28 text-center">Status</span>
            <span className="w-24 text-center">Ações</span>
          </div>

          <div className="divide-y divide-black/5 dark:divide-white/5">
            {list.map((l) => {
              const s = getStatus(l);
              const isExp = expanded === l.id;
              return (
                <div key={l.id}>
                  <div
                    className={`grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 p-4 sm:px-5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors sm:grid-cols-[1fr_auto_auto_auto_auto] ${
                      s === 'vencido' ? 'border-l-4 border-l-red-500' : s === 'pago' ? 'opacity-65' : ''
                    }`}
                    onClick={() => setExpanded(isExp ? null : l.id)}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {l.tipo === 'PAGAR' ? (
                        <ArrowDownRight className="h-4 w-4 shrink-0 text-red-600" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{l.descricao}</p>
                      {(l.categoria || l.temComprovante || l.isFixa) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                          {l.isFixa && (
                            <span className="inline-flex items-center gap-1 font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
                              <Repeat className="h-3 w-3" />
                              Fixa
                            </span>
                          )}
                          {l.categoria && (
                            <span className="inline-flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {l.categoria}
                            </span>
                          )}
                          {l.temComprovante && (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              Comprovante
                            </span>
                          )}
                        </span>
                      )}
                      <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C] sm:hidden">
                        {fmtDate(l.vencimento)} · <strong>{fmt(l.valor)}</strong>
                      </p>
                    </div>
                  </div>

                    <span className="hidden w-28 text-right text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] sm:block">
                      {fmtDate(l.vencimento)}
                    </span>
                      <span
                      className={`hidden w-32 text-right font-serif text-sm sm:text-base font-bold tabular sm:block ${
                        l.tipo === 'PAGAR' ? 'text-red-700 dark:text-red-400' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'
                      }`}
                    >
                      {fmt(l.valor)}
                    </span>
                    <span className="hidden w-28 text-center sm:block">
                      <StatusBadge l={l} />
                    </span>

                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {l.tipo !== 'PAGAR' && !l.pago_em && (
                        <button
                          type="button"
                          title="Gerar Cobrança Pix"
                          onClick={() => setSelectedPixLancamento(l)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-2.5 py-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]"
                        >
                          <QrCode className="h-3 w-3" /> Pix
                        </button>
                      )}
                      <button
                        type="button"
                        title={l.pago_em ? 'Desfazer' : l.tipo === 'PAGAR' ? 'Marcar como pago' : 'Marcar como recebido'}
                        onClick={() => togglePago(l)}
                        disabled={marking === l.id}
                        className={`rounded-full p-2 transition-colors ${
                          l.pago_em
                            ? 'bg-[#EFFFD6] text-[#2F4A3C]'
                            : 'text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20]'
                        } disabled:opacity-40`}
                      >
                        {marking === l.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => handleDelete(l.id)}
                        disabled={deleting === l.id}
                        className="rounded-full p-2 text-[#6E6A61] hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-40"
                      >
                        {deleting === l.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                      {isExp ? <ChevronUp className="h-4 w-4 text-[#6E6A61]" /> : <ChevronDown className="h-4 w-4 text-[#6E6A61]" />}
                    </div>
                  </div>

                  {isExp && (
                    <div className="border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 p-4 text-xs space-y-2">
                      <div className="flex flex-wrap gap-4">
                        <div><span className="text-[#6E6A61]">Categoria:</span> <strong>{l.categoria ?? '—'}</strong></div>
                        {l.partnerName && <div><span className="text-[#6E6A61]">{l.tipo === 'PAGAR' ? 'Fornecedor:' : 'Cliente:'}</span> <strong>{l.partnerName}</strong></div>}
                        {l.costCenterName && <div><span className="text-[#6E6A61]">Centro de Custo:</span> <strong>{l.costCenterName}</strong></div>}
                        {l.interest && l.interest > 0 ? <div><span className="text-[#6E6A61]">Multa/Juros:</span> <strong>{fmt(l.interest)}</strong></div> : null}
                        {l.discount && l.discount > 0 ? <div><span className="text-[#6E6A61]">Desconto:</span> <strong>{fmt(l.discount)}</strong></div> : null}
                        <div><span className="text-[#6E6A61]">Criado em:</span> <strong>{fmtDate(l.created_at.split('T')[0]!)}</strong></div>
                        {l.pago_em && <div><span className="text-[#6E6A61]">{l.tipo === 'PAGAR' ? 'Pago em:' : 'Recebido em:'}</span> <strong>{fmtDate(l.pago_em)}</strong></div>}
                        {l.observacao && <div className="w-full"><span className="text-[#6E6A61]">Observações:</span> {l.observacao}</div>}
                        {l.temComprovante && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const c = await getComprovante(l.id);
                              if (c) window.open(c.dataUrl, '_blank');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#EFFFD6] dark:bg-[#1E3328] px-3 py-1 text-[11px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE] border border-[#DFFFAE]"
                          >
                            <Paperclip className="h-3 w-3" /> Ver comprovante{l.comprovanteNome ? `: ${l.comprovanteNome}` : ''}
                          </button>
                        )}
                        <div className="sm:hidden"><StatusBadge l={l} /></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedPixLancamento && (
        <GeneratePixModal
          isOpen={true}
          onClose={() => setSelectedPixLancamento(null)}
          initialValue={selectedPixLancamento.valor}
          initialDescription={selectedPixLancamento.descricao}
          financialEntryId={selectedPixLancamento.id}
        />
      )}
    </div>
  );
}

// ── Visão Geral ───────────────────────────────────────────────────────────────

const COMPOSICAO_COLORS = ['#2F4A3C', '#A2C1CD', '#5F6E46', '#8FA85B'];
const COMPOSICAO_OUTROS = '#C5BBAA';

/** Agrupa os lançamentos do mês por origem (grupoDe) — mesma lógica do dashboard do cliente. */
function buildComposicao(itens: Lancamento[]) {
  const byGrupo = new Map<string, number>();
  for (const l of itens) byGrupo.set(grupoDe(l), (byGrupo.get(grupoDe(l)) ?? 0) + l.valor);
  const total = [...byGrupo.values()].reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  const sorted = [...byGrupo.entries()].sort(([, a], [, b]) => b - a);
  const top = sorted.slice(0, COMPOSICAO_COLORS.length);
  const tail = sorted.slice(COMPOSICAO_COLORS.length);
  const items = top.map(([label, value], i) => ({ label, value, pct: (value / total) * 100, color: COMPOSICAO_COLORS[i]! }));
  const tailSum = tail.reduce((s, [, v]) => s + v, 0);
  if (tailSum > 0) items.push({ label: 'Outros', value: tailSum, pct: (tailSum / total) * 100, color: COMPOSICAO_OUTROS });
  return items;
}

/** Mini-composição por origem (receitas ou despesas) — barra empilhada + lista. */
function ComposicaoCard({ title, items, emptyLabel }: { title: string; items: ReturnType<typeof buildComposicao>; emptyLabel: string }) {
  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 sm:p-6 shadow-sm">
      <p className="mb-4 font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{title}</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">{emptyLabel}</p>
      ) : (
        <div className="space-y-3.5">
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
            {items.map((c) => (
              <div
                key={c.label}
                title={`${c.label}: ${c.pct.toFixed(0)}%`}
                className="h-full min-w-[6px] first:rounded-l-full last:rounded-r-full transition-[flex-grow] duration-500"
                style={{ flexGrow: c.pct, flexBasis: 0, background: c.color }}
              />
            ))}
          </div>
          <ul className="space-y-2 text-xs">
            {items.map((c) => (
              <li key={c.label} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 truncate text-[#6E6A61] dark:text-[#A8A49C]">{c.label}</span>
                <span className="tabular font-bold text-[#231F20] dark:text-[#FEFDF3]">{fmt(c.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VisaoGeral({ data, onNavigate }: { data: Lancamento[]; onNavigate: (tab: 'pagar' | 'receber') => void }) {
  const [showDre, setShowDre] = useState(false);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);

  const totalPagar = data.filter((l) => l.tipo === 'PAGAR' && !l.pago_em).reduce((s, l) => s + l.valor, 0);
  const totalReceber = data.filter((l) => l.tipo === 'RECEBER' && !l.pago_em).reduce((s, l) => s + l.valor, 0);
  const vencidos = data.filter((l) => getStatus(l) === 'vencido');
  const saldo = totalReceber - totalPagar;

  const [fixas, setFixas] = useState<RecurringExpenseRow[] | null>(null);
  useEffect(() => {
    listRecurringExpenses().then(setFixas).catch(() => setFixas([]));
  }, []);
  const totalFixas = (fixas ?? []).filter((f) => f.active).reduce((s, f) => s + f.amount, 0);

  const receberMes = data.filter((l) => l.tipo === 'RECEBER' && isCurrentMonth(l.vencimento));
  const pagarMes = data.filter((l) => l.tipo === 'PAGAR' && isCurrentMonth(l.vencimento));
  const composicaoReceitas = buildComposicao(receberMes);
  const composicaoDespesas = buildComposicao(pagarMes);

  const proximos = data
    .filter((l) => {
      if (l.pago_em) return false;
      const v = new Date(l.vencimento + 'T12:00:00');
      return v >= today && v <= in7;
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  // Fluxo: 4 semanas
  const weeks: { label: string; pagar: number; receber: number }[] = [];
  for (let w = 0; w < 4; w++) {
    const start = new Date(today);
    start.setDate(start.getDate() + w * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const label = `Semana ${w + 1}`;
    const pagar = data
      .filter((l) => {
        if (l.tipo !== 'PAGAR' || l.pago_em) return false;
        const v = new Date(l.vencimento + 'T12:00:00');
        return v >= start && v <= end;
      })
      .reduce((s, l) => s + l.valor, 0);
    const receber = data
      .filter((l) => {
        if (l.tipo !== 'RECEBER' || l.pago_em) return false;
        const v = new Date(l.vencimento + 'T12:00:00');
        return v >= start && v <= end;
      })
      .reduce((s, l) => s + l.valor, 0);
    weeks.push({ label, pagar, receber });
  }
  const maxWeek = Math.max(...weeks.flatMap((w) => [w.pagar, w.receber]), 1);

  return (
    <div className="space-y-6">
      {/* 4 Cards de Resumo */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('pagar')}
          className="text-left rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm hover:border-black/10 dark:hover:border-white/20 hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">A Pagar (Aberto)</p>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-red-700 dark:text-red-400 tabular">{fmt(totalPagar)}</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('receber')}
          className="text-left rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-5 shadow-sm hover:border-black/10 dark:hover:border-white/20 hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">A Receber (Aberto)</p>
            <TrendingUp className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-[#2F4A3C] dark:text-[#DFFFAE] tabular">{fmt(totalReceber)}</p>
        </button>

        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#1E3328] text-[#FEFDF3] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#DFFFAE]/80">Saldo Projetado</p>
            <Wallet className="h-4 w-4 text-[#DFFFAE]" />
          </div>
          <p className={`mt-2 font-serif text-2xl font-bold tabular ${saldo >= 0 ? 'text-[#DFFFAE]' : 'text-red-300'}`}>
            {fmt(saldo)}
          </p>
        </div>

        <div className={`rounded-3xl border p-5 shadow-sm ${vencidos.length > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900/40' : 'border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C]'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Vencidos</p>
            <AlertTriangle className={`h-4 w-4 ${vencidos.length > 0 ? 'text-red-600' : 'text-[#6E6A61]'}`} />
          </div>
          <p className={`mt-2 font-serif text-2xl font-bold ${vencidos.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>
            {vencidos.length}
          </p>
        </div>
      </div>

      {/* Composição do mês + Despesas Fixas */}
      <div>
        <div className="mb-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Composição do Mês</h3>
            <button
              type="button"
              onClick={() => setShowDre(true)}
              className="flex items-center gap-2 rounded-2xl bg-[#1E3328] px-3 py-1.5 text-xs font-bold text-[#DFFFAE] hover:bg-[#2F4A3C] transition-colors shadow-sm"
            >
              <FileText className="h-3.5 w-3.5" />
              Visualizar DRE
            </button>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('pagar')}
            className="flex items-center gap-2 rounded-2xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] px-4 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Repeat className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            Despesas Fixas
            <span className="font-serif font-bold tabular text-[#231F20] dark:text-[#FEFDF3]">{fmt(totalFixas)}</span>
          </button>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ComposicaoCard title="Receitas por origem" items={composicaoReceitas} emptyLabel="Sem recebíveis lançados neste mês." />
          <ComposicaoCard title="Despesas por origem" items={composicaoDespesas} emptyLabel="Sem despesas lançadas neste mês." />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próximos 7 dias */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 shadow-sm">
          <p className="mb-4 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Vencimentos nos Próximos 7 Dias</p>
          {proximos.length === 0 ? (
            <p className="py-8 text-center text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">Nenhum vencimento pendente nos próximos 7 dias. Tudo em dia!</p>
          ) : (
            <div className="space-y-2.5">
              {proximos.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{l.descricao}</p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{fmtDate(l.vencimento)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.tipo === 'PAGAR' ? (
                      <ArrowDownRight className="h-4 w-4 text-red-600" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-[#2F4A3C]" />
                    )}
                    <span className={`text-sm font-bold tabular ${l.tipo === 'PAGAR' ? 'text-red-700 dark:text-red-400' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'}`}>
                      {fmt(l.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fluxo previsto 4 semanas */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 shadow-sm">
          <p className="mb-4 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Fluxo Previsto (Próximas 4 Semanas)</p>
          <div className="flex items-end gap-3 h-36 pt-4">
            {weeks.map((w) => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full items-end gap-1.5 h-24">
                  <div
                    title={`A pagar: ${fmt(w.pagar)}`}
                    className="flex-1 rounded-t-xl bg-red-400/80 transition-all"
                    style={{ height: `${w.pagar ? (w.pagar / maxWeek) * 100 : 0}%` }}
                  />
                  <div
                    title={`A receber: ${fmt(w.receber)}`}
                    className="flex-1 rounded-t-xl bg-[#2F4A3C] dark:bg-[#DFFFAE] transition-all"
                    style={{ height: `${w.receber ? (w.receber / maxWeek) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">{w.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center gap-6 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" /> A pagar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2F4A3C] dark:bg-[#DFFFAE] inline-block" /> A receber
            </span>
          </div>
        </div>
      </div>

      {showDre && <DreModal data={data} onClose={() => setShowDre(false)} />}
    </div>
  );
}

// ── Main Hub Financeiro Component ───────────────────────────────────────────

type TabKey = 'geral' | 'pagar' | 'receber';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'geral', label: 'Visão Geral', icon: LayoutGrid },
  { key: 'pagar', label: 'Contas a Pagar', icon: ArrowDownCircle },
  { key: 'receber', label: 'Contas a Receber', icon: ArrowUpCircle },
];

// ── DRE Modal ───────────────────────────────────────────────────────────────

function DreModal({ data, onClose }: { data: Lancamento[]; onClose: () => void }) {
  const filterCurrentMonth = data.filter(l => isCurrentMonth(l.vencimento));
  
  const receitas = filterCurrentMonth.filter(l => l.tipo === 'RECEBER').reduce((s, l) => s + l.valor, 0);
  const impostos = filterCurrentMonth.filter(l => l.tipo === 'PAGAR' && grupoDe(l) === 'Impostos').reduce((s, l) => s + l.valor, 0);
  const receitaLiquida = receitas - impostos;
  
  const fixasFilter = (l: Lancamento) => l.tipo === 'PAGAR' && (
    grupoDe(l) === 'Aluguel/Imóvel' || 
    grupoDe(l) === 'Contabilidade' || 
    grupoDe(l) === 'Tecnologia/Sistemas' || 
    grupoDe(l).startsWith('Colaboradores')
  );
  
  const despesasFixas = filterCurrentMonth.filter(fixasFilter).reduce((s, l) => s + l.valor, 0);
  const despesasVariaveis = filterCurrentMonth.filter(l => l.tipo === 'PAGAR' && grupoDe(l) !== 'Impostos' && !fixasFilter(l)).reduce((s, l) => s + l.valor, 0);

  const ebitda = receitaLiquida - despesasFixas - despesasVariaveis;
  const lucroLiquido = ebitda; 

  const row = "flex justify-between items-center py-2.5 border-b border-black/5 dark:border-white/5 last:border-0";
  const label = "text-sm text-[#6E6A61] dark:text-[#A8A49C]";
  const val = "text-sm font-bold tabular text-[#231F20] dark:text-[#FEFDF3]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-up">
      <div className="bg-[#F4EFE4] dark:bg-[#1A201C] w-full max-w-lg rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/20">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#1E3328] text-[#DFFFAE] p-2 rounded-2xl shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-[#231F20] dark:text-[#FEFDF3]">
              DRE Gerencial (Neste Mês)
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-[#6E6A61] hover:text-[#231F20] dark:hover:bg-black/5 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-white/80 dark:bg-black/40 rounded-2xl border border-black/5 dark:border-white/10 p-5 shadow-sm space-y-1">
            <div className={row}>
              <span className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Receita Bruta (Faturamento)</span>
              <span className="text-sm font-bold tabular text-[#2F4A3C] dark:text-[#DFFFAE]">{fmt(receitas)}</span>
            </div>
            <div className={row}>
              <span className={label}>(-) Impostos Incorridos</span>
              <span className="text-sm tabular text-red-600 dark:text-red-400">{fmt(impostos)}</span>
            </div>
            <div className={`${row} bg-black/5 dark:bg-white/5 -mx-5 px-5`}>
              <span className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">(=) Receita Líquida</span>
              <span className={val}>{fmt(receitaLiquida)}</span>
            </div>
            <div className={row}>
              <span className={label}>(-) Despesas Operacionais Fixas</span>
              <span className="text-sm tabular text-red-600 dark:text-red-400">{fmt(despesasFixas)}</span>
            </div>
            <div className={row}>
              <span className={label}>(-) Despesas Operacionais Variáveis</span>
              <span className="text-sm tabular text-red-600 dark:text-red-400">{fmt(despesasVariaveis)}</span>
            </div>
            <div className={`${row} bg-black/5 dark:bg-white/5 -mx-5 px-5`}>
              <span className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">(=) Lucro Operacional (EBITDA)</span>
              <span className={`text-sm font-bold tabular ${ebitda >= 0 ? 'text-[#2F4A3C] dark:text-[#DFFFAE]' : 'text-red-600 dark:text-red-400'}`}>{fmt(ebitda)}</span>
            </div>
            <div className={`${row} border-t-2 border-black/10 dark:border-white/20 mt-2`}>
              <span className="text-base font-serif font-bold text-[#231F20] dark:text-[#FEFDF3]">Lucro Líquido Distribuível</span>
              <span className={`text-base font-serif font-bold tabular ${lucroLiquido >= 0 ? 'text-[#2F4A3C] dark:text-[#DFFFAE]' : 'text-red-600 dark:text-red-400'}`}>{fmt(lucroLiquido)}</span>
            </div>
          </div>
          
          <p className="mt-4 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            O DRE Gerencial demonstra o resultado econômico da empresa baseado no regime de competência/caixa simulado pelo mês atual.
          </p>
        </div>
      </div>
    </div>
  );
}

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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    await load(true);
  }

  const vencidos = data.filter((l) => getStatus(l) === 'vencido').length;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          tabs={[
            { id: 'geral', label: 'Visão Geral', icon: LayoutGrid },
            {
              id: 'pagar',
              label: 'Contas a Pagar',
              icon: ArrowDownCircle,
              badge: vencidos > 0 ? (
                <span className="rounded-full bg-red-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                  {vencidos}
                </span>
              ) : undefined,
            },
            { id: 'receber', label: 'Contas a Receber', icon: ArrowUpCircle },
          ]}
          activeTab={tab}
          onChange={setTab}
          layoutId="financeiroTabsIndicator"
        />

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || loading}
          title="Atualizar"
          className="rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-2.5 text-[#6E6A61] hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center gap-2.5 py-16 text-[#6E6A61]">
          <Loader2 className="h-5 w-5 animate-spin text-[#2F4A3C]" />
          <span className="text-sm font-bold">Carregando dados financeiros…</span>
        </div>
      )}

      {!loading && loadError && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-100 p-4 text-xs font-bold text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </p>
      )}

      {!loading && (
        <>
          {tab === 'geral' && <VisaoGeral data={data} onNavigate={setTab} />}
          {tab === 'pagar' && <LancamentosTab tipo="PAGAR" data={data} onAdd={refresh} onUpdate={refresh} onDelete={refresh} />}
          {tab === 'receber' && <LancamentosTab tipo="RECEBER" data={data} onAdd={refresh} onUpdate={refresh} onDelete={refresh} />}
        </>
      )}
    </div>
  );
}
