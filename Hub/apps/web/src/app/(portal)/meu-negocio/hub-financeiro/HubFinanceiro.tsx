'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { GraficoEntradasSaidas, periodosPorDia } from '@/components/ui/GraficoEntradasSaidas';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { Card, CardHeader, Metric } from '@/components/ui/Card';
import { twMerge } from 'tailwind-merge';
import { SectionHero } from '@/components/ui/SectionHero';
import { FinanceiroMonthSelector } from './FinanceiroMonthSelector';
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
  listCategorias,
  type RecurringExpenseRow,
} from './actions';

// ── Types ────────────────────────────────────────────────────────────────────

type Categoria = {
  id: string;
  name: string;
  kind: 'INCOME' | 'EXPENSE';
  accountingCode: string | null;
  accountingGroup: string | null;
};

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
  sourceId?: string | null;
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
  'w-full rounded-2xl bg-surface-card shadow-(--elev-inset) px-3.5 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';

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
    case 'INTEGRATION_SAAS':
      // Repasse automático (ex.: médico de SaaS de telemedicina) — mesmo grupo
      // de "Colaboradores (PJ)" pro filtro já existente enxergar sem precisar
      // de uma pílula nova; do lado RECEBER é a receita bruta vinda da integração.
      return l.tipo === 'PAGAR' ? 'Colaboradores (PJ)' : 'Faturamento Avulso';
    case 'CONTRACT_EXTRA':
      return 'Colaboradores (PJ)';
    case 'NFSE':
      return l.tipo === 'PAGAR' ? 'Impostos' : 'Notas Fiscais';
    case 'VENDA':
      return 'Faturamento Avulso';
    case 'DFE_SYNC':
      // Nota emitida por fora do Hub (ex: sistema próprio do município),
      // sincronizada da Distribuição de DF-e do governo — mesmo grupo de
      // "Notas Fiscais" porque é exatamente isso: já tem nota emitida.
      return 'Notas Fiscais';
    case 'RECURRING':
      return 'Despesas Fixas';
    case 'API':
      return 'Integração Externa';
    default:
      return 'Outros';
  }
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

/** Filtro de mês compartilhado entre as abas — 'todos' devolve tudo, sem recorte de período. */
type MonthFilter = string | 'todos';
const matchesMonth = (vencimento: string, mes: MonthFilter) => mes === 'todos' || vencimento.slice(0, 7) === mes;
const mesLabel = (mes: MonthFilter) => {
  if (mes === 'todos') return 'Todos os períodos';
  if (mes === currentMonth()) return 'Este Mês';
  const [ano, m] = mes.split('-');
  const d = new Date(Number(ano), Number(m) - 1, 1);
  return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
};

