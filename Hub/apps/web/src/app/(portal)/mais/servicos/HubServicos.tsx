'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  Building2,
  FileText,
  LayoutGrid,
  Plus,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Layers,
  Briefcase,
  FileCheck,
  TrendingUp,
  Users,
  Send,
  Calendar,
  ArrowRight,
  MessageSquare,
  Loader2,
  Trash2,
  Zap,
} from 'lucide-react';
import type { SolicitacaoRow, SolicitacaoStatus } from './actions';
import { criarSolicitacaoAction, cancelarSolicitacaoAction } from './actions';

// ── Types ─────────────────────────────────────────────────────────────────────

type Prioridade = 'normal' | 'urgente';

type Solicitacao = SolicitacaoRow;

type Servico = {
  id: string;
  nome: string;
  descricao: string;
  prazo: string;
  categoria: string;
};

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SolicitacaoStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  solicitado:   { label: 'Solicitado',   cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]', icon: Clock },
  em_analise:   { label: 'Em análise',   cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]', icon: Search },
  em_andamento: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', icon: AlertTriangle },
  concluido:    { label: 'Concluído',    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
  cancelado:    { label: 'Cancelado',    cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', icon: XCircle },
};

const CATALOGO: { categoria: string; icon: React.FC<{ className?: string }>; cls: string; servicos: Servico[] }[] = [
  {
    categoria: 'Alterações Empresariais',
    icon: Building2,
    cls: 'bg-[#1E3328]/10 text-[#1E3328] dark:bg-white/10 dark:text-[#DFFFAE]',
    servicos: [
      { id: 's1', nome: 'Alteração de endereço',          descricao: 'Atualização do endereço da sede ou filial junto à Receita Federal e órgãos municipais.',         prazo: '5–10 dias úteis', categoria: 'Alterações Empresariais' },
      { id: 's2', nome: 'Inclusão ou exclusão de sócio',  descricao: 'Alteração no quadro societário com elaboração de contrato social e registro na Junta Comercial.', prazo: '10–20 dias úteis', categoria: 'Alterações Empresariais' },
      { id: 's3', nome: 'Alteração de atividade (CNAE)', descricao: 'Inclusão, exclusão ou substituição de atividades econômicas no CNPJ e alvará.',                   prazo: '7–15 dias úteis', categoria: 'Alterações Empresariais' },
      { id: 's4', nome: 'Alteração de razão social',     descricao: 'Mudança da razão social ou nome fantasia com atualização em todos os órgãos competentes.',         prazo: '10–20 dias úteis', categoria: 'Alterações Empresariais' },
      { id: 's5', nome: 'Alteração de capital social',   descricao: 'Aumento ou redução do capital social com lavratura de ata e registro.',                            prazo: '7–15 dias úteis', categoria: 'Alterações Empresariais' },
    ],
  },
  {
    categoria: 'Parcelamentos e Regularização',
    icon: TrendingUp,
    cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    servicos: [
      { id: 's6', nome: 'Parcelamento REFIS / PERT',      descricao: 'Negociação e adesão a programas federais de parcelamento de débitos tributários.',               prazo: '3–7 dias úteis',  categoria: 'Parcelamentos e Regularização' },
      { id: 's7', nome: 'Parcelamento PGFN',               descricao: 'Renegociação de dívidas inscritas em Dívida Ativa da União com a Procuradoria-Geral.',          prazo: '5–10 dias úteis', categoria: 'Parcelamentos e Regularização' },
      { id: 's8', nome: 'Parcelamento ISS municipal',     descricao: 'Negociação junto à prefeitura para parcelamento de débitos de ISS em atraso.',                   prazo: '5–10 dias úteis', categoria: 'Parcelamentos e Regularização' },
      { id: 's9', nome: 'Regularização de pendências',    descricao: 'Levantamento e regularização de pendências fiscais, previdenciárias e cadastrais.',               prazo: '10–30 dias úteis', categoria: 'Parcelamentos e Regularização' },
    ],
  },
  {
    categoria: 'Certidões e Declarações',
    icon: FileCheck,
    cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    servicos: [
      { id: 's10', nome: 'Certidão Negativa Federal (CND)',  descricao: 'Obtenção de CND ou CPEND junto à Receita Federal e PGFN.',                                    prazo: '1–3 dias úteis', categoria: 'Certidões e Declarações' },
      { id: 's11', nome: 'Certidão FGTS (CRF)',             descricao: 'Certidão de Regularidade do FGTS emitida pela Caixa Econômica Federal.',                       prazo: '1–3 dias úteis', categoria: 'Certidões e Declarações' },
      { id: 's12', nome: 'Declaração de faturamento',       descricao: 'Elaboração de declaração de faturamento para fins contratuais, bancários ou licitatórios.',    prazo: '2–5 dias úteis', categoria: 'Certidões e Declarações' },
      { id: 's13', nome: 'DIRF',                            descricao: 'Declaração do Imposto de Renda Retido na Fonte para prestadores e tomadores de serviço.',      prazo: '5–10 dias úteis', categoria: 'Certidões e Declarações' },
      { id: 's14', nome: 'RAIS / eSocial',                  descricao: 'Entrega da Relação Anual de Informações Sociais e obrigações acessórias do eSocial.',          prazo: '5–15 dias úteis', categoria: 'Certidões e Declarações' },
    ],
  },
  {
    categoria: 'Regime Tributário',
    icon: Layers,
    cls: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    servicos: [
      { id: 's15', nome: 'Migração para Simples Nacional',  descricao: 'Análise de elegibilidade e adesão ao Simples Nacional no período de opção.',                   prazo: 'Conforme calendário', categoria: 'Regime Tributário' },
      { id: 's16', nome: 'Migração Lucro Presumido → Real', descricao: 'Estudo comparativo e transição entre regimes com ajuste das obrigações acessórias.',           prazo: '15–30 dias úteis', categoria: 'Regime Tributário' },
      { id: 's17', nome: 'Planejamento tributário',         descricao: 'Análise do regime mais vantajoso com projeção de economia fiscal para o exercício.',           prazo: '10–20 dias úteis', categoria: 'Regime Tributário' },
      { id: 's18', nome: 'Exclusão do Simples Nacional',   descricao: 'Formalização da saída voluntária do Simples Nacional e migração para outro regime.',            prazo: '5–10 dias úteis', categoria: 'Regime Tributário' },
    ],
  },
  {
    categoria: 'Abertura e Encerramento',
    icon: Briefcase,
    cls: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
    servicos: [
      { id: 's19', nome: 'Abertura de filial',              descricao: 'Registro de estabelecimento filial com CNPJ, alvará e demais licenças necessárias.',           prazo: '15–30 dias úteis', categoria: 'Abertura e Encerramento' },
      { id: 's20', nome: 'Encerramento de empresa',         descricao: 'Distrato social, baixa do CNPJ e encerramento junto a todos os órgãos.',                       prazo: '30–90 dias úteis', categoria: 'Abertura e Encerramento' },
      { id: 's21', nome: 'Suspensão de atividades',         descricao: 'Comunicação de inatividade temporária e manutenção das obrigações mínimas.',                   prazo: '5–10 dias úteis', categoria: 'Abertura e Encerramento' },
      { id: 's22', nome: 'Transformação societária',        descricao: 'Conversão de EIRELI em Ltda, Ltda em SA ou outros tipos societários.',                          prazo: '20–45 dias úteis', categoria: 'Abertura e Encerramento' },
    ],
  },
  {
    categoria: 'Consultoria Especializada',
    icon: Users,
    cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    servicos: [
      { id: 's23', nome: 'Consultoria trabalhista',         descricao: 'Orientação sobre CLT, eSocial, rescisões, benefícios e gestão de folha.',                      prazo: 'Agendamento', categoria: 'Consultoria Especializada' },
      { id: 's24', nome: 'Reestruturação societária',       descricao: 'Reorganização do quadro social, holding familiar e proteção patrimonial.',                     prazo: '30–60 dias úteis', categoria: 'Consultoria Especializada' },
      { id: 's25', nome: 'Due diligence contábil',          descricao: 'Revisão aprofundada das demonstrações financeiras para fusões, aquisições ou investimentos.',   prazo: '15–30 dias úteis', categoria: 'Consultoria Especializada' },
      { id: 's26', nome: 'Consultoria para licitações',     descricao: 'Preparação de documentação, certidões e habilitação para participação em editais.',            prazo: '5–15 dias úteis', categoria: 'Consultoria Especializada' },
    ],
  },
];

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

// ── Formulário de solicitação ─────────────────────────────────────────────────

function FormSolicitacao({ servico, onClose, onSubmitted }: {
  servico: Servico;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [prioridade, setPrioridade] = useState<Prioridade>('normal');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setEnviando(true);
    try {
      await criarSolicitacaoAction({
        servico: servico.nome,
        descricao: String(fd.get('descricao') ?? '').trim(),
        prioridade,
      });
      onSubmitted();
      onClose();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between border-b border-black/5 dark:border-white/10 p-6 sm:p-8">
          <div>
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">{servico.categoria}</p>
            <h2 className="mt-1 font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">{servico.nome}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6E6A61] hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6 sm:p-8">
          <div className="rounded-2xl bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 border border-black/5 dark:border-white/10 p-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            <p>{servico.descricao}</p>
            <p className="mt-2 font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">Prazo estimado: {servico.prazo}</p>
          </div>
          <div>
            <label className={lbl}>Descreva sua necessidade</label>
            <textarea name="descricao" required rows={4} placeholder="Detalhe o que precisa, inclua datas, valores ou informações relevantes…" className={`mt-1.5 ${field} resize-none`} />
          </div>
          <div>
            <label className={lbl}>Prioridade de Atendimento</label>
            <div className="mt-1.5 flex gap-2">
              {(['normal', 'urgente'] as const).map(p => (
                <button key={p} type="button" onClick={() => setPrioridade(p)}
                  className={`flex-1 rounded-full border py-2.5 text-xs font-bold transition-all ${
                    prioridade === p
                      ? p === 'urgente' ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400' : 'border-[#1E3328] bg-[#1E3328] text-[#DFFFAE]'
                      : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C]'
                  }`}>
                  {p === 'urgente' ? '⚡ Urgente' : '📋 Padrão'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <button type="submit" disabled={enviando} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-3 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {enviando ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
            <button type="button" onClick={onClose} className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-3 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

function CatalogoTab({ onSolicitar }: { onSolicitar: (s: Servico) => void }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('todas');

  const categorias = CATALOGO.map(c => c.categoria);
  const filtered = CATALOGO
    .filter(c => catFilter === 'todas' || c.categoria === catFilter)
    .map(c => ({
      ...c,
      servicos: search
        ? c.servicos.filter(s => s.nome.toLowerCase().includes(search.toLowerCase()) || s.descricao.toLowerCase().includes(search.toLowerCase()))
        : c.servicos,
    }))
    .filter(c => c.servicos.length > 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E6A61] dark:text-[#A8A49C]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serviço por nome ou palavra-chave…"
            className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] py-2.5 pl-10 pr-4 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]" />
        </div>
        <SegmentedTabs
          tabs={[
            { id: 'todas', label: 'Todas' },
            ...categorias.map(cat => ({ id: cat, label: cat.split(' ')[0] })),
          ]}
          activeTab={catFilter}
          onChange={setCatFilter}
          layoutId="servicosCatIndicator"
          size="sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
          <Search className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum serviço encontrado para sua busca.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.categoria} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-xl ${cat.cls}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{cat.categoria}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {cat.servicos.map(s => (
                    <div key={s.id} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 flex flex-col justify-between gap-4 shadow-sm hover:border-[#1E3328]/30 transition-all">
                      <div className="space-y-1">
                        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{s.nome}</p>
                        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] leading-relaxed">{s.descricao}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E6A61] dark:text-[#A8A49C]">
                          <Calendar className="h-3.5 w-3.5" /> {s.prazo}
                        </span>
                        <button type="button" onClick={() => onSolicitar(s)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
                          <Plus className="h-3.5 w-3.5" /> Solicitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Minhas Solicitações ───────────────────────────────────────────────────────

function SolicitacoesTab({ solicitacoes }: { solicitacoes: Solicitacao[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<SolicitacaoStatus | 'todas'>('todas');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCancelar(id: string) {
    setBusyId(id);
    try {
      await cancelarSolicitacaoAction(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = filter === 'todas' ? solicitacoes : solicitacoes.filter(s => s.status === filter);
  const counts = { todas: solicitacoes.length, solicitado: 0, em_analise: 0, em_andamento: 0, concluido: 0, cancelado: 0 } as Record<string, number>;
  solicitacoes.forEach(s => { counts[s.status] = (counts[s.status] ?? 0) + 1; });

  if (solicitacoes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-[#6E6A61] dark:text-[#A8A49C]">
        <FileText className="h-12 w-12 opacity-20" />
        <div>
          <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nenhuma solicitação ainda</p>
          <p className="mt-1 text-xs">Acesse a aba Catálogo de Serviços para solicitar um serviço contábil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-wrap gap-1.5">
        {([['todas', 'Todas'], ['solicitado', 'Solicitadas'], ['em_analise', 'Em análise'], ['em_andamento', 'Em andamento'], ['concluido', 'Concluídas']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${filter === key ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm' : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'}`}>
            {label} ({counts[key] ?? 0})
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10 overflow-hidden shadow-sm">
        {filtered.map(s => {
          const cfg = STATUS_CONFIG[s.status];
          const StatusIcon = cfg.icon;
          const isExp = expanded === s.id;
          return (
            <div key={s.id}>
              <button type="button" onClick={() => setExpanded(isExp ? null : s.id)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${cfg.cls.split(' ')[0]}`}>
                  <StatusIcon className={`h-4 w-4 ${cfg.cls.split(' ')[1]}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{s.servico}</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Solicitado em {fmtDate(s.criadaEm)}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  {s.prioridade === 'urgente' && (
                    <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">⚡ Urgente</span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${cfg.cls}`}>
                    <StatusIcon className="h-3.5 w-3.5" />{cfg.label}
                  </span>
                </div>
                {isExp ? <ChevronUp className="h-4 w-4 shrink-0 text-[#6E6A61]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#6E6A61]" />}
              </button>
              {isExp && (
                <div className="mx-6 mb-4 space-y-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-5 shadow-sm">
                  <div>
                    <p className={lbl}>Sua Solicitação</p>
                    <p className="mt-1 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] whitespace-pre-wrap">{s.descricao}</p>
                  </div>
                  {s.resposta && (
                    <div className="rounded-2xl border border-[#1E3328]/20 bg-[#EFFFD6]/50 dark:bg-[#2F4A3C]/20 p-4">
                      <p className={`${lbl} text-[#2F4A3C] dark:text-[#DFFFAE]`}>Parecer da Contabilidade</p>
                      <p className="mt-1 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3]">{s.resposta}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E6A61] dark:text-[#A8A49C] pt-2 border-t border-black/5 dark:border-white/10">
                    <span>Criada em {fmtDate(s.criadaEm)}</span>
                    <span>•</span>
                    <span>Atualizada em {fmtDate(s.atualizadaEm)}</span>
                    {(s.status === 'solicitado' || s.status === 'em_analise') && (
                      <button type="button" onClick={() => handleCancelar(s.id)} disabled={busyId === s.id}
                        className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-red-700 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all">
                        {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Cancelar Solicitação
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabKey = 'catalogo' | 'solicitacoes';

export function HubServicos({ initialSolicitacoes }: { initialSolicitacoes: Solicitacao[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('catalogo');
  const solicitacoes = initialSolicitacoes;
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);

  const pendentes = solicitacoes.filter(s => ['solicitado', 'em_analise', 'em_andamento'].includes(s.status)).length;

  function handleSolicitar(s: Servico) {
    setServicoSelecionado(s);
  }

  function handleSubmitted() {
    setTab('solicitacoes');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Stats rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Em Andamento</p>
          <p className={`mt-1 font-serif text-3xl font-bold tracking-tight ${pendentes > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>{pendentes}</p>
        </div>
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Concluídas</p>
          <p className="mt-1 font-serif text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">{solicitacoes.filter(s => s.status === 'concluido').length}</p>
        </div>
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Serviços no Catálogo</p>
          <p className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">{CATALOGO.reduce((s, c) => s + c.servicos.length, 0)}</p>
        </div>
      </div>

      {/* Banner de contato */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Precisa de um serviço sob medida?</p>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Fale diretamente com nossa consultoria pelo chat ou agende uma reunião.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="/suporte" className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all shadow-sm">
            Ir para Suporte <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex">
        <SegmentedTabs
          tabs={[
            { id: 'catalogo', label: 'Catálogo de Serviços', icon: LayoutGrid },
            { id: 'solicitacoes', label: `Minhas Solicitações${pendentes > 0 ? ` (${pendentes})` : ''}`, icon: FileText },
          ]}
          activeTab={tab}
          onChange={setTab}
          layoutId="servicosTabsIndicator"
        />
      </div>

      {tab === 'catalogo'     && <CatalogoTab onSolicitar={handleSolicitar} />}
      {tab === 'solicitacoes' && <SolicitacoesTab solicitacoes={solicitacoes} />}

      {/* Modal de solicitação */}
      {servicoSelecionado && (
        <FormSolicitacao
          servico={servicoSelecionado}
          onClose={() => setServicoSelecionado(null)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}

