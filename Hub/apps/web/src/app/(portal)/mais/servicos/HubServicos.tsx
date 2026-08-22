'use client';

import { useState } from 'react';
import { Buildings, FileText, SquaresFour, Plus, X, Clock, CheckCircle, Warning, XCircle, CaretDown, CaretUp, MagnifyingGlass, Stack, Briefcase, Scroll, TrendUp, Users, PaperPlaneRight, CalendarBlank, ArrowRight, ChatCircle } from '@phosphor-icons/react';

// ── Types ─────────────────────────────────────────────────────────────────────

type SolicitacaoStatus = 'solicitado' | 'em_analise' | 'em_andamento' | 'concluido' | 'cancelado';
type Prioridade = 'normal' | 'urgente';

type Solicitacao = {
  id: string;
  servico: string;
  categoria: string;
  descricao: string;
  prioridade: Prioridade;
  status: SolicitacaoStatus;
  criadaEm: string;
  atualizadaEm: string;
  resposta: string | null;
};

type Servico = {
  id: string;
  nome: string;
  descricao: string;
  prazo: string;
  categoria: string;
};

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SolicitacaoStatus, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  solicitado:   { label: 'Solicitado',   cls: 'bg-ink/10 text-ink-soft',                              icon: Clock },
  em_analise:   { label: 'Em análise',   cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',  icon: MagnifyingGlass },
  em_andamento: { label: 'Em andamento', cls: 'bg-warn/10 text-warn',                                 icon: Warning },
  concluido:    { label: 'Concluído',    cls: 'bg-ok/10 text-ok',                                     icon: CheckCircle },
  cancelado:    { label: 'Cancelado',    cls: 'bg-critical/10 text-critical',                          icon: XCircle },
};

const CATALOGO: { categoria: string; icon: React.FC<{ className?: string }>; cls: string; servicos: Servico[] }[] = [
  {
    categoria: 'Alterações Empresariais',
    icon: Buildings,
    cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
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
    icon: TrendUp,
    cls: 'bg-warn/10 text-warn',
    servicos: [
      { id: 's6', nome: 'Parcelamento REFIS / PERT',      descricao: 'Negociação e adesão a programas federais de parcelamento de débitos tributários.',               prazo: '3–7 dias úteis',  categoria: 'Parcelamentos e Regularização' },
      { id: 's7', nome: 'Parcelamento PGFN',               descricao: 'Renegociação de dívidas inscritas em Dívida Ativa da União com a Procuradoria-Geral.',          prazo: '5–10 dias úteis', categoria: 'Parcelamentos e Regularização' },
      { id: 's8', nome: 'Parcelamento ISS municipal',     descricao: 'Negociação junto à prefeitura para parcelamento de débitos de ISS em atraso.',                   prazo: '5–10 dias úteis', categoria: 'Parcelamentos e Regularização' },
      { id: 's9', nome: 'Regularização de pendências',    descricao: 'Levantamento e regularização de pendências fiscais, previdenciárias e cadastrais.',               prazo: '10–30 dias úteis', categoria: 'Parcelamentos e Regularização' },
    ],
  },
  {
    categoria: 'Certidões e Declarações',
    icon: Scroll,
    cls: 'bg-ok/10 text-ok',
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
    icon: Stack,
    cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
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
    cls: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
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
    cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    servicos: [
      { id: 's23', nome: 'Consultoria trabalhista',         descricao: 'Orientação sobre CLT, eSocial, rescisões, benefícios e gestão de folha.',                      prazo: 'Agendamento', categoria: 'Consultoria Especializada' },
      { id: 's24', nome: 'Reestruturação societária',       descricao: 'Reorganização do quadro social, holding familiar e proteção patrimonial.',                     prazo: '30–60 dias úteis', categoria: 'Consultoria Especializada' },
      { id: 's25', nome: 'Due diligence contábil',          descricao: 'Revisão aprofundada das demonstrações financeiras para fusões, aquisições ou investimentos.',   prazo: '15–30 dias úteis', categoria: 'Consultoria Especializada' },
      { id: 's26', nome: 'Consultoria para licitações',     descricao: 'Preparação de documentação, certidões e habilitação para participação em editais.',            prazo: '5–15 dias úteis', categoria: 'Consultoria Especializada' },
    ],
  },
];

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const field = 'w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

// ── Seed ──────────────────────────────────────────────────────────────────────