function addMonths(yearMonth: string, delta: number): string {
  if (yearMonth === 'todos') {
    yearMonth = currentMonth();
  }
  const parts = yearMonth.split('-');
  const y = Number(parts[0]) || new Date().getFullYear();
  const m = Number(parts[1]) || (new Date().getMonth() + 1);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getFormattedMonth(mes: MonthFilter): string {
  if (mes === 'todos') return 'Todos os períodos';
  const parts = mes.split('-');
  const y = parts[0] ?? '';
  const monthIdx = parseInt(parts[1] ?? '1', 10) - 1;
  return `${MONTH_NAMES[monthIdx] ?? parts[1]} de ${y}`;
}

/**
 * URL do contrato de origem, quando este lançamento veio de um (contrato
 * manual, repasse automático de integração, ou pagamento extra vinculado a
 * um contrato) — null quando não há contrato por trás (NFSe, despesa fixa
 * etc.), ou quando é a receita bruta da integração (sourceId aponta pra
 * credencial da integração, não pra um contrato).
 */
function contratoLinkFor(l: Lancamento): string | null {
  if (!l.sourceId) return null;
  if (l.source === 'CONTRACT' || l.source === 'CONTRACT_EXTRA') return `/meu-negocio/contratos/${l.sourceId}`;
  if (l.source === 'INTEGRATION_SAAS' && l.tipo === 'PAGAR') return `/meu-negocio/contratos/${l.sourceId}`;
  return null;
}

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

const CATEGORIA_OUTROS = '__outros__';

function LancamentoForm({
  tipo,
  categorias,
  onAdd,
  onClose,
  defaultCategoria,
}: {
  tipo: 'PAGAR' | 'RECEBER';
  categorias: Categoria[];
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

  // Categorias do plano de contas (Anexo 7 ITG 1000) filtradas pelo tipo do
  // lançamento — pagar usa despesa (EXPENSE), receber usa receita (INCOME).
  // Agrupadas por accountingGroup pra ficar navegável com quase 80 opções.
  const kind = tipo === 'PAGAR' ? 'EXPENSE' : 'INCOME';
  const cats = categorias.filter((c) => c.kind === kind);
  const catsByGroup = useMemo(() => {
    const groups = new Map<string, Categoria[]>();
    for (const c of cats) {
      const g = c.accountingGroup ?? 'Outras';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(c);
    }
    return groups;
  }, [cats]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valor || !vencimento) {
      setErr('Preencha descrição, valor e vencimento.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const isOutros = categoria === CATEGORIA_OUTROS;
      await createLancamento({
        tipo,
        descricao,
        valor: parseFloat(valor.replace(',', '.')),
        vencimento,
        parcelas: tipoLancamento === 'PARCELADO' ? qtdParcelas : 1,
        isInfinite: tipoLancamento === 'RECORRENTE',
        categoriaId: !isOutros && categoria ? categoria : undefined,
        categoria: isOutros && categoriaOutros.trim() ? categoriaOutros.trim() : undefined,
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
    <form onSubmit={handleSubmit} className="rounded-3xl bg-surface-card shadow-(--elev-2) p-5 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink flex items-center gap-1.5 font-serif">
          <Sparkles className="h-4 w-4 text-hexxa-green dark:text-hexxa-lime" />
          {tipo === 'PAGAR' ? 'Novo Lançamento de Conta a Pagar' : 'Novo Lançamento de Conta a Receber'}
        </p>
        <button type="button" onClick={onClose} className="tap-target pressable focusable rounded-full p-1 text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10">
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
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Categoria (plano de contas)</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={`mt-1 ${field}`}
          >
            <option value="">Sem categoria</option>
            {[...catsByGroup.entries()].map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.accountingCode ? `${c.accountingCode} — ${c.name}` : c.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={CATEGORIA_OUTROS}>Outros (categoria nova)</option>
          </select>
        </div>
        {categoria === CATEGORIA_OUTROS && (
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
  // O ícone fica na assinatura (quem chama ainda passa), mas não aparece:
  // os cards seguem o CardResumo, sem ícone.
  void Icon;
  return (
    <CardResumo
      rotulo={label}
      valor={fmt(value)}
      nota={hint}
      tom={tone === 'warn' && value > 0 ? 'alerta' : 'padrao'}
      ativo={active}
      onClick={onClick}
    />
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
    <CardResumo
      rotulo="Despesas fixas"
      valor={items === null ? '—' : fmt(total)}
      nota={items === null ? 'Carregando…' : `${ativos.length} ativa${ativos.length === 1 ? '' : 's'} · todo mês`}
      ativo={active}
      onClick={onClick}
    />
  );
}


function DespesasFixasPanel({
  categorias,
  onClose,
  onChanged,
}: {
  categorias: Categoria[];
  onClose: () => void;
  onChanged: () => void;
}) {
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
    <div className="rounded-3xl bg-surface-card shadow-(--elev-2) p-5 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink flex items-center gap-1.5 font-serif">
          <Repeat className="h-4 w-4 text-hexxa-green dark:text-hexxa-lime" />
          Despesas Fixas Mensais
        </p>
        <button type="button" onClick={onClose} className="tap-target pressable focusable rounded-full p-1 text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-soft">
        Aluguel, softwares, mensalidades — cadastre uma vez e o sistema lança automaticamente todo mês, sem precisar recriar.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs font-bold">Carregando…</span>
        </div>
      ) : (
        <div className="space-y-2">
          {items.length === 0 && !showForm && (
            <p className="text-xs text-ink-soft italic py-2">Nenhuma despesa fixa cadastrada ainda.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-2xl bg-surface-card shadow-(--elev-inset) p-3 ${!item.active ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{item.description}</p>
                <p className="text-[11px] text-ink-soft">
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
                  className="rounded-full p-2 text-ink-soft hover:bg-black/5 hover:text-ink transition-colors disabled:opacity-40"
                >
                  {item.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  title="Excluir"
                  onClick={() => handleDelete(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-full p-2 text-ink-soft hover:bg-red-500/10 hover:text-expense transition-colors disabled:opacity-40"
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
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Categoria (plano de contas)</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`mt-1 ${field}`}>
                <option value="">Sem categoria</option>
                {categorias
                  .filter((c) => c.kind === 'EXPENSE')
                  .map((c) => (
                    <option key={c.id} value={c.name}>{c.accountingCode ? `${c.accountingCode} — ${c.name}` : c.name}</option>
                  ))}
                <option value="Outros">Outros (categoria nova)</option>
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
  categorias,
  selectedMonth,
  onAdd,
  onUpdate,
  onDelete,
}: {
  tipo: 'PAGAR' | 'RECEBER';
  data: Lancamento[];
  categorias: Categoria[];
  selectedMonth: MonthFilter;
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
    const base = data.filter((l) => l.tipo === tipo && matchesMonth(l.vencimento, selectedMonth));
    if (filter === 'todos') return base;
    if (filter === 'fixas') return base.filter((l) => l.isFixa);
    if (filter === 'impostos') return base.filter((l) => grupoDe(l) === 'Impostos');
    if (filter === 'colaboradores') return base.filter((l) => grupoDe(l) === 'Colaboradores (CLT)' || grupoDe(l) === 'Colaboradores (PJ)');
    if (filter === 'contratos') return base.filter((l) => ['Contratos', 'Mensalidade'].includes(grupoDe(l)));
    if (filter === 'servicos') return base.filter((l) => ['Serviços', 'Notas Fiscais', 'Faturamento Avulso'].includes(grupoDe(l)));
    return base.filter((l) => getStatus(l) === filter);
  }, [data, tipo, filter, selectedMonth]);

  const counts = useMemo(() => {
    const base = data.filter((l) => l.tipo === tipo && matchesMonth(l.vencimento, selectedMonth));
    return {
      todos: base.length,
      aberto: base.filter((l) => getStatus(l) === 'aberto').length,
      vencido: base.filter((l) => getStatus(l) === 'vencido').length,
      pago: base.filter((l) => getStatus(l) === 'pago').length,
      fixas: base.filter((l) => l.isFixa).length,
    };
  }, [data, tipo, selectedMonth]);

  // Agregados do período selecionado por categoria — inclui pago e em
  // aberto, é "o que esse período representa", não só o que falta pagar/receber.
  const categoriaBreakdown = useMemo(() => {
    const base = data.filter((l) => l.tipo === tipo && matchesMonth(l.vencimento, selectedMonth));
    const groups = new Map<string, number>();
    for (const l of base) {
      groups.set(grupoDe(l), (groups.get(grupoDe(l)) ?? 0) + l.valor);
    }
    return Array.from(groups.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [data, tipo, selectedMonth]);

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

  const filterBtns: { key: FilterTab | string; label: string; count?: number; badge?: number }[] = [
    { key: 'todos', label: 'Todos', count: counts.todos },
    { key: 'aberto', label: 'Em aberto', count: counts.aberto },
    { key: 'vencido', label: 'Vencidos', count: counts.vencido, badge: counts.vencido || undefined },
    { key: 'pago', label: isPagar ? 'Pagos' : 'Recebidos', count: counts.pago },
    ...(isPagar ? [
      { key: 'fixas', label: 'Despesas fixas', count: counts.fixas },
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            hint={`PJ + CLT · ${mesLabel(selectedMonth)}`}
            value={colaboradoresMes} 
            tone="default" 
            active={filter === 'colaboradores'}
            onClick={() => setFilter(filter === 'colaboradores' ? 'todos' : 'colaboradores')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            hint={mesLabel(selectedMonth)}
            value={servicosMes} 
            tone="default" 
            active={filter === 'servicos'}
            onClick={() => setFilter(filter === 'servicos' as any ? 'todos' : 'servicos')}
          />
          <MesStatCard 
            icon={Tag} 
            label="Outras Entradas" 
            hint={`Diversos · ${mesLabel(selectedMonth)}`}
            value={outrosRecMes} 
            tone="default" 
          />
        </div>
      )}

      {/* Header com Filtros & Botões */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltrosEmTexto
          filtros={filterBtns.map((f) => ({ id: f.key, label: f.label, count: f.badge ? undefined : f.count, badge: f.badge }))}
          ativo={filter}
          onChange={(id) => setFilter(id as FilterTab)}
        />
        <div className="flex items-center gap-2">
          {isPagar && (
            <button
              type="button"
              onClick={() => setShowFixas((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink transition-all"
            >
              <Repeat className="h-4 w-4" />
              Despesas Fixas
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-4 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Nova conta a {label}
          </button>
        </div>
      </div>

      {isPagar && showFixas && (
        <DespesasFixasPanel categorias={categorias} onClose={() => setShowFixas(false)} onChanged={() => onUpdate({} as Lancamento)} />
      )}

      {showForm && (
        <LancamentoForm
          tipo={tipo}
          categorias={categorias}
          onAdd={(l) => {
            onAdd(l);
            setFilter('todos');
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Tabela de Lançamentos */}
      {list.length === 0 ? (
        <div className="rounded-3xl bg-surface-card shadow-(--elev-1) p-12 text-center text-ink-soft">
          <DollarSign className="h-8 w-8 mx-auto opacity-30 mb-2" />
          <p className="text-sm font-semibold">Nenhum lançamento encontrado neste filtro.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-surface-card shadow-(--elev-1)">
          <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-black/5 dark:border-white/5 bg-surface-card/60 px-5 py-3 text-caption font-bold uppercase tracking-wider text-ink-soft sm:grid">
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
                        <p className="truncate text-sm font-bold text-ink">{l.descricao}</p>
                      {(l.categoria || l.temComprovante || l.isFixa) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
                          {l.isFixa && (
                            <span className="inline-flex items-center gap-1 font-bold text-hexxa-green dark:text-hexxa-lime">
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
                      <p className="mt-0.5 text-xs text-ink-soft sm:hidden">
                        {fmtDate(l.vencimento)} · <strong>{fmt(l.valor)}</strong>
                      </p>
                    </div>
                  </div>

                    <span className="hidden w-28 text-right text-xs sm:text-sm text-ink-soft sm:block">
                      {fmtDate(l.vencimento)}
                    </span>
                      <span
                      className={`hidden w-32 text-right font-serif text-sm sm:text-base font-bold tabular sm:block ${
                        l.tipo === 'PAGAR' ? 'text-expense' : 'text-hexxa-green dark:text-hexxa-lime'
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
                          className="inline-flex items-center gap-1 rounded-full bg-surface-card shadow-(--elev-inset) px-2.5 py-1 text-xs font-bold text-hexxa-green dark:text-hexxa-lime border border-(--color-line)"
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
                            ? 'bg-hexxa-green/10 text-hexxa-green dark:text-hexxa-lime'
                            : 'text-ink-soft hover:bg-black/5 hover:text-ink'
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
                        {contratoLinkFor(l) && (
                          <Link
                            href={contratoLinkFor(l) as Route}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] px-3 py-1 text-[11px] font-bold text-[#DFFFAE]"
                          >
                            Ver Contrato
                          </Link>
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
    <div className="rounded-3xl bg-surface-card shadow-(--elev-1) p-5 sm:p-6">
      <p className="mb-4 font-serif font-bold text-sm text-ink">{title}</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-soft">{emptyLabel}</p>
      ) : (
        <div className="space-y-3.5">
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-card shadow-(--elev-inset)">
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
                <span className="flex-1 truncate text-ink-soft">{c.label}</span>
                <span className="font-serif tabular font-bold text-ink">{fmt(c.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VisaoGeral({ data, selectedMonth, onNavigate }: { data: Lancamento[]; selectedMonth: MonthFilter; onNavigate: (tab: 'pagar' | 'receber') => void }) {
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

  const receberMes = data.filter((l) => l.tipo === 'RECEBER' && matchesMonth(l.vencimento, selectedMonth));
  const pagarMes = data.filter((l) => l.tipo === 'PAGAR' && matchesMonth(l.vencimento, selectedMonth));
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

  const totalReceberMes = receberMes.reduce((s, l) => s + l.valor, 0);
  const totalPagarMes = pagarMes.reduce((s, l) => s + l.valor, 0);
  const resultadoMes = totalReceberMes - totalPagarMes;
  // Sem receita não há margem — o 80% que aparecia aqui era um valor inventado.
  const margemPct = totalReceberMes > 0 ? Math.max(0, Math.min(100, Math.round((resultadoMes / totalReceberMes) * 100))) : 0;

  return (
    <div className="space-y-6">
      {/*
        Resumo do mês no padrão do sistema (CardResumo). Os cards antigos
        traziam "+12% previsto" e mini gráficos desenhados à mão — números e
        curvas que não vinham de dado nenhum. Aqui só o que é real.
      */}
      <GradeDeResumo>
        <CardResumo
          destaque
          rotulo="Resultado do mês"
          valor={fmt(resultadoMes)}
          nota={totalReceberMes > 0 ? `Margem de ${margemPct}% · ${resultadoMes >= 0 ? 'superávit' : 'déficit'}` : 'Sem receita no mês'}
        />
        <CardResumo
          rotulo="A pagar no mês"
          valor={fmt(totalPagarMes > 0 ? totalPagarMes : totalPagar)}
          tom={vencidos.length > 0 ? 'negativo' : 'padrao'}
          nota={`${vencidos.length > 0 ? `${vencidos.length} vencido${vencidos.length === 1 ? '' : 's'}` : 'Tudo em dia'} · ${data.filter((l) => l.tipo === 'PAGAR' && !l.pago_em).length} pendentes`}
          onClick={() => onNavigate('pagar')}
        />
        <CardResumo
          rotulo="A receber no mês"
          valor={fmt(totalReceberMes > 0 ? totalReceberMes : totalReceber)}
          nota={`${data.filter((l) => l.tipo === 'RECEBER' && !l.pago_em).length} a receber`}
          onClick={() => onNavigate('receber')}
        />
        <CardResumo
          rotulo="Saldo líquido"
          valor={fmt(saldo)}
          tom={saldo < 0 ? 'negativo' : 'padrao'}
          nota="Receitas menos despesas do mês"
        />
      </GradeDeResumo>

      {/* ── Bento Row 2: Balance Wavy Chart + Eficiência Gauge ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entradas e saídas do mês, dia a dia — dado real (ver GraficoEntradasSaidas).
            Aqui ficava uma curva desenhada à mão, igual para toda empresa. */}
        <GraficoEntradasSaidas
          className="lg:col-span-2"
          titulo={`Entradas e saídas · ${mesLabel(selectedMonth)}`}
          periodos={periodosPorDia(
            /^\d{4}-\d{2}$/.test(String(selectedMonth)) ? String(selectedMonth) : new Date().toISOString().slice(0, 7),
            [...receberMes, ...pagarMes].map((l) => ({ data: l.vencimento, valor: l.valor, entrada: l.tipo === 'RECEBER' })),
          )}
        />

        {/* Card de Eficiência / Gauge Semi-circular Estilo 'Earnings 80%' (col-span-1) */}
        <Card level={1} className="p-6 sm:p-7 card-finish flex flex-col justify-between space-y-4">
          <div>
            <p className="text-caption font-bold text-ink-soft">Eficiência Operacional</p>
            <p className="text-xs text-ink-soft mt-1">Total de Despesas</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-ink tabular mt-0.5">
              {fmt(totalPagarMes)}
            </p>
            <p className="text-xs text-ink-soft mt-2">
              Margem operacional de <strong className="text-hexxa-forest dark:text-hexxa-lime font-bold">{margemPct}%</strong> no mês
            </p>
          </div>

          {/* Semi-circular Gauge Visual */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-44 h-24 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 100 55">
                {/* Arco de fundo cinza suave */}
                <path
                  d="M 12 50 A 38 38 0 0 1 88 50"
                  fill="none"
                  stroke="currentColor"
                  className="text-black/10 dark:text-white/10"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Arco ativo verde floresta */}
                <path
                  d="M 12 50 A 38 38 0 0 1 88 50"
                  fill="none"
                  stroke="#5F7A6A"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="119.38"
                  strokeDashoffset={119.38 * (1 - margemPct / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Valor numérico no centro */}
              <div className="absolute bottom-1 flex flex-col items-center">
                <span className="font-serif text-2xl font-bold text-ink tabular">{margemPct}%</span>
              </div>
            </div>
            <p className="text-[11px] font-bold text-ink-soft mt-1">Índice de Retenção Líquida</p>
          </div>

          <button
            type="button"
            onClick={() => setShowDre(true)}
            className="w-full tap-target pressable focusable flex items-center justify-center gap-2 rounded-full bg-surface shadow-(--elev-1) hover:shadow-(--elev-2) px-4 py-2.5 text-xs font-bold text-ink hover:text-hexxa-forest dark:hover:text-hexxa-lime transition-all"
          >
            <FileText className="h-4 w-4" />
            Abrir DRE Completo
          </button>
        </Card>
      </div>

      {/* ── Bento Row 3: Composição + Vencimentos ('Your Transfers' Style) ──────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Composição por Origem */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-serif font-bold text-base text-ink">Composição · {mesLabel(selectedMonth)}</h3>
            <button
              type="button"
              onClick={() => onNavigate('pagar')}
              className="flex items-center gap-2 rounded-full bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-all"
            >
              <Repeat className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime" />
              Despesas Fixas
              <span className="font-serif font-bold tabular text-ink">{fmt(totalFixas)}</span>
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ComposicaoCard title="Receitas por origem" items={composicaoReceitas} emptyLabel={`Sem recebíveis lançados ${mesLabel(selectedMonth).toLowerCase()}.`} />
            <ComposicaoCard title="Despesas por origem" items={composicaoDespesas} emptyLabel={`Sem despesas lançadas ${mesLabel(selectedMonth).toLowerCase()}.`} />
          </div>
        </div>

        {/* Próximos Vencimentos Estilo 'Your Transfers' da Referência */}
        <Card level={1} className="p-6 sm:p-7 card-finish space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-serif font-bold text-base text-ink">Próximos Vencimentos</p>
            <span className="text-xs text-ink-soft">Próximos 7 dias</span>
          </div>
          {proximos.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-hexxa-forest dark:text-hexxa-lime flex flex-col items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <span>Nenhum vencimento pendente para os próximos 7 dias.</span>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {proximos.slice(0, 5).map((l) => {
                const isPagar = l.tipo === 'PAGAR';
                return (
                  <div key={l.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                        isPagar ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {isPagar ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{l.descricao}</p>
                        <p className="text-xs text-ink-soft">{fmtDate(l.vencimento)} · {l.categoria || 'Geral'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-serif font-bold tabular ${isPagar ? 'text-expense' : 'text-hexxa-forest dark:text-hexxa-lime'}`}>
                        {fmt(l.valor)}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isPagar ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {isPagar ? 'A pagar' : 'A receber'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {showDre && <DreModal data={data} selectedMonth={selectedMonth} onClose={() => setShowDre(false)} />}
    </div>
  );
}


// ── Main Financeiro Component ───────────────────────────────────────────

type TabKey = 'geral' | 'pagar' | 'receber';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'geral', label: 'Visão Geral', icon: LayoutGrid },
  { key: 'pagar', label: 'Contas a Pagar', icon: ArrowDownCircle },
  { key: 'receber', label: 'Contas a Receber', icon: ArrowUpCircle },
];

// ── DRE Modal ───────────────────────────────────────────────────────────────

function DreModal({ data, selectedMonth, onClose }: { data: Lancamento[]; selectedMonth: MonthFilter; onClose: () => void }) {
  const filterCurrentMonth = data.filter(l => matchesMonth(l.vencimento, selectedMonth));
  
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
  const label = "text-sm text-ink-soft";
  const val = "text-sm font-bold tabular text-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-up">
      <div className="bg-surface-card w-full max-w-lg rounded-3xl shadow-(--elev-3) card-finish overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/5 bg-surface-card/60">
          <div className="flex items-center gap-2.5">
            <div className="bg-hexxa-forest text-hexxa-lime p-2 rounded-2xl shadow-(--elev-1)">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-ink">
              DRE Gerencial · {mesLabel(selectedMonth)}
            </h2>
          </div>
          <button onClick={onClose} className="tap-target pressable focusable p-2 text-ink-soft hover:text-ink rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-surface-card shadow-(--elev-inset) rounded-2xl p-5 space-y-1">
            <div className={row}>
              <span className="text-sm font-bold text-ink">Receita Bruta (Faturamento)</span>
              <span className="text-sm font-bold tabular text-hexxa-green dark:text-hexxa-lime">{fmt(receitas)}</span>
            </div>
            <div className={row}>
              <span className={label}>(-) Impostos Incorridos</span>
              <span className="text-sm tabular text-expense">{fmt(impostos)}</span>
            </div>
            <div className={`${row} bg-black/5 dark:bg-white/5 -mx-5 px-5`}>
              <span className="text-sm font-bold text-ink">(=) Receita Líquida</span>
              <span className={val}>{fmt(receitaLiquida)}</span>
            </div>
            <div className={row}>
              <span className={label}>(-) Despesas Operacionais Fixas</span>
              <span className="text-sm tabular text-expense">{fmt(despesasFixas)}</span>
            </div>
            <div className={row}>
              <span className={label}>(-) Despesas Operacionais Variáveis</span>
              <span className="text-sm tabular text-expense">{fmt(despesasVariaveis)}</span>
            </div>
            <div className={`${row} bg-black/5 dark:bg-white/5 -mx-5 px-5`}>
              <span className="text-sm font-bold text-ink">(=) Lucro Operacional (EBITDA)</span>
              <span className={`text-sm font-bold tabular ${ebitda >= 0 ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-expense'}`}>{fmt(ebitda)}</span>
            </div>
            <div className={`${row} border-t-2 border-black/10 dark:border-white/20 mt-2`}>
              <span className="text-base font-serif font-bold text-ink">Lucro Líquido Distribuível</span>
              <span className={`text-base font-serif font-bold tabular ${lucroLiquido >= 0 ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-expense'}`}>{fmt(lucroLiquido)}</span>
            </div>
          </div>
          
          <p className="mt-4 text-center text-xs text-ink-soft">
            O DRE Gerencial demonstra o resultado econômico da empresa baseado no regime de competência/caixa simulado pelo mês atual.
          </p>
        </div>
      </div>
    </div>
  );
}

export function HubFinanceiro({ initialTab = 'geral', insightSlot }: { initialTab?: TabKey; insightSlot?: React.ReactNode }) {
  const currentMonthStr = currentMonth();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [data, setData] = useState<Lancamento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>(currentMonthStr);

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
  };

  // Meses com pelo menos um lançamento, mais recente primeiro — sempre inclui
  // o mês atual mesmo sem lançamento nenhum (é o padrão da tela).
  const allMonths = useMemo(() => {
    const set = new Set(data.map((l) => l.vencimento.slice(0, 7)));
    set.add(currentMonthStr);
    return Array.from(set).sort().reverse();
  }, [data, currentMonthStr]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const [json, cats] = await Promise.all([getLancamentos(), listCategorias()]);
      setData(json);
      setCategorias(cats);
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
      {/* Hero Card do Financeiro */}
      <SectionHero
        title="Financeiro"
        infoTitle="Sobre o Financeiro"
        infoDescription="Contas a pagar, a receber, conciliação bancária e fluxo de caixa — tudo integrado com a sua contabilidade. O Balanço e o DRE ficam na aba Contabilidade."
      />

      {insightSlot}

      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
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
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end shrink-0">
          <FinanceiroMonthSelector
            selectedMonth={selectedMonth}
            monthLabel={getFormattedMonth(selectedMonth)}
            isCurrentMonth={selectedMonth === currentMonthStr}
            availableMonths={allMonths}
            onMonthChange={setSelectedMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onCurrentMonth={handleCurrentMonth}
          />
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || loading}
            title="Atualizar"
            className="tap-target pressable focusable rounded-full bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) p-2.5 text-ink-soft hover:text-ink transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
          {tab === 'geral' && <VisaoGeral data={data} selectedMonth={selectedMonth} onNavigate={setTab} />}
          {tab === 'pagar' && <LancamentosTab tipo="PAGAR" data={data} categorias={categorias} selectedMonth={selectedMonth} onAdd={refresh} onUpdate={refresh} onDelete={refresh} />}
          {tab === 'receber' && <LancamentosTab tipo="RECEBER" data={data} categorias={categorias} selectedMonth={selectedMonth} onAdd={refresh} onUpdate={refresh} onDelete={refresh} />}
        </>
      )}
    </div>
  );
}
