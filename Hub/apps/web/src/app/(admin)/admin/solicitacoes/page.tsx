'use client';

import { useState } from 'react';
import {
  MessageSquare, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, Send, Tag,
} from 'lucide-react';

type Prioridade = 'alta' | 'media' | 'baixa';
type StatusReq = 'aberta' | 'em_andamento' | 'resolvida';
type Tipo = 'Suporte' | 'Cadastro de NF' | 'Cobrança' | 'Onboarding' | 'Técnico';

type Solicitacao = {
  id: string;
  cliente: string;
  tipo: Tipo;
  titulo: string;
  desc: string;
  prioridade: Prioridade;
  status: StatusReq;
  criada: string;
  respostas: { autor: string; msg: string; quando: string }[];
};

const SEED: Solicitacao[] = [
  {
    id: '1', cliente: 'Tech Soluções ME', tipo: 'Cadastro de NF', prioridade: 'alta', status: 'aberta',
    titulo: 'Configurar NFSe para Florianópolis',
    desc: 'Precisamos habilitar a emissão de nota fiscal de serviço para o município de Florianópolis/SC. Tentei configurar mas não encontrei o código do município no sistema.',
    criada: '2026-06-27', respostas: [],
  },
  {
    id: '2', cliente: 'Studio Criativo LTDA', tipo: 'Suporte', prioridade: 'media', status: 'em_andamento',
    titulo: 'Dúvida sobre IRRF no pró-labore',
    desc: 'Gostaria de entender como funciona a tabela de IRRF que aparece na aba de Sócios. O valor calculado parece diferente do que eu esperava.',
    criada: '2026-06-27',
    respostas: [{ autor: 'Filipe (Admin)', msg: 'Olá! O cálculo segue a tabela progressiva 2025. Vou verificar os valores e já te retorno.', quando: '2026-06-27 14:30' }],
  },
  {
    id: '3', cliente: 'Advocacia Mendes Associados', tipo: 'Cobrança', prioridade: 'alta', status: 'aberta',
    titulo: 'Regularização de inadimplência',
    desc: 'Constam 2 meses em aberto (Abril e Maio/2026). Tentamos contato por e-mail sem retorno. Necessário regularizar antes de 30/06.',
    criada: '2026-06-25', respostas: [],
  },
  {
    id: '4', cliente: 'DEF Comércio e Serviços ME', tipo: 'Onboarding', prioridade: 'baixa', status: 'resolvida',
    titulo: 'Configuração inicial do sistema',
    desc: 'Cliente novo — precisava de orientação para cadastrar os primeiros lançamentos financeiros e entender o fluxo de notas.',
    criada: '2026-06-20',
    respostas: [
      { autor: 'Filipe (Admin)', msg: 'Agendei uma sessão de onboarding para amanhã às 14h.', quando: '2026-06-20 11:00' },
      { autor: 'Fernanda (Cliente)', msg: 'Perfeito! Até amanhã.', quando: '2026-06-20 11:15' },
      { autor: 'Filipe (Admin)', msg: 'Sessão concluída com sucesso! Cliente apto para uso.', quando: '2026-06-21 15:30' },
    ],
  },
  {
    id: '5', cliente: 'Consultoria Silva & Cia', tipo: 'Técnico', prioridade: 'media', status: 'aberta',
    titulo: 'Erro ao exportar DRE em PDF',
    desc: 'Quando clico em "Exportar PDF" na aba DRE do Hub Financeiro, a janela abre mas fica em branco. Navegador: Safari no Mac.',
    criada: '2026-06-28', respostas: [],
  },
];

const P_CLS: Record<Prioridade, string> = {
  alta: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  media: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  baixa: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const S_CFG: Record<StatusReq, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  aberta: { label: 'Aberta', cls: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
  em_andamento: { label: 'Em andamento', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  resolvida: { label: 'Resolvida', cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
};

const TIPO_CLS: Record<Tipo, string> = {
  'Cadastro de NF': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Suporte': 'bg-brand-500/10 text-brand-700 dark:text-brand-400',
  'Cobrança': 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'Onboarding': 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'Técnico': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export default function AdminSolicitacoes() {
  const [items, setItems] = useState(SEED);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<StatusReq | 'todas'>('todas');

  const filtered = items.filter(i => filterStatus === 'todas' || i.status === filterStatus);

  function sendReply(id: string) {
    const msg = reply[id]?.trim();
    if (!msg) return;
    setItems(prev => prev.map(i => i.id === id ? {
      ...i, status: 'em_andamento' as StatusReq,
      respostas: [...i.respostas, { autor: 'Filipe (Admin)', msg, quando: new Date().toLocaleString('pt-BR') }],
    } : i));
    setReply(r => ({ ...r, [id]: '' }));
  }

  function resolver(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'resolvida' as StatusReq } : i));
  }

  const abertas = items.filter(i => i.status === 'aberta').length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Solicitações</h1>
        <p className="text-sm text-slate-500">{abertas} abertas · {items.length} total</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([['todas', 'Todas'], ['aberta', 'Abertas'], ['em_andamento', 'Em andamento'], ['resolvida', 'Resolvidas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilterStatus(k)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              filterStatus === k ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
            }`}>
            {l} ({k === 'todas' ? items.length : items.filter(i => i.status === k).length})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(s => {
          const stCfg = S_CFG[s.status];
          const StIcon = stCfg.icon;
          const isExp = expanded === s.id;

          return (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button type="button" onClick={() => setExpanded(isExp ? null : s.id)}
                className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${P_CLS[s.prioridade]}`}>
                      {s.prioridade === 'alta' ? '⚡ Alta' : s.prioridade === 'media' ? '○ Média' : '· Baixa'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIPO_CLS[s.tipo]}`}>{s.tipo}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stCfg.cls}`}>
                      <StIcon className="h-3 w-3" /> {stCfg.label}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">{s.titulo}</p>
                  <p className="text-xs text-slate-500">{s.cliente} · {s.criada.split('-').reverse().join('/')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.respostas.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <MessageSquare className="h-3.5 w-3.5" /> {s.respostas.length}
                    </span>
                  )}
                  {isExp ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {isExp && (
                <div className="border-t border-slate-100 px-5 pb-4 pt-3 space-y-4 dark:border-slate-800">
                  {/* Description */}
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs font-medium text-slate-400 mb-1">Descrição do cliente</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{s.desc}</p>
                  </div>

                  {/* Thread */}
                  {s.respostas.length > 0 && (
                    <div className="space-y-2">
                      {s.respostas.map((r, i) => (
                        <div key={i} className={`rounded-xl p-3 ${r.autor.includes('Admin') ? 'bg-brand-500/10 ml-4' : 'bg-slate-100 mr-4 dark:bg-slate-800'}`}>
                          <p className="text-[10px] font-semibold text-slate-500">{r.autor} · {r.quando}</p>
                          <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{r.msg}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply box */}
                  {s.status !== 'resolvida' && (
                    <div className="space-y-2">
                      <textarea
                        value={reply[s.id] ?? ''}
                        onChange={e => setReply(r => ({ ...r, [s.id]: e.target.value }))}
                        rows={2}
                        placeholder="Digite sua resposta para o cliente…"
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => sendReply(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors">
                          <Send className="h-3.5 w-3.5" /> Responder
                        </button>
                        <button onClick={() => resolver(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-slate-700 dark:text-green-400 transition-colors">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Marcar resolvida
                        </button>
                      </div>
                    </div>
                  )}
                  {s.status === 'resolvida' && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Solicitação resolvida.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