function seedSolicitacoes(): Solicitacao[] {
  const add = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  return [
    { id: 'sol1', servico: 'Certidão Negativa Federal (CND)', categoria: 'Certidões e Declarações', descricao: 'Preciso da CND para participar de uma licitação municipal até o final do mês.', prioridade: 'urgente', status: 'concluido',    criadaEm: add(-20), atualizadaEm: add(-17), resposta: 'Certidão emitida e enviada para o seu e-mail. Válida por 180 dias.' },
    { id: 'sol2', servico: 'Parcelamento PGFN',               categoria: 'Parcelamentos e Regularização', descricao: 'Tenho débito de R$ 18.000 na PGFN e gostaria de parcelar em até 24x.', prioridade: 'normal',  status: 'em_andamento', criadaEm: add(-10), atualizadaEm: add(-3),  resposta: 'Simulação de parcelamento enviada por e-mail. Aguardando sua confirmação para prosseguir.' },
    { id: 'sol3', servico: 'Alteração de endereço',           categoria: 'Alterações Empresariais',       descricao: 'Mudamos para a Rua das Flores, 500, sala 12, São Paulo/SP CEP 01310-100.', prioridade: 'normal',  status: 'em_analise',   criadaEm: add(-5),  atualizadaEm: add(-5),  resposta: null },
  ];
}

// ── Formulário de solicitação ─────────────────────────────────────────────────

function FormSolicitacao({ servico, onClose, onSubmit }: {
  servico: Servico;
  onClose: () => void;
  onSubmit: (s: Solicitacao) => void;
}) {
  const [prioridade, setPrioridade] = useState<Prioridade>('normal');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const now = new Date().toISOString().slice(0, 10);
    onSubmit({
      id: crypto.randomUUID(),
      servico: servico.nome,
      categoria: servico.categoria,
      descricao: String(fd.get('descricao') ?? '').trim(),
      prioridade,
      status: 'solicitado',
      criadaEm: now,
      atualizadaEm: now,
      resposta: null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-surface-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-line p-5">
          <div>
            <p className="text-xs text-ink-soft">{servico.categoria}</p>
            <h2 className="mt-0.5 text-base font-semibold">{servico.nome}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="rounded-xl bg-brand-500/5 p-3 text-xs text-ink-soft">
            <p>{servico.descricao}</p>
            <p className="mt-1 font-medium text-brand-600 dark:text-brand-400">Prazo estimado: {servico.prazo}</p>
          </div>
          <div>
            <label className={lbl}>Descreva sua necessidade</label>
            <textarea name="descricao" required rows={4} placeholder="Detalhe o que precisa, inclua datas, valores ou informações relevantes…" className={`mt-1 ${field} resize-none`} />
          </div>
          <div>
            <label className={lbl}>Prioridade</label>
            <div className="mt-1 flex gap-2">
              {(['normal', 'urgente'] as const).map(p => (
                <button key={p} type="button" onClick={() => setPrioridade(p)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                    prioridade === p
                      ? p === 'urgente' ? 'border-critical/40 bg-critical/10 text-critical' : 'border-brand-400/40 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'border-line text-ink-soft hover:bg-black/5 dark:hover:bg-white/5'
                  }`}>
                  {p === 'urgente' ? '⚡ Urgente' : '📋 Normal'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
              <PaperPlaneRight className="h-4 w-4" /> Enviar solicitação
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serviço…"
            className="w-full rounded-xl border border-line bg-surface-card py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setCatFilter('todas')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${catFilter === 'todas' ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5'}`}>
            Todas
          </button>
          {categorias.map(cat => (
            <button key={cat} type="button" onClick={() => setCatFilter(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${catFilter === cat ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5'}`}>
              {cat.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
          <MagnifyingGlass className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum serviço encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.categoria}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`grid h-7 w-7 place-items-center rounded-xl ${cat.cls}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-semibold">{cat.categoria}</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cat.servicos.map(s => (
                    <div key={s.id} className="card-flat rounded-card p-4 flex flex-col gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{s.nome}</p>
                        <p className="mt-1 text-xs text-ink-soft leading-relaxed">{s.descricao}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-ink-soft">
                          <CalendarBlank className="mr-0.5 inline h-3 w-3" />{s.prazo}
                        </span>
                        <button type="button" onClick={() => onSolicitar(s)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<SolicitacaoStatus | 'todas'>('todas');

  const filtered = filter === 'todas' ? solicitacoes : solicitacoes.filter(s => s.status === filter);
  const counts = { todas: solicitacoes.length, solicitado: 0, em_analise: 0, em_andamento: 0, concluido: 0, cancelado: 0 } as Record<string, number>;
  solicitacoes.forEach(s => { counts[s.status] = (counts[s.status] ?? 0) + 1; });

  if (solicitacoes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-ink-soft">
        <FileText className="h-12 w-12 opacity-20" />
        <div>
          <p className="text-sm font-medium">Nenhuma solicitação ainda</p>
          <p className="mt-1 text-xs">Acesse o catálogo e solicite o serviço que você precisa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {([['todas', 'Todas'], ['solicitado', 'Solicitadas'], ['em_analise', 'Em análise'], ['em_andamento', 'Em andamento'], ['concluido', 'Concluídas']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${filter === key ? 'bg-brand-500 text-white' : 'bg-surface-card border border-line text-ink-soft hover:bg-black/10 dark:bg-white/5'}`}>
            {label} ({counts[key] ?? 0})
          </button>
        ))}
      </div>

      <div className="card-flat rounded-card divide-y divide-line">
        {filtered.map(s => {
          const cfg = STATUS_CONFIG[s.status];
          const StatusIcon = cfg.icon;
          const isExp = expanded === s.id;
          return (
            <div key={s.id}>
              <button type="button" onClick={() => setExpanded(isExp ? null : s.id)}
                className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-surface-card border border-line dark:hover:bg-white/5">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${cfg.cls.split(' ')[0]}`}>
                  <StatusIcon className={`h-4 w-4 ${cfg.cls.split(' ')[1]}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.servico}</p>
                  <p className="text-xs text-ink-soft">{s.categoria} · {fmtDate(s.criadaEm)}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  {s.prioridade === 'urgente' && (
                    <span className="rounded-full bg-critical/10 px-2 py-0.5 text-[10px] font-semibold text-critical">Urgente</span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
                    <StatusIcon className="h-3 w-3" />{cfg.label}
                  </span>
                </div>
                {isExp ? <CaretUp className="h-4 w-4 shrink-0 text-ink-soft" /> : <CaretDown className="h-4 w-4 shrink-0 text-ink-soft" />}
              </button>
              {isExp && (
                <div className="mx-4 mb-3 space-y-3 rounded-xl bg-surface-card border border-line p-4 dark:bg-white/5">
                  <div>
                    <p className={lbl}>Sua solicitação</p>
                    <p className="mt-1 text-sm text-ink-soft">{s.descricao}</p>
                  </div>
                  {s.resposta && (
                    <div className="rounded-xl border border-brand-400/30 bg-brand-500/5 p-3">
                      <p className={`${lbl} text-brand-600 dark:text-brand-400`}>Resposta da contabilidade</p>
                      <p className="mt-1 text-sm">{s.resposta}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
                    <span>Criada em {fmtDate(s.criadaEm)}</span>
                    <span>Atualizada em {fmtDate(s.atualizadaEm)}</span>
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

export function HubServicos() {
  const [tab, setTab] = useState<TabKey>('catalogo');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>(seedSolicitacoes);
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);

  const pendentes = solicitacoes.filter(s => ['solicitado', 'em_analise', 'em_andamento'].includes(s.status)).length;

  function handleSolicitar(s: Servico) {
    setServicoSelecionado(s);
  }

  function handleSubmit(s: Solicitacao) {
    setSolicitacoes(prev => [s, ...prev]);
    setTab('solicitacoes');
  }

  return (
    <div className="space-y-5">
      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Em andamento</p>
          <p className={`mt-1 text-2xl font-semibold ${pendentes > 0 ? 'text-warn' : ''}`}>{pendentes}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Concluídas</p>
          <p className="mt-1 text-2xl font-semibold text-ok">{solicitacoes.filter(s => s.status === 'concluido').length}</p>
        </div>
        <div className="card-flat rounded-card p-4">
          <p className="text-xs text-ink-soft">Serviços disponíveis</p>
          <p className="mt-1 text-2xl font-semibold">{CATALOGO.reduce((s, c) => s + c.servicos.length, 0)}</p>
        </div>
      </div>

      {/* Banner de contato */}
      <div className="card-flat rounded-card flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
            <ChatCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Precisa de algo não listado?</p>
            <p className="text-xs text-ink-soft">Fale diretamente com sua contabilidade pelo WhatsApp ou pelo Suporte.</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <a href="/suporte" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/5 dark:hover:bg-white/10">
            Suporte <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-line bg-surface-card border border-line p-1 dark:bg-white/3">
        {([['catalogo', 'Catálogo de Serviços', SquaresFour], ['solicitacoes', `Minhas Solicitações${pendentes > 0 ? ` (${pendentes})` : ''}`, FileText]] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key as TabKey)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-surface-card text-brand-600 shadow-sm dark:text-brand-400' : 'text-ink-soft hover:text-ink'
            }`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'catalogo'     && <CatalogoTab onSolicitar={handleSolicitar} />}
      {tab === 'solicitacoes' && <SolicitacoesTab solicitacoes={solicitacoes} />}

      {/* Modal de solicitação */}
      {servicoSelecionado && (
        <FormSolicitacao
          servico={servicoSelecionado}
          onClose={() => setServicoSelecionado(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
